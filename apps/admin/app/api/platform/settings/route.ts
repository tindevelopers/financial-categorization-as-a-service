import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/core/database/server';
import { createAdminClient } from '@/core/database/admin-client';
import { getUserPermissions } from '@/core/permissions/permissions';

/**
 * Platform Settings API
 * GET: Retrieve platform settings (all authenticated users can read)
 * POST/PATCH: Update platform settings (platform admin only)
 */

interface PlatformSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
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

    // Get all platform settings (all authenticated users can read)
    const { data: settings, error: settingsError } = await db
      .from('platform_settings')
      .select('*')
      .order('setting_key') as { data: PlatformSetting[] | null; error: any };

    if (settingsError) {
      console.error('Error fetching platform settings:', settingsError);
      return NextResponse.json(
        { error: 'Failed to fetch platform settings' },
        { status: 500 }
      );
    }

    // Convert to key-value object for easier access
    const settingsMap: Record<string, any> = {};
    settings?.forEach(setting => {
      settingsMap[setting.setting_key] = setting.setting_value;
    });

    return NextResponse.json({
      success: true,
      settings: settingsMap,
      raw: settings || [],
    });

  } catch (error) {
    console.error('Get platform settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const db = adminClient as any;

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is platform admin
    const permissions = await getUserPermissions(user.id);
    if (!permissions.isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Platform admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { setting_key, setting_value, description } = body;

    if (!setting_key) {
      return NextResponse.json(
        { error: 'Missing setting_key' },
        { status: 400 }
      );
    }

    // Validate email forwarding domain format if that's what we're setting
    if (setting_key === 'email_forwarding_domain') {
      const domain = typeof setting_value === 'string' 
        ? setting_value 
        : setting_value?.domain || setting_value?.value;
      
      if (!domain || typeof domain !== 'string') {
        return NextResponse.json(
          { error: 'Invalid domain format' },
          { status: 400 }
        );
      }

      // Basic domain validation
      const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
      if (!domainRegex.test(domain)) {
        return NextResponse.json(
          { error: 'Invalid domain format. Must be a valid domain name (e.g., receipts.example.com)' },
          { status: 400 }
        );
      }
    }

    // Upsert setting (insert or update)
    const { data: setting, error: upsertError } = await db
      .from('platform_settings')
      .upsert({
        setting_key,
        setting_value: typeof setting_value === 'string' ? { value: setting_value } : setting_value,
        description: description || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'setting_key',
      })
      .select()
      .single() as { data: PlatformSetting | null; error: any };

    if (upsertError || !setting) {
      console.error('Error upserting platform setting:', upsertError);
      return NextResponse.json(
        { error: 'Failed to save platform setting', details: upsertError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      setting,
      message: 'Platform setting saved successfully',
    });

  } catch (error) {
    console.error('Post platform settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();
    const db = adminClient as any;

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is platform admin
    const permissions = await getUserPermissions(user.id);
    if (!permissions.isPlatformAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Platform admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { setting_key, setting_value, description } = body;

    if (!setting_key) {
      return NextResponse.json(
        { error: 'Missing setting_key' },
        { status: 400 }
      );
    }

    // Validate email forwarding domain format if that's what we're updating
    if (setting_key === 'email_forwarding_domain') {
      const domain = typeof setting_value === 'string' 
        ? setting_value 
        : setting_value?.domain || setting_value?.value;
      
      if (!domain || typeof domain !== 'string') {
        return NextResponse.json(
          { error: 'Invalid domain format' },
          { status: 400 }
        );
      }

      // Basic domain validation
      const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
      if (!domainRegex.test(domain)) {
        return NextResponse.json(
          { error: 'Invalid domain format. Must be a valid domain name (e.g., receipts.example.com)' },
          { status: 400 }
        );
      }
    }

    // Update setting
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (setting_value !== undefined) {
      updateData.setting_value = typeof setting_value === 'string' 
        ? { value: setting_value } 
        : setting_value;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    const { data: setting, error: updateError } = await db
      .from('platform_settings')
      .update(updateData)
      .eq('setting_key', setting_key)
      .select()
      .single() as { data: PlatformSetting | null; error: any };

    if (updateError || !setting) {
      console.error('Error updating platform setting:', updateError);
      return NextResponse.json(
        { error: 'Failed to update platform setting', details: updateError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      setting,
      message: 'Platform setting updated successfully',
    });

  } catch (error) {
    console.error('Patch platform settings error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

