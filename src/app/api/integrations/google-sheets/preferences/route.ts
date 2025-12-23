import { createClient } from '@/core/database/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Get or set user's Google Sheets preferences
 * - Default spreadsheet to export to
 * - Sheet tab preferences
 */

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's sheet preferences
    const { data: preferences, error } = await (supabase as any)
      .from('user_sheet_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') { // Not a "not found" error
      throw error
    }

    return NextResponse.json({
      preferences: preferences || null,
    })
  } catch (error: any) {
    console.error('Error getting preferences:', error)
    return NextResponse.json(
      { error: 'Failed to get preferences' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { spreadsheet_id, spreadsheet_name, sheet_tab_name } = body

    if (!spreadsheet_id) {
      return NextResponse.json(
        { error: 'spreadsheet_id is required' },
        { status: 400 }
      )
    }

    // Upsert preferences
    const { data, error } = await (supabase as any)
      .from('user_sheet_preferences')
      .upsert({
        user_id: user.id,
        spreadsheet_id,
        spreadsheet_name: spreadsheet_name || null,
        sheet_tab_name: sheet_tab_name || 'Transactions',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      preferences: data,
    })
  } catch (error: any) {
    console.error('Error saving preferences:', error)
    return NextResponse.json(
      { error: 'Failed to save preferences' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await (supabase as any)
      .from('user_sheet_preferences')
      .delete()
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting preferences:', error)
    return NextResponse.json(
      { error: 'Failed to delete preferences' },
      { status: 500 }
    )
  }
}

