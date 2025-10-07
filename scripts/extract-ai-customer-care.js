#!/usr/bin/env node

/**
 * AI Customer Care Template Extraction Script
 * 
 * This script extracts the AI Customer Care template from the TinAdmin repository
 * and creates a standalone Next.js project with all necessary files and dependencies.
 * 
 * Usage: node scripts/extract-ai-customer-care.js [output-directory]
 * Example: node scripts/extract-ai-customer-care.js ./ai-customer-care-standalone
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const TEMPLATE_NAME = 'ai-customer-care';
const TEMPLATE_DISPLAY_NAME = 'AI Customer Care';
const OUTPUT_DIR = process.argv[2] || `./${TEMPLATE_NAME}-standalone`;

// Files and directories to copy
const FILES_TO_COPY = [
  // Core Next.js files
  'next.config.ts',
  'tsconfig.json',
  'postcss.config.mjs',
  'tailwind.config.ts',
  'eslint.config.mjs',
  
  // Package files
  'package.json',
  'package-lock.json',
  
  // Public assets
  'public/favicon.ico',
  'public/images',
  
  // Source structure
  'src/app/layout.tsx',
  'src/app/globals.css',
  'src/app/not-found.tsx',
  'src/app/loading.tsx',
  'src/context',
  'src/hooks',
  'src/utils',
  'src/svg.d.ts',
  
  // Template-specific files
  `src/app/templates/${TEMPLATE_NAME}`,
  `src/components/${TEMPLATE_NAME}`,
  'src/layout/AppSidebar.tsx',
  'src/layout/AppHeader.tsx',
  'src/layout/Backdrop.tsx',
  'src/layout/SidebarWidget.tsx',
  
  // Icons (we'll filter these)
  'src/icons',
  
  // Documentation
  'docs/MULTITENANT_ARCHITECTURE.md',
  `templates/${TEMPLATE_NAME}/template.config.json`,
];

// Files to create/modify
const FILES_TO_CREATE = [
  'src/app/page.tsx',
  'src/app/(admin)/layout.tsx',
  'src/app/(admin)/page.tsx',
  'README.md',
  'DEPLOYMENT.md',
];

// Dependencies to include (filtered from main package.json)
const REQUIRED_DEPENDENCIES = [
  'next@^15.5.4',
  'react@^19.0.0',
  'react-dom@^19.0.0',
  '@types/node@^22.0.0',
  '@types/react@^19.0.0',
  '@types/react-dom@^19.0.0',
  'typescript@^5.0.0',
  'tailwindcss@^4.0.0',
  'autoprefixer@^10.4.0',
  'postcss@^8.4.0',
  'eslint@^9.0.0',
  'eslint-config-next@^15.5.4',
  '@heroicons/react@^2.1.0',
  'clsx@^2.1.0',
  'tailwind-merge@^2.5.0',
  'lucide-react@^0.460.0',
  'recharts@^2.13.0',
];

const REQUIRED_DEV_DEPENDENCIES = [
  '@types/node@^22.0.0',
  '@types/react@^19.0.0',
  '@types/react-dom@^19.0.0',
  'typescript@^5.0.0',
  'eslint@^9.0.0',
  'eslint-config-next@^15.5.4',
];

// Icons to keep (only AI Customer Care related)
const ICONS_TO_KEEP = [
  'call-icon.svg',
  'chat.svg',
  'user-circle.svg',
  'user-line.svg',
  'calendar.svg',
  'time.svg',
  'eye.svg',
  'eye-close.svg',
  'check-circle.svg',
  'check-line.svg',
  'close.svg',
  'close-line.svg',
  'plus.svg',
  'pencil.svg',
  'trash.svg',
  'download.svg',
  'copy.svg',
  'arrow-up.svg',
  'arrow-down.svg',
  'arrow-right.svg',
  'angle-down.svg',
  'angle-up.svg',
  'angle-left.svg',
  'angle-right.svg',
  'chevron-down.svg',
  'chevron-left.svg',
  'chevron-up.svg',
  'horizontal-dots.svg',
  'grid.svg',
  'list.svg',
  'table.svg',
  'pie-chart.svg',
  'bolt.svg',
  'shooting-star.svg',
  'info.svg',
  'alert.svg',
  'lock.svg',
  'envelope.svg',
  'mail-line.svg',
  'docs.svg',
  'folder.svg',
  'file.svg',
  'page.svg',
  'group.svg',
  'box.svg',
  'box-cube.svg',
  'box-icon.svg',
  'box-line.svg',
  'box-tapped.svg',
  'truck-delivery.svg',
  'task.svg',
  'task-icon.svg',
  'audio.svg',
  'videos.svg',
];

class AICustomerCareExtractor {
  constructor() {
    this.rootDir = process.cwd();
    this.outputDir = path.resolve(this.rootDir, OUTPUT_DIR);
    this.errors = [];
  }

  log(message) {
    console.log(`[AI Customer Care Extractor] ${message}`);
  }

  error(message) {
    this.errors.push(message);
    console.error(`[ERROR] ${message}`);
  }

  async run() {
    try {
      this.log('Starting AI Customer Care template extraction...');
      
      // Step 1: Create output directory
      await this.createOutputDirectory();
      
      // Step 2: Copy files
      await this.copyFiles();
      
      // Step 3: Create template-specific files
      await this.createTemplateFiles();
      
      // Step 4: Generate package.json
      await this.generatePackageJson();
      
      // Step 5: Clean up unnecessary files
      await this.cleanupFiles();
      
      // Step 6: Initialize git repository
      await this.initializeGit();
      
      // Step 7: Install dependencies
      await this.installDependencies();
      
      this.log('✅ AI Customer Care template extraction completed successfully!');
      this.log(`📁 Output directory: ${this.outputDir}`);
      
      if (this.errors.length > 0) {
        this.log(`⚠️  ${this.errors.length} warnings occurred during extraction`);
        this.errors.forEach(error => this.log(`   - ${error}`));
      }
      
      this.printNextSteps();
      
    } catch (error) {
      this.error(`Extraction failed: ${error.message}`);
      process.exit(1);
    }
  }

  async createOutputDirectory() {
    this.log('Creating output directory...');
    
    if (fs.existsSync(this.outputDir)) {
      this.log(`Removing existing directory: ${this.outputDir}`);
      fs.rmSync(this.outputDir, { recursive: true, force: true });
    }
    
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  async copyFiles() {
    this.log('Copying files...');
    
    for (const filePath of FILES_TO_COPY) {
      const sourcePath = path.join(this.rootDir, filePath);
      const destPath = path.join(this.outputDir, filePath);
      
      if (!fs.existsSync(sourcePath)) {
        this.error(`Source file not found: ${filePath}`);
        continue;
      }
      
      try {
        const stat = fs.statSync(sourcePath);
        
        if (stat.isDirectory()) {
          this.copyDirectory(sourcePath, destPath);
        } else {
          this.copyFile(sourcePath, destPath);
        }
        
        this.log(`✓ Copied: ${filePath}`);
      } catch (error) {
        this.error(`Failed to copy ${filePath}: ${error.message}`);
      }
    }
  }

  copyFile(source, dest) {
    const destDir = path.dirname(dest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(source, dest);
  }

  copyDirectory(source, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const items = fs.readdirSync(source);
    
    for (const item of items) {
      const sourcePath = path.join(source, item);
      const destPath = path.join(dest, item);
      
      const stat = fs.statSync(sourcePath);
      
      if (stat.isDirectory()) {
        this.copyDirectory(sourcePath, destPath);
      } else {
        this.copyFile(sourcePath, destPath);
      }
    }
  }

  async createTemplateFiles() {
    this.log('Creating template-specific files...');
    
    // Create main page (redirects to AI Customer Care)
    const mainPageContent = `import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/templates/${TEMPLATE_NAME}');
}`;

    fs.writeFileSync(
      path.join(this.outputDir, 'src/app/page.tsx'),
      mainPageContent
    );

    // Create admin layout
    const adminLayoutContent = `import type { Metadata } from "next";
import AppSidebar from "@/layout/AppSidebar";
import AppHeader from "@/layout/AppHeader";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "${TEMPLATE_DISPLAY_NAME} Dashboard | TinAdmin",
  description: "Enterprise-grade admin platform for managing AI voice agents, chat conversations, and call analytics",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider>
      <SidebarProvider>
        <div className="flex h-screen overflow-hidden">
          <AppSidebar />
          <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
            <AppHeader />
            <main className="relative flex-1 overflow-y-auto p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}`;

    fs.mkdirSync(path.join(this.outputDir, 'src/app/(admin)'), { recursive: true });
    fs.writeFileSync(
      path.join(this.outputDir, 'src/app/(admin)/layout.tsx'),
      adminLayoutContent
    );

    // Create admin page (redirects to template)
    const adminPageContent = `import { redirect } from 'next/navigation';

export default function AdminPage() {
  redirect('/templates/${TEMPLATE_NAME}');
}`;

    fs.writeFileSync(
      path.join(this.outputDir, 'src/app/(admin)/page.tsx'),
      adminPageContent
    );

    // Create README
    const readmeContent = `# ${TEMPLATE_DISPLAY_NAME} Template

A standalone Next.js application for managing AI voice agents, chat conversations, and call analytics.

## Features

- 🤖 **AI Voice Agent Management** - Configure and manage AI voice agents
- 💬 **Chat Agent Management** - Set up and monitor chat conversations
- 📊 **Live Call Monitoring** - Real-time call supervision and intervention
- 📈 **Analytics & Reporting** - Comprehensive analytics and performance metrics
- 🔗 **Integration Hub** - Connect with CRMs, telephony providers, and business tools
- 📞 **Call Flow Builder** - Visual call flow creation and management
- 📚 **Knowledge Base** - Centralized content repository for agent training
- 🔐 **Quality Assurance** - Call evaluation and compliance monitoring
- 🏢 **Multi-tenant Support** - Manage multiple tenants and subtenants
- ⚙️ **System Settings** - Comprehensive configuration management
- 🔌 **API Playground** - Test and explore API endpoints

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0
- **UI Components**: Custom components with Heroicons
- **Charts**: Recharts for analytics visualization
- **State Management**: React Context API

## Quick Start

1. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

2. **Start development server**:
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

\`\`\`
src/
├── app/
│   ├── (admin)/
│   │   └── layout.tsx          # Admin layout wrapper
│   ├── templates/
│   │   └── ${TEMPLATE_NAME}/    # AI Customer Care pages
│   ├── globals.css             # Global styles
│   ├── layout.tsx              # Root layout
│   └── page.tsx                # Home page (redirects to template)
├── components/
│   └── ${TEMPLATE_NAME}/        # AI Customer Care components
├── context/                     # React contexts
├── hooks/                       # Custom hooks
├── icons/                       # SVG icons
├── layout/                      # Layout components
└── utils/                       # Utility functions
\`\`\`

## Available Scripts

- \`npm run dev\` - Start development server
- \`npm run build\` - Build for production
- \`npm run start\` - Start production server
- \`npm run lint\` - Run ESLint

## Deployment

This template is ready for deployment on any platform that supports Next.js:

- **Vercel** (recommended)
- **Netlify**
- **AWS Amplify**
- **Railway**
- **DigitalOcean App Platform**

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

## Customization

The template is fully customizable:

1. **Styling**: Modify Tailwind CSS classes or add custom styles
2. **Components**: Extend or modify components in \`src/components/${TEMPLATE_NAME}/\`
3. **Pages**: Add new pages in \`src/app/templates/${TEMPLATE_NAME}/\`
4. **Icons**: Add custom icons in \`src/icons/\`

## Support

For questions and support:

- 📧 Email: support@tinadmin.com
- 📚 Documentation: [docs.tinadmin.com](https://docs.tinadmin.com)
- 🐛 Issues: [GitHub Issues](https://github.com/tinadmin/tinadmin/issues)

## License

MIT License - see [LICENSE](./LICENSE) file for details.

---

Built with ❤️ using [TinAdmin](https://tinadmin.com)`;
    
    fs.writeFileSync(
      path.join(this.outputDir, 'README.md'),
      readmeContent
    );

    // Create deployment guide
    const deploymentContent = `# Deployment Guide - ${TEMPLATE_DISPLAY_NAME} Template

This guide covers deploying your AI Customer Care template to various platforms.

## Prerequisites

- Node.js 18+ installed
- Git repository set up
- Environment variables configured (if needed)

## Platform-Specific Deployment

### Vercel (Recommended)

1. **Connect your repository**:
   - Go to [vercel.com](https://vercel.com)
   - Import your Git repository
   - Vercel will auto-detect Next.js

2. **Configure build settings**:
   - Build Command: \`npm run build\`
   - Output Directory: \`.next\`
   - Install Command: \`npm install\`

3. **Deploy**:
   - Click "Deploy" and wait for completion
   - Your app will be available at \`your-app.vercel.app\`

### Netlify

1. **Build settings**:
   - Build Command: \`npm run build && npm run export\`
   - Publish Directory: \`out\`

2. **Add build script to package.json**:
   \`\`\`json
   {
     "scripts": {
       "export": "next export"
     }
   }
   \`\`\`

### AWS Amplify

1. **Connect repository**:
   - Go to AWS Amplify Console
   - Connect your Git repository

2. **Build settings**:
   - Build Command: \`npm run build\`
   - Base Directory: \`/\`
   - Output Directory: \`.next\`

### Railway

1. **Connect repository**:
   - Go to [railway.app](https://railway.app)
   - Deploy from Git repository

2. **Environment variables**:
   - Add any required environment variables
   - Railway will auto-detect Next.js

### DigitalOcean App Platform

1. **Create app**:
   - Go to DigitalOcean App Platform
   - Create new app from Git repository

2. **Configure**:
   - Build Command: \`npm run build\`
   - Run Command: \`npm start\`

## Environment Variables

If your app requires environment variables, create a \`.env.local\` file:

\`\`\`bash
# Example environment variables
NEXT_PUBLIC_API_URL=https://api.your-domain.com
DATABASE_URL=your-database-url
SECRET_KEY=your-secret-key
\`\`\`

## Production Optimization

1. **Enable compression**:
   \`\`\`javascript
   // next.config.ts
   module.exports = {
     compress: true,
     // ... other config
   };
   \`\`\`

2. **Optimize images**:
   - Use Next.js Image component
   - Enable image optimization

3. **Enable caching**:
   - Configure appropriate cache headers
   - Use CDN for static assets

## Monitoring

Consider setting up monitoring for production:

- **Error tracking**: Sentry, Bugsnag
- **Analytics**: Google Analytics, Mixpanel
- **Uptime monitoring**: UptimeRobot, Pingdom
- **Performance**: WebPageTest, Lighthouse

## Security

1. **HTTPS**: Ensure SSL certificate is configured
2. **Headers**: Set security headers
3. **Environment variables**: Never commit secrets
4. **Dependencies**: Keep dependencies updated

## Scaling

For high-traffic applications:

1. **Database**: Use managed database service
2. **CDN**: Enable CDN for static assets
3. **Caching**: Implement Redis or similar
4. **Load balancing**: Use multiple instances

## Troubleshooting

### Build Failures

- Check Node.js version compatibility
- Ensure all dependencies are installed
- Review build logs for specific errors

### Runtime Errors

- Check environment variables
- Verify database connections
- Review application logs

### Performance Issues

- Enable Next.js production optimizations
- Use performance monitoring tools
- Optimize images and assets

## Support

For deployment issues:

- 📧 Email: support@tinadmin.com
- 📚 Documentation: [docs.tinadmin.com](https://docs.tinadmin.com)
- 🐛 Issues: [GitHub Issues](https://github.com/tinadmin/tinadmin/issues)`;
    
    fs.writeFileSync(
      path.join(this.outputDir, 'DEPLOYMENT.md'),
      deploymentContent
    );
  }

  async generatePackageJson() {
    this.log('Generating package.json...');
    
    const packageJson = {
      name: `${TEMPLATE_NAME}-template`,
      version: "1.0.0",
      description: `Standalone ${TEMPLATE_DISPLAY_NAME} template built with Next.js 15 and Tailwind CSS`,
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
        "type-check": "tsc --noEmit"
      },
      dependencies: {},
      devDependencies: {},
      engines: {
        node: ">=18.0.0",
        npm: ">=8.0.0"
      },
      repository: {
        type: "git",
        url: "https://github.com/your-username/ai-customer-care-template.git"
      },
      keywords: [
        "nextjs",
        "react",
        "typescript",
        "tailwindcss",
        "admin-dashboard",
        "ai-customer-care",
        "voice-agents",
        "chat-agents",
        "call-analytics"
      ],
      author: "Your Name <your.email@example.com>",
      license: "MIT"
    };

    // Add dependencies
    REQUIRED_DEPENDENCIES.forEach(dep => {
      const [name, version] = dep.split('@');
      packageJson.dependencies[name] = version;
    });

    REQUIRED_DEV_DEPENDENCIES.forEach(dep => {
      const [name, version] = dep.split('@');
      packageJson.devDependencies[name] = version;
    });

    fs.writeFileSync(
      path.join(this.outputDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );
  }

  async cleanupFiles() {
    this.log('Cleaning up unnecessary files...');
    
    // Remove package-lock.json (will be regenerated)
    const packageLockPath = path.join(this.outputDir, 'package-lock.json');
    if (fs.existsSync(packageLockPath)) {
      fs.unlinkSync(packageLockPath);
    }

    // Remove .next directory if it exists
    const nextDir = path.join(this.outputDir, '.next');
    if (fs.existsSync(nextDir)) {
      fs.rmSync(nextDir, { recursive: true, force: true });
    }

    // Remove node_modules if it exists
    const nodeModulesDir = path.join(this.outputDir, 'node_modules');
    if (fs.existsSync(nodeModulesDir)) {
      fs.rmSync(nodeModulesDir, { recursive: true, force: true });
    }

    // Filter icons to keep only relevant ones
    await this.filterIcons();

    // Remove other template directories
    await this.removeOtherTemplates();
  }

  async filterIcons() {
    const iconsDir = path.join(this.outputDir, 'src/icons');
    if (!fs.existsSync(iconsDir)) return;

    const iconFiles = fs.readdirSync(iconsDir);
    
    for (const iconFile of iconFiles) {
      if (!ICONS_TO_KEEP.includes(iconFile)) {
        const iconPath = path.join(iconsDir, iconFile);
        fs.unlinkSync(iconPath);
        this.log(`Removed icon: ${iconFile}`);
      }
    }

    // Update icons index file
    const indexPath = path.join(iconsDir, 'index.tsx');
    if (fs.existsSync(indexPath)) {
      const indexContent = `// AI Customer Care Template Icons
// Auto-generated icon exports

${ICONS_TO_KEEP.map(icon => {
  const iconName = icon.replace('.svg', '').split('-').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join('');
  return `export { default as ${iconName}Icon } from './${icon}';`;
}).join('\n')}`;

      fs.writeFileSync(indexPath, indexContent);
    }
  }

  async removeOtherTemplates() {
    const templatesDir = path.join(this.outputDir, 'src/app/templates');
    if (!fs.existsSync(templatesDir)) return;

    const templateDirs = fs.readdirSync(templatesDir);
    
    for (const templateDir of templateDirs) {
      if (templateDir !== TEMPLATE_NAME) {
        const templatePath = path.join(templatesDir, templateDir);
        fs.rmSync(templatePath, { recursive: true, force: true });
        this.log(`Removed template: ${templateDir}`);
      }
    }

    // Remove other template components
    const componentsDir = path.join(this.outputDir, 'src/components');
    if (fs.existsSync(componentsDir)) {
      const componentDirs = fs.readdirSync(componentsDir);
      
      for (const componentDir of componentDirs) {
        if (componentDir !== TEMPLATE_NAME && 
            !['ui', 'common', 'form', 'charts'].includes(componentDir)) {
          const componentPath = path.join(componentsDir, componentDir);
          fs.rmSync(componentPath, { recursive: true, force: true });
          this.log(`Removed component directory: ${componentDir}`);
        }
      }
    }
  }

  async initializeGit() {
    this.log('Initializing Git repository...');
    
    try {
      execSync('git init', { cwd: this.outputDir, stdio: 'pipe' });
      
      // Create .gitignore
      const gitignoreContent = `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Next.js
.next/
out/
build/

# Production
dist/

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port`;
      
      fs.writeFileSync(
        path.join(this.outputDir, '.gitignore'),
        gitignoreContent
      );
      
      this.log('✓ Git repository initialized');
    } catch (error) {
      this.error(`Failed to initialize Git: ${error.message}`);
    }
  }

  async installDependencies() {
    this.log('Installing dependencies...');
    
    try {
      execSync('npm install', { 
        cwd: this.outputDir, 
        stdio: 'inherit',
        timeout: 300000 // 5 minutes timeout
      });
      
      this.log('✓ Dependencies installed successfully');
    } catch (error) {
      this.error(`Failed to install dependencies: ${error.message}`);
    }
  }

  printNextSteps() {
    console.log('\n🎉 AI Customer Care Template Extraction Complete!');
    console.log('\n📋 Next Steps:');
    console.log(`   1. cd ${OUTPUT_DIR}`);
    console.log('   2. npm run dev');
    console.log('   3. Open http://localhost:3000');
    console.log('\n🚀 Deployment Options:');
    console.log('   • Vercel: vercel --prod');
    console.log('   • Netlify: npm run build && npm run export');
    console.log('   • Railway: Connect GitHub repo');
    console.log('\n📚 Documentation:');
    console.log('   • README.md - Getting started guide');
    console.log('   • DEPLOYMENT.md - Deployment instructions');
    console.log('\n💡 Customization:');
    console.log('   • Modify components in src/components/ai-customer-care/');
    console.log('   • Add pages in src/app/templates/ai-customer-care/');
    console.log('   • Update styling with Tailwind CSS');
    console.log('\n🔧 Available Scripts:');
    console.log('   • npm run dev - Start development server');
    console.log('   • npm run build - Build for production');
    console.log('   • npm run start - Start production server');
    console.log('   • npm run lint - Run ESLint');
    console.log('   • npm run type-check - Run TypeScript checks');
  }
}

// Run the extraction
if (require.main === module) {
  const extractor = new AICustomerCareExtractor();
  extractor.run().catch(console.error);
}

module.exports = AICustomerCareExtractor;
