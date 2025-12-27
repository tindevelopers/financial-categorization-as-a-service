#!/usr/bin/env tsx
/**
 * Script to set missing environment variables in Vercel
 */

import { execSync } from 'child_process';
import * as fs from 'fs';

// Values from preview environment (to copy to development)
const PREVIEW_VALUES = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://firwcvlikjltikdrmejq.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcndjdmxpa2psdGlrZHJtZWpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzcwMjcsImV4cCI6MjA4MTY1MzAyN30.5jevl52dLOCjUEAC-AtE6sI5V56pA2WjQoPfz998GiQ',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpcndjdmxpa2psdGlrZHJtZWpxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjA3NzAyNywiZXhwIjoyMDgxNjUzMDI3fQ.qjC4TsUy8miK8zTRedMcENnSrGdkDBZo-7VFX3_Ubkg',
};

// App URLs for each environment
const APP_URLS = {
  development: 'https://fincat.develop.tinconnect.com',
  preview: 'https://financial-categorization-as-a-service-git-develop-tindeveloper.vercel.app',
  production: 'https://fincat.tinconnect.com',
};

function setEnvVar(name: string, value: string, environment: string) {
  console.log(`Setting ${name} for ${environment}...`);
  try {
    // Use echo to pipe the value to vercel env add
    execSync(`echo "${value}" | vercel env add ${name} ${environment}`, {
      stdio: 'inherit',
    });
    console.log(`✅ Set ${name} for ${environment}`);
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log(`⚠️  ${name} already exists for ${environment}, skipping...`);
    } else {
      console.error(`❌ Error setting ${name} for ${environment}:`, error.message);
      throw error;
    }
  }
}

function main() {
  console.log('🔧 Setting missing environment variables in Vercel...\n');

  // Set Supabase variables for development (copy from preview)
  console.log('📦 Copying Supabase variables to development environment...\n');
  setEnvVar('NEXT_PUBLIC_SUPABASE_URL', PREVIEW_VALUES.NEXT_PUBLIC_SUPABASE_URL, 'development');
  setEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', PREVIEW_VALUES.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'development');
  setEnvVar('SUPABASE_SERVICE_ROLE_KEY', PREVIEW_VALUES.SUPABASE_SERVICE_ROLE_KEY, 'development');

  // Set NEXT_PUBLIC_APP_URL for development and production
  console.log('\n🌐 Setting NEXT_PUBLIC_APP_URL...\n');
  setEnvVar('NEXT_PUBLIC_APP_URL', APP_URLS.development, 'development');
  setEnvVar('NEXT_PUBLIC_APP_URL', APP_URLS.production, 'production');
  
  // Set GOOGLE_SHEETS_REDIRECT_URI for development
  console.log('\n🔗 Setting GOOGLE_SHEETS_REDIRECT_URI for development...\n');
  setEnvVar('GOOGLE_SHEETS_REDIRECT_URI', `${APP_URLS.development}/api/integrations/google-sheets/callback`, 'development');

  console.log('\n✨ Done! All missing environment variables have been set.');
  console.log('\n📋 Summary:');
  console.log('  ✅ NEXT_PUBLIC_SUPABASE_URL - set for development');
  console.log('  ✅ NEXT_PUBLIC_SUPABASE_ANON_KEY - set for development');
  console.log('  ✅ SUPABASE_SERVICE_ROLE_KEY - set for development');
  console.log('  ✅ NEXT_PUBLIC_APP_URL - set for development and production');
  console.log('  ✅ GOOGLE_SHEETS_REDIRECT_URI - set for development');
}

main();

