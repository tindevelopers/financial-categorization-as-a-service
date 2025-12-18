#!/usr/bin/env node

/**
 * Create TinAdmin SaaS - Simple Single-Repo Installer
 * 
 * Creates a single-repo Next.js application with admin and consumer routes
 * Suitable for simple deployments and MVPs
 * 
 * Usage: 
 *   npx create-tinadmin-saas@latest [project-name]
 * 
 * Examples:
 *   npx create-tinadmin-saas@latest my-saas-app
 *   npx create-tinadmin-saas@latest my-saas-app --typescript
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Parse command line arguments
const args = process.argv.slice(2);
const PROJECT_NAME = args[0] || 'tinadmin-saas-app';
const USE_TYPESCRIPT = args.includes('--typescript') || args.includes('--ts');
const SHOW_HELP = args.includes('--help') || args.includes('-h');

function showHelp() {
  console.log(`
Create TinAdmin SaaS - Simple Single-Repo Installer

Usage:
  npx create-tinadmin-saas@latest [project-name] [options]

Options:
  --typescript, --ts    Use TypeScript (default: true)
  --help, -h           Show this help message

Examples:
  npx create-tinadmin-saas@latest my-saas-app
  npx create-tinadmin-saas@latest my-saas-app --typescript

This creates a single-repo Next.js application with:
  ✅ Admin routes at /admin/*
  ✅ Consumer routes at /*
  ✅ Multi-tenancy support
  ✅ Stripe billing integration
  ✅ Role-based access control
  ✅ All core modules included
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

function createPackageJson() {
  return {
    name: PROJECT_NAME,
    version: "1.0.0",
    private: true,
    description: "TinAdmin SaaS application - Single repo deployment",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
      "type-check": "tsc --noEmit",
    },
    dependencies: {
      "@tindeveloper/tinadmin-saas-base": "^1.0.0",
      "next": "^15.4.8",
      "react": "^19.2.3",
      "react-dom": "^19.2.3",
    },
    devDependencies: {
      "@types/node": "^20",
      "@types/react": "^19.2.7",
      "@types/react-dom": "^19.2.3",
      "typescript": "^5.9.3",
      "eslint": "^9",
      "eslint-config-next": "15.1.3",
    },
  };
}

function createReadme() {
  return `# ${PROJECT_NAME}

TinAdmin SaaS Application - Single Repo Deployment

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase and Stripe credentials

# Run development server
npm run dev
\`\`\`

## Project Structure

\`\`\`
${PROJECT_NAME}/
├── src/
│   ├── app/
│   │   ├── (admin)/      # Admin routes - /admin/*
│   │   ├── (consumer)/  # Consumer routes - /*
│   │   └── api/         # API routes
│   ├── components/      # React components
│   └── core/            # Core modules (from @tindeveloper/tinadmin-saas-base)
├── public/              # Static assets
└── supabase/            # Database migrations
\`\`\`

## Features

- ✅ Multi-tenant support
- ✅ Admin dashboard
- ✅ Consumer-facing portal
- ✅ Stripe billing integration
- ✅ Role-based access control
- ✅ CRM functionality

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
`;
}

function createProject() {
  log(`Creating TinAdmin SaaS application: ${PROJECT_NAME}`, 'info');
  
  // Clean output directory
  if (fs.existsSync(OUTPUT_DIR)) {
    log(`Removing existing directory: ${OUTPUT_DIR}`, 'warning');
    fs.rmSync(OUTPUT_DIR, { recursive: true });
  }

  ensureDirectoryExists(OUTPUT_DIR);
  log(`Created project directory: ${OUTPUT_DIR}`, 'success');

  // Create package.json
  log('Creating package.json...', 'info');
  const packageJson = createPackageJson();
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );
  log('Created package.json', 'success');

  // Create README.md
  log('Creating README.md...', 'info');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'README.md'),
    createReadme()
  );
  log('Created README.md', 'success');

  // Create .env.example
  log('Creating .env.example...', 'info');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, '.env.example'),
    createEnvExample()
  );
  log('Created .env.example', 'success');

  // Create basic Next.js structure
  log('Creating Next.js structure...', 'info');
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'src', 'app'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'src', 'app', '(admin)'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'src', 'app', '(consumer)'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'src', 'app', 'api'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'public'));
  ensureDirectoryExists(path.join(OUTPUT_DIR, 'supabase', 'migrations'));

  // Create basic app layout
  const appLayout = `import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TenantProvider, OrganizationProvider } from "@tindeveloper/tinadmin-saas-base/core/multi-tenancy";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "${PROJECT_NAME}",
  description: "TinAdmin SaaS application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <TenantProvider>
          <OrganizationProvider>
            {children}
          </OrganizationProvider>
        </TenantProvider>
      </body>
    </html>
  );
}`;

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'src', 'app', 'layout.tsx'),
    appLayout
  );

  // Create globals.css
  const globalsCss = `@tailwind base;
@tailwind components;
@tailwind utilities;`;

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'src', 'app', 'globals.css'),
    globalsCss
  );

  // Create basic page
  const homePage = `export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to ${PROJECT_NAME}</h1>
        <p className="text-lg text-gray-600">
          Your TinAdmin SaaS application is ready!
        </p>
      </div>
    </div>
  );
}`;

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'src', 'app', '(consumer)', 'page.tsx'),
    homePage
  );

  // Create next.config.ts
  const nextConfig = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ["@tindeveloper/tinadmin-saas-base"],
  },
};

export default nextConfig;`;

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'next.config.ts'),
    nextConfig
  );

  // Create tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: {
        "@/*": ["./src/*"],
      },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2)
  );

  log('Created Next.js structure', 'success');

  log(`\n✅ Project created successfully!`, 'success');
  log(`\nNext steps:`, 'info');
  log(`  cd ${PROJECT_NAME}`, 'info');
  log(`  npm install`, 'info');
  log(`  cp .env.example .env.local`, 'info');
  log(`  # Edit .env.local with your credentials`, 'info');
  log(`  npm run dev`, 'info');
}

// Run the script
try {
  createProject();
} catch (error) {
  log(`Error: ${error.message}`, 'error');
  process.exit(1);
}

