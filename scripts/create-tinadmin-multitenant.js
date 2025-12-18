#!/usr/bin/env node

/**
 * Create TinAdmin Multi-Tenant - Turborepo Monorepo Starter
 * 
 * Creates a Turborepo monorepo structure with admin and portal apps
 * Suitable for complex multi-domain deployments
 * 
 * Usage: 
 *   npx create-tinadmin-multitenant@latest [project-name]
 * 
 * Examples:
 *   npx create-tinadmin-multitenant@latest my-platform
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const PROJECT_NAME = args[0] || 'tinadmin-platform';
const SHOW_HELP = args.includes('--help') || args.includes('-h');

function showHelp() {
  console.log(`
Create TinAdmin Multi-Tenant - Turborepo Monorepo Starter

Usage:
  npx create-tinadmin-multitenant@latest [project-name] [options]

Options:
  --help, -h           Show this help message

Examples:
  npx create-tinadmin-multitenant@latest my-platform

This creates a Turborepo monorepo with:
  ✅ apps/admin - Admin dashboard (admin.domain.com)
  ✅ apps/portal - Consumer portal (domain.com)
  ✅ packages/@tinadmin/core - Core modules
  ✅ packages/@tinadmin/ui-admin - Admin UI components
  ✅ packages/@tinadmin/ui-consumer - Consumer UI components
  ✅ Shared Supabase migrations
  ✅ Turborepo build pipeline
`);
}

if (SHOW_HELP) {
  showHelp();
  process.exit(0);
}

const OUTPUT_DIR = path.resolve(PROJECT_NAME);

function log(message, type = 'info') {
  const colors = {
    success: '\x1b[32m',
    error: '\x1b[31m',
    warning: '\x1b[33m',
    info: '\x1b[36m',
    reset: '\x1b[0m',
  };
  console.log(`${colors[type]}${message}${colors.reset}`);
}

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function copyFileOrDirectory(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDirectoryExists(dest);
    const files = fs.readdirSync(src);
    files.forEach((file) => {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      copyFileOrDirectory(srcPath, destPath);
    });
  } else {
    ensureDirectoryExists(path.dirname(dest));
    fs.copyFileSync(src, dest);
  }
}

function createRootPackageJson() {
  return {
    name: PROJECT_NAME,
    version: "1.0.0",
    private: true,
    description: "TinAdmin Multi-Tenant Platform - Turborepo Monorepo",
    scripts: {
      dev: "turbo run dev",
      build: "turbo run build",
      lint: "turbo run lint",
      "type-check": "turbo run type-check",
      clean: "turbo run clean",
    },
    devDependencies: {
      "turbo": "^2.0.0",
      "typescript": "^5.9.3",
    },
    packageManager: "pnpm@9.0.0",
    engines: {
      node: ">=20.0.0",
      pnpm: ">=9.0.0",
    },
  };
}

function createTurboJson() {
  return {
    "$schema": "https://turbo.build/schema.json",
    "globalDependencies": ["**/.env.*local"],
    "pipeline": {
      "build": {
        "dependsOn": ["^build"],
        "outputs": [".next/**", "!.next/cache/**", "dist/**"],
      },
      "dev": {
        "cache": false,
        "persistent": true,
      },
      "lint": {
        "dependsOn": ["^lint"],
      },
      "type-check": {
        "dependsOn": ["^type-check"],
      },
      "clean": {
        "cache": false,
      },
    },
  };
}

function createPnpmWorkspace() {
  return `packages:
  - 'apps/*'
  - 'packages/*'
`;
}

function createReadme() {
  return `# ${PROJECT_NAME}

TinAdmin Multi-Tenant Platform - Turborepo Monorepo

## Architecture

This is a Turborepo monorepo containing:

- **apps/admin** - Admin dashboard application (admin.domain.com)
- **apps/portal** - Consumer-facing portal (domain.com)
- **packages/@tinadmin/core** - Core SaaS modules
- **packages/@tinadmin/ui-admin** - Admin UI components
- **packages/@tinadmin/ui-consumer** - Consumer UI components
- **packages/@tinadmin/config** - Shared configuration

## Getting Started

\`\`\`bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and Stripe credentials

# Run all apps in development
pnpm dev

# Or run specific app
pnpm --filter @tinadmin/admin dev
pnpm --filter @tinadmin/portal dev
\`\`\`

## Building

\`\`\`bash
# Build all apps and packages
pnpm build

# Build specific app
pnpm --filter @tinadmin/admin build
pnpm --filter @tinadmin/portal build
\`\`\`

## Deployment

### Admin App (admin.domain.com)
Deploy \`apps/admin\` to your hosting platform and configure domain routing.

### Portal App (domain.com)
Deploy \`apps/portal\` to your hosting platform and configure domain routing.

## Documentation

See [TinAdmin Documentation](https://github.com/tindevelopers/tinadmin-saas-base) for more information.
`;
}

function createEnvExample() {
  return `# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe Configuration
STRIPE_SECRET_KEY=your_stripe_secret_key
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# Multi-Tenancy
NEXT_PUBLIC_MULTI_TENANT_ENABLED=true
NEXT_PUBLIC_TENANT_RESOLUTION=subdomain
NEXT_PUBLIC_BASE_DOMAIN=localhost:3000

# System Mode (multi-tenant or organization-only)
NEXT_PUBLIC_SYSTEM_MODE=multi-tenant

# Domain Configuration
NEXT_PUBLIC_ADMIN_DOMAIN=admin.localhost:3001
NEXT_PUBLIC_PORTAL_DOMAIN=localhost:3002
`;
}

function createProject() {
  log(`Creating TinAdmin Multi-Tenant platform: ${PROJECT_NAME}`, 'info');
  
  // Clean output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    log(`Removing existing directory: ${OUTPUT_DIR}`, 'warning');
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }

  ensureDirectoryExists(OUTPUT_DIR);
  log(`Created project directory: ${OUTPUT_DIR}`, 'success');

  // Create root package.json
  log('Creating root package.json...', 'info');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'package.json'),
    JSON.stringify(createRootPackageJson(), null, 2)
  );

  // Create turbo.json
  log('Creating turbo.json...', 'info');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'turbo.json'),
    JSON.stringify(createTurboJson(), null, 2)
  );

  // Create pnpm-workspace.yaml
  log('Creating pnpm-workspace.yaml...', 'info');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'pnpm-workspace.yaml'),
    createPnpmWorkspace()
  );

  // Create README.md
  log('Creating README.md...', 'info');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'README.md'),
    createReadme()
  );

  // Create .env.example
  log('Creating .env.example...', 'info');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, '.env.example'),
    createEnvExample()
  );

  // Create directory structure
  log('Creating directory structure...', 'info');
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'apps', 'admin', 'app'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'apps', 'portal', 'app'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'packages', '@tinadmin', 'core', 'src'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'packages', '@tinadmin', 'ui-admin', 'src'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'packages', '@tinadmin', 'ui-consumer', 'src'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'packages', '@tinadmin', 'config', 'src'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'supabase', 'migrations'));

  // Copy core package structure (reference only - will need to install from npm)
  log('Setting up package structure...', 'info');
  
  // Create placeholder package.json files
  const adminPackageJson = {
    name: "@tinadmin/admin",
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "next dev --port 3001",
      build: "next build",
      start: "next start --port 3001",
      lint: "next lint",
    },
    dependencies: {
      "@tinadmin/core": "workspace:*",
      "@tinadmin/ui-admin": "workspace:*",
      "@tinadmin/config": "workspace:*",
      "next": "^15.4.8",
      "react": "^19.2.3",
      "react-dom": "^19.2.3",
    },
  };

  const portalPackageJson = {
    name: "@tinadmin/portal",
    version: "1.0.0",
    private: true,
    scripts: {
      dev: "next dev --port 3002",
      build: "next build",
      start: "next start --port 3002",
      lint: "next lint",
    },
    dependencies: {
      "@tinadmin/core": "workspace:*",
      "@tinadmin/ui-consumer": "workspace:*",
      "@tinadmin/config": "workspace:*",
      "next": "^15.4.8",
      "react": "^19.2.3",
      "react-dom": "^19.2.3",
    },
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'apps', 'admin', 'package.json'),
    JSON.stringify(adminPackageJson, null, 2)
  );

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'apps', 'portal', 'package.json'),
    JSON.stringify(portalPackageJson, null, 2)
  );

  log('Created package structure', 'success');

  log(`\n✅ Monorepo created successfully!`, 'success');
  log(`\nNext steps:`, 'info');
  log(`  cd ${PROJECT_NAME}`, 'info');
  log(`  pnpm install`, 'info');
  log(`  cp .env.example .env.local`, 'info');
  log(`  # Edit .env.local with your credentials`, 'info');
  log(`  pnpm dev`, 'info');
  log(`\nNote: You'll need to copy the actual app code from the TinAdmin repository`, 'warning');
  log(`or install @tindeveloper/tinadmin-saas-base packages.`, 'warning');
}

// Run the script
try {
  createProject();
} catch (error) {
  log(`Error: ${error.message}`, 'error');
  process.exit(1);
}

