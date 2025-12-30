import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { GmailService } from '@/lib/email/GmailService';

/**
 * Gmail Setup API
 * POST: Set up Gmail watch for a tenant's forwarding address
 * This sets up push notifications from Gmail
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const db = supabase as any;

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's tenant_id
    const { data: userData } = await db
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    const tenantId = userData?.tenant_id;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'User is not associated with a tenant' },
        { status: 400 }
      );
    }

    // Get tenant's active forwarding address
    const { data: forwardingAddress, error: addressError } = await db
      .from('email_forwarding_addresses')
      .select('id, email_address')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();

    if (addressError || !forwardingAddress) {
      return NextResponse.json(
        { error: 'No active forwarding address found. Please generate one first.' },
        { status: 404 }
      );
    }

    // Get Gmail OAuth tokens
    // In production, you'd store these per tenant/user
    const gmailAccessToken = process.env.GMAIL_ACCESS_TOKEN;
    const gmailRefreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!gmailAccessToken) {
      return NextResponse.json(
        { error: 'Gmail service not configured. Please set GMAIL_ACCESS_TOKEN.' },
        { status: 500 }
      );
    }

    // Initialize Gmail service
    const gmailService = new GmailService(gmailAccessToken, gmailRefreshToken);

    // Set up Gmail watch
    // Topic name should be your Pub/Sub topic (e.g., projects/your-project/topics/gmail-notifications)
    const topicName = process.env.GMAIL_PUBSUB_TOPIC || `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`;

    const watchResult = await gmailService.watchGmail(topicName);

    // Store watch information
    await db
      .from('email_forwarding_addresses')
      .update({
        gmail_history_id: watchResult.historyId,
        gmail_watch_expiration: watchResult.expiration,
      })
      .eq('id', forwardingAddress.id);

    return NextResponse.json({
      success: true,
      message: 'Gmail watch set up successfully',
      historyId: watchResult.historyId,
      expiration: watchResult.expiration,
      forwardingAddress: forwardingAddress.email_address,
    });

  } catch (error) {
    console.error('Gmail setup error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

