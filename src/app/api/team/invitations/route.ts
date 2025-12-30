import { createClient } from '@/core/database/server'
import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { sendEmail } from '@/core/email'

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
      })
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
    return NextResponse.json(
      { error: 'Failed to get invitations' },
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

    // Send invitation email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const inviteLink = `${baseUrl}/join?token=${inviteToken}`
    const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com'

    try {
      const emailSubject = `You've been invited to join ${userData.full_name || 'a team'}`
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Team Invitation</h2>
          <p>You've been invited to join a team for financial categorization and reconciliation.</p>
          ${message ? `<div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; font-style: italic;">"${message}"</p>
          </div>` : ''}
          <div style="margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Accept Invitation
            </a>
          </div>
          <p style="color: #666; font-size: 12px;">
            Or copy and paste this link into your browser:<br/>
            <a href="${inviteLink}" style="color: #007bff; word-break: break-all;">${inviteLink}</a>
          </p>
          <p style="margin-top: 30px; color: #666; font-size: 12px;">
            This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
          </p>
        </div>
      `

      await sendEmail({
        to: email.toLowerCase(),
        from: fromAddress,
        subject: emailSubject,
        html: htmlContent,
      })
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError)
      // Don't fail the invitation creation if email fails
      // Return the invitation with the link so it can be sent manually
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

