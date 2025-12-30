#!/usr/bin/env node

/**
 * Create Platform Admin User Script (Auth Only)
 * 
 * This script creates a platform administrator user in Supabase Auth.
 * Due to PostgREST schema cache issues, it only creates the auth user.
 * The users table record will be created automatically on first login
 * via a database trigger, or you can run the SQL migration manually.
 * 
 * Usage:
 *   node scripts/create-platform-admin-auth-only.js --email admin@example.com --password SecurePass123!
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing environment variables. Please set:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--email' && argv[i + 1]) {
      args.email = argv[++i];
    } else if (argv[i] === '--password' && argv[i + 1]) {
      args.password = argv[++i];
    } else if (argv[i] === '--name' && argv[i + 1]) {
      args.name = argv[++i];
    }
  }
  
  return args;
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function createPlatformAdmin(email, password, fullName) {
  console.log('\n🚀 Creating Platform Admin user in Auth...\n');

  try {
    // Create auth user with platform_admin flag in metadata
    console.log('👤 Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        is_platform_admin: true, // Flag for platform admin
      },
      app_metadata: {
        role: 'platform_admin',
        provider: 'email',
      },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('⚠️  User already exists. Updating metadata...');
        
        // Get existing user
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingUser = users.users.find(u => u.email === email);
        
        if (!existingUser) {
          throw new Error('User exists but cannot be found');
        }

        // Update user metadata
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingUser.id,
          {
            user_metadata: {
              full_name: fullName,
              is_platform_admin: true,
            },
            app_metadata: {
              role: 'platform_admin',
              provider: 'email',
            },
          }
        );

        if (updateError) {
          throw updateError;
        }

        console.log('\n✅ Successfully updated user to Platform Admin!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`   Email:    ${email}`);
        console.log(`   User ID:  ${existingUser.id}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        printSqlInstructions(existingUser.id, email, fullName);
        return;
      }
      throw authError;
    }

    const userId = authData.user.id;
    console.log('✅ Auth user created:', userId);

    console.log('\n✅ Successfully created Platform Admin auth user!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${'*'.repeat(password.length)}`);
    console.log(`   User ID:  ${userId}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    printSqlInstructions(userId, email, fullName);

  } catch (error) {
    console.error('\n❌ Error creating Platform Admin:', error.message);
    process.exit(1);
  }
}

function printSqlInstructions(userId, email, fullName) {
  console.log('\n📋 NEXT STEP: Run this SQL in Supabase Dashboard → SQL Editor:\n');
  console.log('─'.repeat(60));
  console.log(`
-- First, ensure the Platform Admin role exists
INSERT INTO public.roles (name, description, coverage, permissions)
VALUES (
  'Platform Admin',
  'Full platform administrator with access to all features',
  'platform',
  ARRAY['platform:manage', 'tenants:read', 'tenants:write', 'users:read', 'users:write', 'settings:read', 'settings:write']
)
ON CONFLICT (name) DO NOTHING;

-- Then create the users record for the platform admin
INSERT INTO public.users (id, email, full_name, role_id, tenant_id)
SELECT 
  '${userId}'::uuid,
  '${email}',
  '${fullName}',
  r.id,
  NULL  -- Platform admins have no tenant
FROM public.roles r
WHERE r.name = 'Platform Admin'
ON CONFLICT (id) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  tenant_id = NULL;
`);
  console.log('─'.repeat(60));
  console.log('\n📌 After running the SQL, sign in at: http://localhost:3001/signin');
}

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║     Create Platform Admin User            ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  const args = parseArgs();

  let email = args.email;
  let password = args.password;
  let name = args.name;

  // Interactive prompts if not provided via args
  if (!email) {
    email = await prompt('📧 Email address: ');
  }

  if (!email || !email.includes('@')) {
    console.error('❌ Invalid email address');
    process.exit(1);
  }

  if (!name) {
    name = await prompt('👤 Full name: ');
  }

  if (!name) {
    name = 'Platform Administrator';
  }

  if (!password) {
    password = await prompt('🔐 Password (min 8 chars): ');
  }

  if (!password || password.length < 8) {
    console.error('❌ Password must be at least 8 characters');
    process.exit(1);
  }

  await createPlatformAdmin(email, password, name);
}

main().catch(console.error);

