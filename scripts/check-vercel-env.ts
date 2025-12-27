#!/usr/bin/env tsx
/**
 * Script to check and ensure all required environment variables are set in Vercel
 * for both development and production environments
 */

import { execSync } from 'child_process';

const REQUIRED_ENV_VARS = {
  // Supabase (Required)
  NEXT_PUBLIC_SUPABASE_URL: {
    required: true,
    environments: ['development', 'preview', 'production'],
    description: 'Supabase project URL',
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    required: true,
    environments: ['development', 'preview', 'production'],
    description: 'Supabase anonymous key',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    required: true,
    environments: ['development', 'preview', 'production'],
    description: 'Supabase service role key',
  },
  // Google OAuth (Required)
  GOOGLE_CLIENT_ID: {
    required: true,
    environments: ['development', 'preview', 'production'],
    description: 'Google OAuth client ID',
  },
  GOOGLE_CLIENT_SECRET: {
    required: true,
    environments: ['development', 'preview', 'production'],
    description: 'Google OAuth client secret',
  },
  GOOGLE_REDIRECT_URI: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Google OAuth redirect URI (can use GOOGLE_SHEETS_REDIRECT_URI instead)',
    alternative: 'GOOGLE_SHEETS_REDIRECT_URI',
  },
  GOOGLE_SHEETS_REDIRECT_URI: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Google Sheets OAuth redirect URI',
  },
  // Google Cloud (Required for Invoice OCR)
  GOOGLE_CLOUD_PROJECT_ID: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Google Cloud project ID (required for Document AI OCR)',
  },
  GOOGLE_CLOUD_LOCATION: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Google Cloud location (defaults to "us")',
    defaultValue: 'us',
  },
  GOOGLE_DOCUMENT_AI_PROCESSOR_ID: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Google Document AI processor ID (required for OCR)',
  },
  GOOGLE_APPLICATION_CREDENTIALS: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Path to Google service account JSON (or use GOOGLE_APPLICATION_CREDENTIALS_JSON)',
    alternative: 'GOOGLE_APPLICATION_CREDENTIALS_JSON',
  },
  GOOGLE_APPLICATION_CREDENTIALS_JSON: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Base64 encoded Google service account JSON',
  },
  // Google Service Account (Required for Corporate Google Sheets Export)
  GOOGLE_SERVICE_ACCOUNT_EMAIL: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Google service account email',
  },
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Google service account private key',
  },
  // Dropbox OAuth (Required for Cloud Storage)
  DROPBOX_APP_KEY: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Dropbox OAuth app key',
  },
  DROPBOX_APP_SECRET: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Dropbox OAuth app secret',
  },
  DROPBOX_REDIRECT_URI: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Dropbox OAuth redirect URI',
  },
  // AI Categorization
  USE_AI_CATEGORIZATION: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Enable AI categorization',
    defaultValue: 'true',
  },
  AI_CATEGORIZATION_PROVIDER: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'AI categorization provider',
    defaultValue: 'vercel_ai_gateway',
  },
  AI_GATEWAY_API_KEY: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Vercel AI Gateway API key',
  },
  VERCEL_AI_GATEWAY_API_KEY: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'Vercel AI Gateway API key (alternative name)',
  },
  OPENAI_API_KEY: {
    required: false,
    environments: ['development', 'preview', 'production'],
    description: 'OpenAI API key (if using OpenAI directly)',
  },
  // Encryption
  ENCRYPTION_KEY: {
    required: true,
    environments: ['development', 'preview', 'production'],
    description: '32-byte hex encryption key for OAuth token storage',
  },
  // App URL
  NEXT_PUBLIC_APP_URL: {
    required: true,
    environments: ['development', 'preview', 'production'],
    description: 'Public app URL for OAuth redirects',
  },
};

interface EnvVarStatus {
  name: string;
  development: boolean;
  preview: boolean;
  production: boolean;
}

function getCurrentEnvVars(): EnvVarStatus[] {
  try {
    const output = execSync('vercel env ls', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const lines = output.split('\n');
    const envVarsMap = new Map<string, EnvVarStatus>();
    let inTable = false;
    
    // Parse the output (skip header lines)
    for (const line of lines) {
      // Skip Vercel CLI header lines
      if (line.includes('Vercel CLI') || line.includes('Retrieving project') || line.includes('Environment Variables found')) {
        continue;
      }
      if (line.includes('Common next commands')) break;
      
      // Detect table start
      if (line.includes('name') && line.includes('environments')) {
        inTable = true;
        continue;
      }
      
      if (!inTable || !line.trim()) continue;
      
      // Parse line: name value environments created
      // Example: "GOOGLE_CLIENT_ID                   Encrypted           Development                         4d ago"
      // Split by multiple spaces (2+)
      const parts = line.split(/\s{2,}/).filter(p => p.trim());
      if (parts.length >= 3) {
        const name = parts[0].trim();
        const environment = parts[2].trim();
        
        if (!envVarsMap.has(name)) {
          envVarsMap.set(name, {
            name,
            development: false,
            preview: false,
            production: false,
          });
        }
        
        const envVar = envVarsMap.get(name)!;
        if (environment === 'Development') envVar.development = true;
        if (environment === 'Preview') envVar.preview = true;
        if (environment === 'Production') envVar.production = true;
      }
    }
    
    return Array.from(envVarsMap.values());
  } catch (error) {
    console.error('Error fetching environment variables:', error);
    return [];
  }
}

function checkEnvVar(
  varName: string,
  currentVars: EnvVarStatus[],
  env: 'development' | 'preview' | 'production'
): boolean {
  const current = currentVars.find(v => v.name === varName);
  if (!current) return false;
  
  switch (env) {
    case 'development':
      return current.development;
    case 'preview':
      return current.preview;
    case 'production':
      return current.production;
  }
}

function main() {
  console.log('🔍 Checking Vercel environment variables...\n');
  
  const currentVars = getCurrentEnvVars();
  const environments: Array<'development' | 'preview' | 'production'> = [
    'development',
    'preview',
    'production',
  ];
  
  const missing: Record<string, string[]> = {};
  const present: Record<string, string[]> = {};
  
  for (const [varName, config] of Object.entries(REQUIRED_ENV_VARS)) {
    const missingEnvs: string[] = [];
    const presentEnvs: string[] = [];
    
    for (const env of config.environments) {
      const isPresent = checkEnvVar(varName, currentVars, env);
      
      // Check for alternative names
      let found = isPresent;
      if (!found && config.alternative) {
        found = checkEnvVar(config.alternative, currentVars, env);
      }
      
      if (found) {
        presentEnvs.push(env);
      } else if (config.required) {
        missingEnvs.push(env);
      }
    }
    
    if (missingEnvs.length > 0) {
      missing[varName] = missingEnvs;
    }
    if (presentEnvs.length > 0) {
      present[varName] = presentEnvs;
    }
  }
  
  // Print results
  console.log('✅ Present Environment Variables:\n');
  for (const [varName, envs] of Object.entries(present)) {
    const config = REQUIRED_ENV_VARS[varName as keyof typeof REQUIRED_ENV_VARS];
    console.log(`  ${varName}`);
    console.log(`    Environments: ${envs.join(', ')}`);
    console.log(`    Description: ${config.description}`);
    if (config.alternative) {
      console.log(`    Alternative: ${config.alternative}`);
    }
    console.log('');
  }
  
  console.log('\n❌ Missing Required Environment Variables:\n');
  const requiredMissing: string[] = [];
  const optionalMissing: string[] = [];
  
  for (const [varName, envs] of Object.entries(missing)) {
    const config = REQUIRED_ENV_VARS[varName as keyof typeof REQUIRED_ENV_VARS];
    console.log(`  ${varName}`);
    console.log(`    Missing in: ${envs.join(', ')}`);
    console.log(`    Description: ${config.description}`);
    if (config.defaultValue) {
      console.log(`    Default: ${config.defaultValue}`);
    }
    if (config.alternative) {
      console.log(`    Alternative: ${config.alternative}`);
    }
    console.log('');
    
    if (config.required) {
      requiredMissing.push(varName);
    } else {
      optionalMissing.push(varName);
    }
  }
  
  if (requiredMissing.length === 0 && optionalMissing.length === 0) {
    console.log('✨ All required environment variables are set!\n');
  } else {
    console.log('\n📝 Summary:');
    console.log(`  Required missing: ${requiredMissing.length}`);
    console.log(`  Optional missing: ${optionalMissing.length}`);
    console.log('\n💡 To add missing variables, use:');
    console.log('   vercel env add <VAR_NAME> <environment>');
    console.log('\n   Example:');
    console.log('   vercel env add NEXT_PUBLIC_SUPABASE_URL development');
  }
}

main();

