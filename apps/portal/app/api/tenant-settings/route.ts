/**
 * Tenant Settings API
 * 
 * GET - Retrieve the current user's tenant settings including subscription type
 */

import { createClient } from '@/lib/database/server';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's tenant
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.tenant_id) {
      // No tenant - return default individual settings
      return NextResponse.json({
        subscription_type: 'individual',
        tenant_id: null,
      });
    }

    // Get tenant settings including subscription type
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name, subscription_type, plan, status')
      .eq('id', userData.tenant_id)
      .single();

    if (tenantError) {
      console.error('Error fetching tenant:', tenantError);
      // Return default if we can't fetch tenant
      return NextResponse.json({
        subscription_type: 'individual',
        tenant_id: userData.tenant_id,
      });
    }

    return NextResponse.json({
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      subscription_type: tenant.subscription_type || 'individual',
      plan: tenant.plan,
      status: tenant.status,
    });

  } catch (error) {
    console.error('Error in GET /api/tenant-settings:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

