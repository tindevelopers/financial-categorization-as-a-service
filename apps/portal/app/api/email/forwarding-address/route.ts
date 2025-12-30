import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/database/server';
import { nanoid } from 'nanoid';

/**
 * Email Forwarding Address Management API (Per-User)
 * GET: Get user's unique forwarding email address
 * POST: Generate new forwarding email address for user
 * PATCH: Update forwarding address settings
 * DELETE: Deactivate forwarding email address
 */

// Types for tables not in generated types
interface EmailForwardingAddress {
  id: string;
  tenant_id: string;
  user_id: string;
  email_address: string;
  is_active: boolean;
  emails_received: number;
  last_email_at?: string;
  created_at: string;
  [key: string]: any;
}

interface EmailReceipt {
  processing_status: string;
  received_at: string;
  [key: string]: any;
}

interface PlatformSetting {
  setting_key: string;
  setting_value: any;
}

/**
 * Get email forwarding domain from platform_settings table
 * Falls back to environment variable if not found
 */
async function getEmailForwardingDomain(db: any): Promise<string> {
  try {
    const { data: setting, error } = await db
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'email_forwarding_domain')
      .single() as { data: PlatformSetting | null; error: any };

    if (!error && setting?.setting_value) {
      // setting_value is JSONB, extract the domain value
      const domain = typeof setting.setting_value === 'string' 
        ? setting.setting_value 
        : setting.setting_value?.domain || setting.setting_value?.value;
      if (domain) {
        return domain;
      }
    }
  } catch (error) {
    console.error('Error fetching email forwarding domain from platform_settings:', error);
  }

  // Fallback to environment variable
  return process.env.EMAIL_FORWARDING_DOMAIN || 'receipts.fincat.co.uk';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    // Cast to any for tables not in generated types
    const db = supabase as any;
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's tenant_id - handle null case
    const { data: userData, error: userDataError } = await db
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError) {
      console.error('Error fetching user data:', userDataError);
      return NextResponse.json(
        { error: 'Failed to fetch user information' },
        { status: 500 }
      );
    }

    // Check if userData exists
    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const tenantId = userData.tenant_id;

    // Handle case where tenant_id might be null (platform admins shouldn't generate addresses)
    if (!tenantId) {
      return NextResponse.json(
        { error: 'User is not associated with a tenant. Email forwarding is only available for tenant users.' },
        { status: 400 }
      );
    }

    // Get user's forwarding addresses (per-user, not per-tenant)
    const { data: addresses, error: addressError } = await db
      .from('email_forwarding_addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }) as { data: EmailForwardingAddress[] | null; error: any };

    if (addressError) {
      console.error('Error fetching forwarding addresses:', addressError);
      return NextResponse.json(
        { error: 'Failed to fetch forwarding addresses' },
        { status: 500 }
      );
    }

    // Get active address for this user
    const activeAddress = addresses?.find(addr => addr.is_active && addr.user_id === user.id);

    // Get email statistics for user
    const { data: stats, error: statsError } = await db
      .from('email_receipts')
      .select('processing_status, received_at')
      .eq('user_id', user.id)
      .order('received_at', { ascending: false })
      .limit(100) as { data: EmailReceipt[] | null; error: any };

    if (statsError) {
      console.error('Error fetching email statistics:', statsError);
    }

    const emailStats = {
      total: stats?.length || 0,
      completed: stats?.filter((s: EmailReceipt) => s.processing_status === 'completed').length || 0,
      failed: stats?.filter((s: EmailReceipt) => s.processing_status === 'failed').length || 0,
      pending: stats?.filter((s: EmailReceipt) => s.processing_status === 'pending' || s.processing_status === 'processing').length || 0,
    };

    return NextResponse.json({
      addresses: addresses || [],
      active_address: activeAddress || null,
      statistics: emailStats,
    });

  } catch (error) {
    console.error('Get forwarding address error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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

    // Get user's tenant_id - handle null case
    const { data: userData, error: userDataError } = await db
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError) {
      console.error('Error fetching user data:', userDataError);
      return NextResponse.json(
        { error: 'Failed to fetch user information' },
        { status: 500 }
      );
    }

    // Check if userData exists
    if (!userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const tenantId = userData.tenant_id;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'User is not associated with a tenant. Email forwarding is only available for tenant users.' },
        { status: 400 }
      );
    }

    // Check if user already has an active forwarding address (per-user check)
    const { data: existingAddresses, error: existingError } = await db
      .from('email_forwarding_addresses')
      .select('id, email_address, is_active')
      .eq('user_id', user.id)
      .eq('is_active', true) as { data: EmailForwardingAddress[] | null; error: any };

    if (existingError) {
      console.error('Error checking existing addresses:', existingError);
      return NextResponse.json(
        { error: 'Failed to check existing addresses' },
        { status: 500 }
      );
    }

    if (existingAddresses && existingAddresses.length > 0) {
      return NextResponse.json({
        success: true,
        address: existingAddresses[0],
        message: 'Active forwarding address already exists',
      });
    }

    // Get email forwarding domain from platform_settings
    const emailDomain = await getEmailForwardingDomain(db);

    // Generate unique email address for user
    // Format: receipts-{user-short-id}@domain.com
    const userShortId = nanoid(8); // 8-character unique ID for user
    const emailAddress = `receipts-${userShortId}@${emailDomain}`;

    // Create new forwarding address for user
    const { data: newAddress, error: createError } = await db
      .from('email_forwarding_addresses')
      .insert({
        tenant_id: tenantId,
        user_id: user.id,
        email_address: emailAddress,
        is_active: true,
      })
      .select()
      .single() as { data: EmailForwardingAddress | null; error: any };

    if (createError || !newAddress) {
      console.error('Error creating forwarding address:', createError);
      return NextResponse.json(
        { error: 'Failed to create forwarding address', details: createError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      address: newAddress,
      message: 'Forwarding address created successfully',
    });

  } catch (error) {
    console.error('Create forwarding address error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
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
    const { data: userData, error: userDataError } = await db
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const tenantId = userData.tenant_id;

    const body = await request.json();
    const { address_id, is_active } = body;

    if (!address_id) {
      return NextResponse.json(
        { error: 'Missing address_id' },
        { status: 400 }
      );
    }

    // Verify user owns the address (check by user_id, not tenant_id)
    const { data: address, error: lookupError } = await db
      .from('email_forwarding_addresses')
      .select('id')
      .eq('id', address_id)
      .eq('user_id', user.id)
      .single();

    if (lookupError || !address) {
      return NextResponse.json(
        { error: 'Address not found or unauthorized' },
        { status: 404 }
      );
    }

    // Update address
    const { data: updatedAddress, error: updateError } = await db
      .from('email_forwarding_addresses')
      .update({ is_active })
      .eq('id', address_id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating forwarding address:', updateError);
      return NextResponse.json(
        { error: 'Failed to update forwarding address' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      address: updatedAddress,
      message: 'Forwarding address updated successfully',
    });

  } catch (error) {
    console.error('Update forwarding address error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
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
    const { data: userData, error: userDataError } = await db
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userDataError || !userData) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const tenantId = userData.tenant_id;

    const { searchParams } = new URL(request.url);
    const address_id = searchParams.get('address_id');

    if (!address_id) {
      return NextResponse.json(
        { error: 'Missing address_id' },
        { status: 400 }
      );
    }

    // Verify user owns the address (check by user_id, not tenant_id)
    const { data: address, error: lookupError } = await db
      .from('email_forwarding_addresses')
      .select('id')
      .eq('id', address_id)
      .eq('user_id', user.id)
      .single();

    if (lookupError || !address) {
      return NextResponse.json(
        { error: 'Address not found or unauthorized' },
        { status: 404 }
      );
    }

    // Deactivate address (don't delete to preserve history)
    const { error: updateError } = await db
      .from('email_forwarding_addresses')
      .update({ is_active: false })
      .eq('id', address_id);

    if (updateError) {
      console.error('Error deactivating forwarding address:', updateError);
      return NextResponse.json(
        { error: 'Failed to deactivate forwarding address' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Forwarding address deactivated successfully',
    });

  } catch (error) {
    console.error('Delete forwarding address error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
