import { createClient } from '@/lib/database/server'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete user's Google Sheets integration
    // Note: Using type assertion because user_integrations table may not be in generated types yet
    const { error } = await (supabase as any)
      .from('user_integrations')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', 'google_sheets')

    if (error) {
      console.error('Failed to disconnect Google Sheets:', error)
      return NextResponse.json(
        { error: 'Failed to disconnect' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error disconnecting Google Sheets:', error)
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    )
  }
}
