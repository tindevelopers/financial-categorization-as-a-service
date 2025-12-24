import { createClient } from '@/core/database/server'
import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'
import { decrypt } from '@/lib/encryption'
import { getUserEntityType, getCompanyUsersWithProviderEmails } from '@/core/entity/helpers'

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

    const tenantId = (userData as { tenant_id: string | null } | null)?.tenant_id

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
    const shareWithCompany = body.shareWithCompany !== false // Default: true
    const sharingPermission = body.sharingPermission // 'reader' | 'writer', optional

    // Get stored tokens
    const { data: integration, error: intError } = await (supabase as any)
      .from('user_integrations')
      .select('access_token, refresh_token, token_expires_at, metadata, provider_email')
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
    console.log('[create-sheet] User:', user.id, 'Credential source:', credentialSource)
    
    // Get the appropriate credentials
    const credentials = await getGoogleCredentials(supabase, user.id, credentialSource)
    console.log('[create-sheet] Got credentials - clientId:', credentials.clientId?.substring(0, 20) + '...')

    if (!credentials.clientId || !credentials.clientSecret) {
      console.error('[create-sheet] Missing credentials')
      return NextResponse.json({ 
        error: 'Google Sheets credentials not configured',
        details: 'Could not find OAuth credentials. Please check your tenant settings.',
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
    
    // Get the actual sheet ID from the created spreadsheet
    const transactionsSheet = spreadsheet.data.sheets?.[0]
    const actualSheetId = transactionsSheet?.properties?.sheetId ?? 0
    
    console.log('[create-sheet] Created spreadsheet:', spreadsheetId, 'Sheet ID:', actualSheetId)

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
                sheetId: actualSheetId,
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
                sheetId: actualSheetId,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: 10,
              },
            },
          },
        ],
      },
    })

    // Auto-share with company users if applicable
    let sharedWithUsers: string[] = []
    if (shareWithCompany) {
      try {
        // Check if user is a company user
        const entityType = await getUserEntityType(user.id)
        
        if (entityType === 'company') {
          // Get user's tenant ID
          const { data: userData } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single()
          
          const tenantId = (userData as { tenant_id: string | null } | null)?.tenant_id
          
          if (tenantId) {
            // Get default sharing permission from tenant settings
            const { data: tenantSettings } = await (supabase as any)
              .from('tenant_integration_settings')
              .select('default_sharing_permission')
              .eq('tenant_id', tenantId)
              .eq('provider', 'google_sheets')
              .single()
            
            const permission = sharingPermission || tenantSettings?.default_sharing_permission || 'reader'
            
            // Get company users with their Google account emails
            const companyUsers = await getCompanyUsersWithProviderEmails(tenantId)
            
            // Share sheet with each company user
            const drive = google.drive({ version: 'v3', auth: oauth2Client })
            
            for (const companyUser of companyUsers) {
              // Skip sharing with the creator (they already own it)
              // Compare emails case-insensitively
              if (companyUser.provider_email?.toLowerCase() === integration.provider_email?.toLowerCase()) {
                continue
              }
              
              try {
                await drive.permissions.create({
                  fileId: spreadsheetId!,
                  requestBody: {
                    role: permission,
                    type: 'user',
                    emailAddress: companyUser.provider_email,
                  },
                  sendNotificationEmail: false, // Don't send email notifications
                })
                sharedWithUsers.push(companyUser.provider_email)
                console.log(`[create-sheet] Shared sheet with ${companyUser.provider_email} (${permission})`)
              } catch (shareError: any) {
                // Log but don't fail - sharing errors shouldn't break sheet creation
                console.error(`[create-sheet] Failed to share with ${companyUser.provider_email}:`, shareError.message)
              }
            }
            
            console.log(`[create-sheet] Shared sheet with ${sharedWithUsers.length} company users`)
          }
        }
      } catch (shareError) {
        // Log but don't fail - sharing errors shouldn't break sheet creation
        console.error('[create-sheet] Error during auto-sharing:', shareError)
      }
    }

    return NextResponse.json({
      success: true,
      spreadsheet: {
        id: spreadsheetId,
        name: sheetName,
        url: spreadsheetUrl,
      },
      message: `Created new spreadsheet: ${sheetName}`,
      sharedWithUsers: sharedWithUsers.length > 0 ? sharedWithUsers : undefined,
    }, { headers: corsHeaders })

  } catch (error: any) {
    console.error('[create-sheet] Error:', error.message, error.code)
    
    // Check for specific Google API errors
    if (error.code === 403) {
      const errorMessage = error.message || ''
      if (errorMessage.includes('has not been used in project') || errorMessage.includes('is disabled')) {
        // Extract project ID from error message
        const projectMatch = errorMessage.match(/project (\d+)/)
        const projectId = projectMatch ? projectMatch[1] : ''
        const enableLink = projectId 
          ? `https://console.developers.google.com/apis/api/sheets.googleapis.com/overview?project=${projectId}`
          : 'https://console.developers.google.com/apis/library/sheets.googleapis.com'
        
        // Try to get credential source from integration metadata
        let credentialSource = 'platform'
        try {
          const supabase = await createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (user) {
            const { data: integration } = await (supabase as any)
              .from('user_integrations')
              .select('metadata')
              .eq('user_id', user.id)
              .eq('provider', 'google_sheets')
              .single()
            credentialSource = integration?.metadata?.credential_source || 'platform'
          }
        } catch (e) {
          // If we can't determine, default to platform
        }
        
        const isTenantCredentials = credentialSource === 'tenant'
        const errorTitle = isTenantCredentials 
          ? 'Google Sheets API not enabled in your Google Cloud project'
          : 'Google Sheets API not enabled (Platform Configuration Issue)'
        
        const errorDetails = isTenantCredentials
          ? `You're using custom OAuth credentials. The Google Sheets API needs to be enabled in your Google Cloud project (${projectId}). Please visit the Google Cloud Console to enable it.`
          : `The platform's Google Cloud project needs to have the Sheets API enabled. Please contact your administrator or platform support.`
        
        return NextResponse.json({ 
          error: errorTitle,
          details: errorDetails,
          enableLink: isTenantCredentials ? enableLink : null,
          apiNotEnabled: true,
          credentialSource,
          isTenantCredentials
        }, { status: 403, headers: corsHeaders })
      }
      
      return NextResponse.json({ 
        error: 'Access denied to Google Sheets',
        details: error.message,
        needsReconnect: true
      }, { status: 403, headers: corsHeaders })
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to create spreadsheet',
        details: error.message,
      },
      { status: 500, headers: corsHeaders }
    )
  }
}

