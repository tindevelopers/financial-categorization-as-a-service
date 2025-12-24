import { createClient } from '@/core/database/server'
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { decrypt } from '@/lib/encryption'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/**
 * Get Google OAuth credentials based on source stored in integration
 */
async function getGoogleCredentials(
  supabase: any, 
  userId: string, 
  source: 'tenant' | 'platform'
): Promise<{
  clientId: string | null;
  clientSecret: string | null;
}> {
  if (source === 'tenant') {
    // Get user's tenant ID
    const { data: userData } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', userId)
      .single()

    const tenantId = userData?.tenant_id

    if (tenantId) {
      const { data: tenantSettings } = await (supabase as any)
        .from('tenant_integration_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('provider', 'google_sheets')
        .single()

      if (tenantSettings?.custom_client_id && tenantSettings?.custom_client_secret) {
        let decryptedSecret = null
        try {
          decryptedSecret = decrypt(tenantSettings.custom_client_secret)
        } catch (error) {
          console.error('Failed to decrypt client secret:', error)
        }

        if (decryptedSecret) {
          return {
            clientId: tenantSettings.custom_client_id,
            clientSecret: decryptedSecret,
          }
        }
      }
    }
  }

  // Fall back to platform-level environment variables
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || null,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || null,
  }
}

/**
 * OPTIONS handler for CORS
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

/**
 * POST /api/integrations/google-sheets/create-sheet
 * Create a new Google Sheet for the user
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' }, 
        { status: 401, headers: corsHeaders }
      )
    }

    // Parse request body
    const body = await request.json()
    const sheetName = body.name || 'FinCat Transactions Export'

    // Get stored tokens
    const { data: integration, error: intError } = await (supabase as any)
      .from('user_integrations')
      .select('access_token, refresh_token, token_expires_at, metadata')
      .eq('user_id', user.id)
      .eq('provider', 'google_sheets')
      .single()

    if (intError || !integration) {
      return NextResponse.json({ 
        error: 'Google Sheets not connected. Please connect your account first.',
        connected: false 
      }, { status: 400, headers: corsHeaders })
    }

    // Get the credential source from metadata
    const credentialSource = integration.metadata?.credential_source || 'platform'
    
    // Get the appropriate credentials
    const credentials = await getGoogleCredentials(supabase, user.id, credentialSource)

    if (!credentials.clientId || !credentials.clientSecret) {
      return NextResponse.json({ 
        error: 'Google Sheets credentials not configured',
      }, { status: 500, headers: corsHeaders })
    }

    // Set up OAuth client
    const oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret
    )

    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    })

    // Check if token needs refresh
    if (integration.token_expires_at && new Date(integration.token_expires_at) < new Date()) {
      try {
        const { credentials: newCredentials } = await oauth2Client.refreshAccessToken()
        
        // Update stored token
        await (supabase as any)
          .from('user_integrations')
          .update({
            access_token: newCredentials.access_token,
            token_expires_at: newCredentials.expiry_date 
              ? new Date(newCredentials.expiry_date).toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('provider', 'google_sheets')

        oauth2Client.setCredentials(newCredentials)
      } catch (refreshError) {
        console.error('Failed to refresh token:', refreshError)
        return NextResponse.json({ 
          error: 'Token expired. Please reconnect Google Sheets.',
          needsReconnect: true
        }, { status: 401, headers: corsHeaders })
      }
    }

    // Create new spreadsheet using Sheets API
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client })
    
    const spreadsheet = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: sheetName,
        },
        sheets: [
          {
            properties: {
              title: 'Transactions',
              gridProperties: {
                frozenRowCount: 1, // Freeze header row
              },
            },
          },
        ],
      },
    })

    const spreadsheetId = spreadsheet.data.spreadsheetId
    const spreadsheetUrl = spreadsheet.data.spreadsheetUrl

    // Add headers to the first row
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId!,
      range: 'Transactions!A1:J1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          'Date',
          'Description',
          'Amount',
          'Category',
          'Subcategory',
          'Account',
          'Type',
          'Confidence',
          'Notes',
          'Transaction ID',
        ]],
      },
    })

    // Format header row (bold, background color)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: spreadsheetId!,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 10,
              },
            },
          },
        ],
      },
    })

    return NextResponse.json({
      success: true,
      spreadsheet: {
        id: spreadsheetId,
        name: sheetName,
        url: spreadsheetUrl,
      },
      message: `Created new spreadsheet: ${sheetName}`,
    }, { headers: corsHeaders })

  } catch (error: any) {
    console.error('Error creating sheet:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create spreadsheet',
        details: error.message,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}

