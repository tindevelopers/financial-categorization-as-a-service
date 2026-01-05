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

async function checkRoles() {
  const { data: roles, error } = await supabase
    .from('roles')
    .select('name, id')
    .order('name');

  if (error) {
    console.error('❌ Error fetching roles:', error);
    return;
  }

  console.log('✅ Available roles:');
  roles?.forEach(r => console.log(`   - ${r.name} (${r.id})`));
  
  const orgAdmin = roles?.find(r => r.name === 'Organization Admin');
  if (!orgAdmin) {
    console.error('\n❌ "Organization Admin" role not found! This will cause signup to fail.');
  } else {
    console.log(`\n✅ "Organization Admin" role exists: ${orgAdmin.id}`);
  }
}

checkRoles().catch(console.error);


