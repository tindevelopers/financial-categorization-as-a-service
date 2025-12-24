import { createClient } from '@/core/database/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has Google Sheets integration in the database
    // Note: Using type assertion because user_integrations table may not be in generated types yet
    const { data: integration, error } = await (supabase as any)
      .from('user_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('provider', 'google_sheets')
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows returned (not an error, just means not connected)
      console.error('Error checking integration status:', error)
    }

    return NextResponse.json({
      connected: !!integration?.access_token,
      email: integration?.provider_email || null,
      connectedAt: integration?.created_at || null,
    })
  } catch (error) {
    console.error('Error checking Google Sheets status:', error)
    return NextResponse.json({ connected: false })
  }
}
