#!/usr/bin/env npx ts-node

/**
 * Create Platform Admin User Script
 * 
 * This script creates a platform administrator user in Supabase.
 * Platform admins have full access to the admin dashboard and can manage all tenants.
 * 
 * Usage:
 *   npx ts-node scripts/create-platform-admin.ts
 * 
 * Or with arguments:
 *   npx ts-node scripts/create-platform-admin.ts --email admin@example.com --password SecurePass123!
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

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

function parseArgs(): { email?: string; password?: string; name?: string } {
  const args: { email?: string; password?: string; name?: string } = {};
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

async function prompt(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (hidden) {
      process.stdout.write(question);
      let input = '';
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('data', (char) => {
        const c = char.toString();
        if (c === '\n' || c === '\r') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          console.log();
          rl.close();
          resolve(input);
        } else if (c === '\u0003') {
          process.exit();
        } else if (c === '\u007F') {
          input = input.slice(0, -1);
        } else {
          input += c;
        }
      });
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

async function ensurePlatformAdminRole(): Promise<string> {
  console.log('🔍 Checking for Platform Admin role...');
  
  // Check if role exists
  const { data: existingRole, error: checkError } = await supabase
    .from('roles')
    .select('id, name')
    .eq('name', 'Platform Admin')
    .single();

  if (existingRole) {
    console.log('✅ Platform Admin role exists:', existingRole.id);
    return existingRole.id;
  }

  // Create the role if it doesn't exist
  console.log('📝 Creating Platform Admin role...');
  const { data: newRole, error: createError } = await supabase
    .from('roles')
    .insert({
      name: 'Platform Admin',
      description: 'Full platform administrator with access to all features and tenants',
      coverage: 'platform',
      permissions: [
        'platform:manage',
        'tenants:read',
        'tenants:write',
        'tenants:delete',
        'users:read',
        'users:write',
        'users:delete',
        'settings:read',
        'settings:write',
        'billing:read',
        'billing:write',
        'integrations:manage',
        'reports:read',
        'reports:write',
      ],
    })
    .select('id')
    .single();

  if (createError) {
    console.error('❌ Failed to create Platform Admin role:', createError.message);
    throw createError;
  }

  console.log('✅ Platform Admin role created:', newRole.id);
  return newRole.id;
}

async function createPlatformAdmin(email: string, password: string, fullName: string) {
  console.log('\n🚀 Creating Platform Admin user...\n');

  try {
    // Step 1: Ensure Platform Admin role exists
    const roleId = await ensurePlatformAdminRole();

    // Step 2: Create auth user
    console.log('👤 Creating auth user...');
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
      },
    });

    if (authError) {
      if (authError.message.includes('already been registered')) {
        console.log('⚠️  User already exists in auth. Checking if they have a users record...');
        
        // Get existing user
        const { data: users } = await supabase.auth.admin.listUsers();
        const existingAuthUser = users.users.find(u => u.email === email);
        
        if (!existingAuthUser) {
          throw new Error('User exists but cannot be found');
        }

        // Check if user record exists
        const { data: existingUser } = await supabase
          .from('users')
          .select('id, role_id')
          .eq('id', existingAuthUser.id)
          .single();

        if (existingUser) {
          // Update to Platform Admin role
          console.log('📝 Updating existing user to Platform Admin role...');
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              role_id: roleId,
              tenant_id: null, // Platform admins have no tenant
            })
            .eq('id', existingAuthUser.id);

          if (updateError) {
            throw updateError;
          }

          console.log('\n✅ Successfully updated user to Platform Admin!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`   Email:    ${email}`);
          console.log(`   User ID:  ${existingAuthUser.id}`);
          console.log(`   Role:     Platform Admin`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          return;
        } else {
          // Create users record
          console.log('📝 Creating users record for existing auth user...');
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: existingAuthUser.id,
              email: email,
              full_name: fullName,
              role_id: roleId,
              tenant_id: null, // Platform admins have no tenant
            });

          if (insertError) {
            throw insertError;
          }

          console.log('\n✅ Successfully created Platform Admin!');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          console.log(`   Email:    ${email}`);
          console.log(`   User ID:  ${existingAuthUser.id}`);
          console.log(`   Role:     Platform Admin`);
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
          return;
        }
      }
      throw authError;
    }

    const userId = authData.user.id;
    console.log('✅ Auth user created:', userId);

    // Step 3: Create users record
    console.log('📝 Creating users record...');
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        full_name: fullName,
        role_id: roleId,
        tenant_id: null, // Platform admins have no tenant
      });

    if (userError) {
      console.error('❌ Failed to create users record:', userError.message);
      // Try to clean up auth user
      await supabase.auth.admin.deleteUser(userId);
      throw userError;
    }

    console.log('\n✅ Successfully created Platform Admin!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Email:    ${email}`);
    console.log(`   Password: ${'*'.repeat(password.length)}`);
    console.log(`   User ID:  ${userId}`);
    console.log(`   Role:     Platform Admin`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📌 You can now sign in at: http://localhost:3001/signin');

  } catch (error: any) {
    console.error('\n❌ Error creating Platform Admin:', error.message);
    process.exit(1);
  }
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
    password = await prompt('🔐 Password (min 8 chars): ', true);
  }

  if (!password || password.length < 8) {
    console.error('❌ Password must be at least 8 characters');
    process.exit(1);
  }

  await createPlatformAdmin(email, password, name);
}

main().catch(console.error);
