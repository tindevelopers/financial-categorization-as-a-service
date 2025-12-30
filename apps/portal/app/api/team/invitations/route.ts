import { createClient } from '@/lib/database/server'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'

/**
 * Team Invitations API
 * Allows company accounts to invite team members for reconciliation collaboration
 */

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userData?.tenant_id) {
      return NextResponse.json({ 
        error: 'Individual accounts cannot manage team invitations',
        invitations: [],
        teamMembers: [],
      }, { status: 200 }) // Return 200 with empty arrays for graceful degradation
    }

    // Get pending invitations
    const { data: invitations } = await (supabase as any)
      .from('team_invitations')
      .select('*')
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // Get current team members
    const { data: teamMembers } = await (supabase as any)
      .from('users')
      .select('id, email, full_name, created_at, status')
      .eq('tenant_id', userData.tenant_id)
      .neq('id', user.id)

    return NextResponse.json({
      invitations: invitations || [],
      teamMembers: teamMembers || [],
    })
  } catch (error: any) {
    console.error('Error getting invitations:', error)
    // Return graceful failure instead of error
    return NextResponse.json({
      invitations: [],
      teamMembers: [],
    }, { status: 200 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's tenant
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('tenant_id, full_name')
      .eq('id', user.id)
      .single()

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: 'Only company accounts can invite team members' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { email, role = 'collaborator', message } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Check if user already exists in tenant
    const { data: existingUser } = await (supabase as any)
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('tenant_id', userData.tenant_id)
      .single()

    if (existingUser) {
      return NextResponse.json(
        { error: 'User is already a team member' },
        { status: 400 }
      )
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await (supabase as any)
      .from('team_invitations')
      .select('id')
      .eq('email', email.toLowerCase())
      .eq('tenant_id', userData.tenant_id)
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email' },
        { status: 400 }
      )
    }

    // Create invitation
    const inviteToken = nanoid(32)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // 7 day expiration

    const { data: invitation, error: inviteError } = await (supabase as any)
      .from('team_invitations')
      .insert({
        tenant_id: userData.tenant_id,
        email: email.toLowerCase(),
        role,
        message,
        invited_by: user.id,
        invite_token: inviteToken,
        expires_at: expiresAt.toISOString(),
        status: 'pending',
      })
      .select()
      .single()

    if (inviteError) {
      throw inviteError
    }

    // Generate invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/join?token=${inviteToken}`

    // Try to send invitation email (optional - don't fail if email service isn't configured)
    try {
      // Check if email service is available
      const emailFrom = process.env.EMAIL_FROM_ADDRESS
      if (emailFrom) {
        // Try to use Supabase email if available, or other email service
        // For now, we'll just log - email can be sent via a background job or external service
        console.log('Invitation created - email should be sent:', {
          to: email.toLowerCase(),
          inviteLink,
        })
      }
    } catch (emailError) {
      console.warn('Failed to send invitation email (non-critical):', emailError)
      // Don't fail the invitation creation if email fails
    }

    return NextResponse.json({
      success: true,
      invitation: {
        ...invitation,
        inviteLink,
      },
    })
  } catch (error: any) {
    console.error('Error creating invitation:', error)
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const invitationId = searchParams.get('id')

    if (!invitationId) {
      return NextResponse.json(
        { error: 'Invitation ID is required' },
        { status: 400 }
      )
    }

    // Get user's tenant
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userData?.tenant_id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      )
    }

    // Delete invitation (must belong to same tenant)
    const { error } = await (supabase as any)
      .from('team_invitations')
      .delete()
      .eq('id', invitationId)
      .eq('tenant_id', userData.tenant_id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting invitation:', error)
    return NextResponse.json(
      { error: 'Failed to delete invitation' },
      { status: 500 }
    )
  }
}

