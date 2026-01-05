#!/usr/bin/env npx tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function verifyAdmin() {
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('email, full_name, plan, status, role_id, tenant_id')
    .eq('email', 'systemadmin@tin.info')
    .single();

  if (userError || !user) {
    console.error('❌ User not found:', userError?.message);
    return;
  }

  console.log('✅ User found:');
  console.log('   Email:', user.email);
  console.log('   Name:', user.full_name);
  console.log('   Plan:', user.plan);
  console.log('   Status:', user.status);
  console.log('   Tenant ID:', user.tenant_id || 'NULL (Platform Admin)');

  const { data: role } = await supabase
    .from('roles')
    .select('name, permissions, coverage')
    .eq('id', user.role_id)
    .single();

  if (role) {
    console.log('\n✅ Role:');
    console.log('   Name:', role.name);
    console.log('   Coverage:', role.coverage);
    console.log('   Permissions:', role.permissions?.join(', ') || 'All (*)');
  }
}

verifyAdmin().catch(console.error);

