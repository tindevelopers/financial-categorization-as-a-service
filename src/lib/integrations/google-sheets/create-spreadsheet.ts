import { google } from 'googleapis'

export type SubscriptionLevel = 'individual' | 'business' | 'enterprise'

export type CreateSpreadsheetOptions = {
  purpose: 'account' | 'suspense'
  title: string
}

export type CreateSpreadsheetResult = {
  spreadsheetId: string
  spreadsheetName: string
  sheetUrl: string
  createdUnder: 'oauth_user' | 'service_account'
}

export async function getSubscriptionLevel(
  supabase: any,
  userId: string
): Promise<{ level: SubscriptionLevel; tenantId: string | null; planName: string | null }> {
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select('plan, tenant_id')
    .eq('id', userId)
    .single()

  if (userErr) throw userErr

  const tenantId: string | null = userRow?.tenant_id || null
  const userPlan: string | null = userRow?.plan || null

  if (!tenantId) {
    return { level: 'individual', tenantId: null, planName: userPlan }
  }

  // Prefer Stripe subscription plan_name when present
  const { data: stripeSub } = await supabase
    .from('stripe_subscriptions')
    .select('plan_name, status')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'trialing'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle()

  const planName: string | null = stripeSub?.plan_name || userPlan
  const normalized = (planName || '').toLowerCase()

  if (normalized.includes('enterprise')) {
    return { level: 'enterprise', tenantId, planName }
  }

  return { level: 'business', tenantId, planName }
}

export async function getGoogleOAuthClientForUser(supabase: any, userId: string) {
  const { data: integration, error: intError } = await supabase
    .from('user_integrations')
    .select('access_token, refresh_token, token_expires_at, provider_email')
    .eq('user_id', userId)
    .eq('provider', 'google_sheets')
    .single()

  if (intError || !integration) {
    throw new Error('Google Sheets not connected')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )

  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token,
  })

  // Refresh token if expired
  if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
    const { credentials } = await oauth2Client.refreshAccessToken()

    await supabase
      .from('user_integrations')
      .update({
        access_token: credentials.access_token,
        token_expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('provider', 'google_sheets')

    oauth2Client.setCredentials(credentials)
  }

  return { oauth2Client, providerEmail: integration.provider_email as string | null }
}

export function getServiceAccountAuth() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const serviceAccountPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!serviceAccountEmail || !serviceAccountPrivateKey) {
    throw new Error('Google service account is not configured')
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: serviceAccountPrivateKey,
    },
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
    ],
  })
}

export async function ensureTemplateTabsAndFormulas(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
) {
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId })
  const firstSheet = spreadsheet.data.sheets?.[0]
  const firstSheetId = firstSheet?.properties?.sheetId

  const existingTitles = new Set(
    (spreadsheet.data.sheets || []).map(s => s.properties?.title).filter(Boolean) as string[]
  )

  const requests: any[] = []

  if (firstSheetId != null && firstSheet?.properties?.title !== 'Transactions') {
    requests.push({
      updateSheetProperties: {
        properties: { sheetId: firstSheetId, title: 'Transactions' },
        fields: 'title',
      },
    })
  }

  if (!existingTitles.has('Category_Summary')) {
    requests.push({ addSheet: { properties: { title: 'Category_Summary' } } })
  }

  if (!existingTitles.has('Transactions_By_Category')) {
    requests.push({ addSheet: { properties: { title: 'Transactions_By_Category' } } })
  }

  if (requests.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    })
  }

  // Headers used by sync/push writers (must match)
  const transactionsHeader = [
    ['Date', 'Description', 'Amount', 'Category', 'Subcategory', 'Notes', 'Status', 'Confirmed'],
  ]

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Transactions!A1:H1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: transactionsHeader },
  })

  // Category summary based on confirmed rows only
  const summaryValues = [
    ['Category', 'Subtotal', 'Count', 'Grand_Total'],
    [
      '=SORT(UNIQUE(FILTER(Transactions!D2:D, Transactions!H2:H=TRUE, Transactions!D2:D<>"")))',
      '=ARRAYFORMULA(IF(A2:A="","",SUMIF(Transactions!D:D,A2:A,Transactions!C:C)))',
      '=ARRAYFORMULA(IF(A2:A="","",COUNTIF(Transactions!D:D,A2:A)))',
      '=IFERROR(SUM(FILTER(B2:B,B2:B<>"")),0)',
    ],
  ]

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Category_Summary!A1:D2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: summaryValues },
  })

  // Grouped view of confirmed rows (sorted by category, date)
  const byCategoryFormula = [
    ['=QUERY(Transactions!A1:H, "select * where H = TRUE order by D, A", 1)'],
  ]

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Transactions_By_Category!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: byCategoryFormula },
  })
}

export async function createSpreadsheetForUser(
  supabase: any,
  user: { id: string; email?: string | null },
  options: CreateSpreadsheetOptions
): Promise<CreateSpreadsheetResult> {
  const { level } = await getSubscriptionLevel(supabase, user.id)

  if (level === 'individual') {
    const { oauth2Client } = await getGoogleOAuthClientForUser(supabase, user.id)
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client })

    const created = await sheets.spreadsheets.create({
      requestBody: { properties: { title: options.title } },
    })

    const spreadsheetId = created.data.spreadsheetId
    if (!spreadsheetId) throw new Error('Failed to create spreadsheet')

    await ensureTemplateTabsAndFormulas(sheets, spreadsheetId)

    return {
      spreadsheetId,
      spreadsheetName: options.title,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      createdUnder: 'oauth_user',
    }
  }

  // Business / enterprise
  const auth = getServiceAccountAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const drive = google.drive({ version: 'v3', auth })

  const created = await sheets.spreadsheets.create({
    requestBody: { properties: { title: options.title } },
  })

  const spreadsheetId = created.data.spreadsheetId
  if (!spreadsheetId) throw new Error('Failed to create spreadsheet')

  await ensureTemplateTabsAndFormulas(sheets, spreadsheetId)

  // Share to user email (prefer provider_email)
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('provider_email')
    .eq('user_id', user.id)
    .eq('provider', 'google_sheets')
    .maybeSingle()

  const emailToShare = (integration?.provider_email as string | null) || user.email || null
  if (emailToShare) {
    await drive.permissions.create({
      fileId: spreadsheetId,
      requestBody: {
        type: 'user',
        role: 'writer',
        emailAddress: emailToShare,
      },
      sendNotificationEmail: false,
    })
  }

  return {
    spreadsheetId,
    spreadsheetName: options.title,
    sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    createdUnder: 'service_account',
  }
}


