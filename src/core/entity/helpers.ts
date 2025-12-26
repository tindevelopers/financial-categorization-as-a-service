/**
 * Entity Helper Functions
 * Utilities for determining entity type and getting company users
 */

import { createClient } from '@/core/database/server'

/**
 * Determine if a user is an individual or company
 * Individual = company_type is 'individual' or no company profile exists
 * Company = company_type is anything other than 'individual'
 */
export async function getUserEntityType(userId: string): Promise<'individual' | 'company'> {
  try {
    const supabase = await createClient()
    
    // Check if user has a company profile
    const { data: companyProfile } = await (supabase as any)
      .from('company_profiles')
      .select('company_type')
      .eq('user_id', userId)
      .single()
    
    // If no company profile exists, user is individual
    if (!companyProfile) {
      return 'individual'
    }
    
    // If company_type is 'individual', user is individual
    if (companyProfile.company_type === 'individual') {
      return 'individual'
    }
    
    // Otherwise, user is a company
    return 'company'
  } catch (error) {
    console.error('[getUserEntityType] Error:', error)
    // Default to individual on error
    return 'individual'
  }
}

/**
 * Get all company users (users in the same tenant) who have connected Google Sheets
 * Returns array of email addresses
 */
export async function getCompanyUsers(tenantId: string | null): Promise<string[]> {
  if (!tenantId) {
    return []
  }
  
  try {
    const supabase = await createClient()
    
    // Get all users in the same tenant who have connected Google Sheets
    const { data: users, error } = await (supabase as any)
      .from('users')
      .select(`
        id,
        email,
        user_integrations!inner (
          provider
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('user_integrations.provider', 'google_sheets')
    
    if (error) {
      console.error('[getCompanyUsers] Error fetching users:', error)
      return []
    }
    
    // Extract email addresses
    const emails = (users || [])
      .map((user: any) => user.email)
      .filter((email: string | null) => email !== null && email !== undefined)
    
    return emails
  } catch (error) {
    console.error('[getCompanyUsers] Error:', error)
    return []
  }
}

/**
 * Get company users with their Google Sheets provider email
 * Returns array of objects with email and provider_email
 */
export async function getCompanyUsersWithProviderEmails(tenantId: string | null): Promise<Array<{ email: string; provider_email: string | null }>> {
  if (!tenantId) {
    return []
  }
  
  try {
    const supabase = await createClient()
    
    // Get all users in the same tenant who have connected Google Sheets
    const { data: users, error } = await (supabase as any)
      .from('users')
      .select(`
        id,
        email,
        user_integrations!inner (
          provider,
          provider_email
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('user_integrations.provider', 'google_sheets')
    
    if (error) {
      console.error('[getCompanyUsersWithProviderEmails] Error fetching users:', error)
      return []
    }
    
    // Extract email addresses, preferring provider_email (Google account email) over user email
    const result = (users || [])
      .map((user: any) => {
        // Handle both array and single object responses from join
        let integration = null
        if (Array.isArray(user.user_integrations)) {
          integration = user.user_integrations.find((i: any) => i.provider === 'google_sheets') || user.user_integrations[0]
        } else if (user.user_integrations) {
          integration = user.user_integrations
        }
        
        const providerEmail = integration?.provider_email || user.email
        
        return {
          email: user.email,
          provider_email: providerEmail
        }
      })
      .filter((item: any) => item.provider_email !== null && item.provider_email !== undefined)
    
    return result
  } catch (error) {
    console.error('[getCompanyUsersWithProviderEmails] Error:', error)
    return []
  }
}

