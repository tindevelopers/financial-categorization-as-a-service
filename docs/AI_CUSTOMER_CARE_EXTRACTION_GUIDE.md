# AI Customer Care Template Extraction Guide

## Overview

This guide provides step-by-step instructions for extracting the AI Customer Care template from the TinAdmin repository and creating a standalone Next.js project ready for deployment or NPM publishing.

## Quick Start

### Option 1: Automated Extraction (Recommended)

Run the extraction script to automatically create a standalone project:

```bash
# Extract to default directory (./ai-customer-care-standalone)
node scripts/extract-template.js ai-customer-care

# Extract to custom directory
node scripts/extract-template.js ai-customer-care ./my-ai-call-center
```

### Option 2: Manual Extraction

Follow the manual steps below if you prefer more control over the process.

## What Gets Extracted

The extraction script creates a complete standalone Next.js application with:

### ✅ Included Files
- **Core Next.js files**: `next.config.ts`, `tsconfig.json`, `package.json`
- **AI Customer Care pages**: All 15+ pages in `/templates/ai-customer-care/`
- **AI Customer Care components**: All 50+ components in `/components/ai-customer-care/`
- **Layout components**: Modified sidebar with only AI Customer Care navigation
- **Required dependencies**: Filtered `package.json` with only necessary packages
- **Documentation**: README.md and DEPLOYMENT.md
- **Icons**: Only relevant icons (call, chat, user, etc.)
- **Styling**: Tailwind CSS configuration and global styles

### ❌ Excluded Files
- Other template pages (ecommerce, blog-writer, etc.)
- Other template components
- Unused icons and assets
- Development-specific files
- Multi-template navigation

## Project Structure After Extraction

```
ai-customer-care-standalone/
├── src/
│   ├── app/
│   │   ├── (admin)/
│   │   │   ├── layout.tsx          # Admin layout wrapper
│   │   │   └── page.tsx            # Redirects to AI Customer Care
│   │   ├── templates/
│   │   │   └── ai-customer-care/   # All AI Customer Care pages
│   │   │       ├── page.tsx        # Dashboard
│   │   │       ├── agents/
│   │   │       │   ├── voice/
│   │   │       │   └── chat/
│   │   │       ├── analytics/
│   │   │       ├── calls/
│   │   │       │   └── history/
│   │   │       ├── flows/
│   │   │       ├── integrations/
│   │   │       ├── knowledge/
│   │   │       ├── monitoring/
│   │   │       ├── numbers/
│   │   │       ├── quality/
│   │   │       ├── settings/
│   │   │       ├── api-playground/
│   │   │       ├── tenant-settings/
│   │   │       └── webhooks/
│   │   ├── globals.css             # Global styles
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Home (redirects to template)
│   ├── components/
│   │   └── ai-customer-care/       # All AI Customer Care components
│   │       ├── RealTimeMetrics.tsx
│   │       ├── LiveCallMonitoring.tsx
│   │       ├── VoiceAgentList.tsx
│   │       ├── ChatAgentList.tsx
│   │       ├── AnalyticsOverview.tsx
│   │       ├── CallHistoryTable.tsx
│   │       ├── KnowledgeBaseContent.tsx
│   │       ├── IntegrationsOverview.tsx
│   │       ├── WebhookConfiguration.tsx
│   │       ├── PhoneNumbersList.tsx
│   │       ├── QualityMetrics.tsx
│   │       ├── TenantManagement.tsx
│   │       └── ... (50+ more components)
│   ├── context/                    # React contexts
│   ├── hooks/                      # Custom hooks
│   ├── icons/                      # Filtered icons only
│   ├── layout/                     # Layout components
│   └── utils/                      # Utility functions
├── public/
│   └── images/                     # Public assets
├── docs/
│   └── MULTITENANT_ARCHITECTURE.md # Architecture documentation
├── templates/
│   └── ai-customer-care/
│       └── template.config.json    # Template configuration
├── package.json                    # Clean dependencies
├── next.config.ts                  # Next.js configuration
├── tsconfig.json                   # TypeScript configuration
├── tailwind.config.ts              # Tailwind CSS configuration
├── README.md                       # Project documentation
├── DEPLOYMENT.md                   # Deployment guide
└── .gitignore                      # Git ignore rules
```

## Features Included

### 🤖 AI Agent Management
- Voice agent configuration and management
- Chat agent setup and monitoring
- LLM configuration and testing
- Agent performance tracking

### 📊 Analytics & Monitoring
- Real-time call monitoring
- Live agent status overview
- Call volume analytics
- Performance metrics dashboard
- Quality assurance tools

### 📞 Call Management
- Call flow builder
- Call history and recordings
- Phone number management
- Webhook configuration
- Integration hub

### 🏢 Multi-tenant Support
- Tenant management
- Subtenant configuration
- Billing and usage tracking
- Security settings
- Tenant analytics

### ⚙️ System Administration
- API playground
- System settings
- Knowledge base management
- User and role management
- Quality assurance tools

## Dependencies Included

### Core Dependencies
- `next@^15.5.4` - Next.js framework
- `react@^19.0.0` - React library
- `typescript@^5.0.0` - TypeScript support
- `tailwindcss@^4.0.0` - Styling framework

### UI & Icons
- `@heroicons/react@^2.1.0` - Icon library
- `lucide-react@^0.460.0` - Additional icons
- `clsx@^2.1.0` - CSS class utilities
- `tailwind-merge@^2.5.0` - Tailwind class merging

### Charts & Visualization
- `recharts@^2.13.0` - Chart library for analytics

### Development Dependencies
- `@types/node@^22.0.0` - Node.js types
- `@types/react@^19.0.0` - React types
- `eslint@^9.0.0` - Code linting
- `eslint-config-next@^15.5.4` - Next.js ESLint config

## Manual Extraction Steps

If you prefer to extract manually or need to customize the process:

### 1. Create New Project

```bash
# Create new Next.js project
npx create-next-app@latest ai-customer-care-standalone --typescript --tailwind --eslint --app

# Navigate to project
cd ai-customer-care-standalone
```

### 2. Copy Template Files

```bash
# Copy AI Customer Care pages
cp -r ../tinadmin-master-admin-panel/src/app/templates/ai-customer-care ./src/app/templates/

# Copy AI Customer Care components
cp -r ../tinadmin-master-admin-panel/src/components/ai-customer-care ./src/components/

# Copy layout components
cp ../tinadmin-master-admin-panel/src/layout/* ./src/layout/

# Copy context and hooks
cp -r ../tinadmin-master-admin-panel/src/context ./src/
cp -r ../tinadmin-master-admin-panel/src/hooks ./src/
cp -r ../tinadmin-master-admin-panel/src/utils ./src/
```

### 3. Update Configuration Files

#### package.json
```json
{
  "name": "ai-customer-care-template",
  "version": "1.0.0",
  "description": "AI Customer Care template built with Next.js 15",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.5.4",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@heroicons/react": "^2.1.0",
    "recharts": "^2.13.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.5.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "eslint": "^9.0.0",
    "eslint-config-next": "^15.5.4"
  }
}
```

#### src/app/page.tsx
```tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/templates/ai-customer-care');
}
```

#### src/app/(admin)/layout.tsx
```tsx
import type { Metadata } from "next";
import AppSidebar from "@/layout/AppSidebar";
import AppHeader from "@/layout/AppHeader";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "AI Customer Care Dashboard | TinAdmin",
  description: "Enterprise-grade admin platform for managing AI voice agents",
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
}
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Test the Application

```bash
npm run dev
```

Visit `http://localhost:3000` to see your standalone AI Customer Care template.

## Publishing to NPM

### 1. Prepare for Publishing

```bash
# Update package.json with publishing details
npm init -y

# Add repository and keywords
npm pkg set repository.url="https://github.com/your-username/ai-customer-care-template.git"
npm pkg set keywords="['nextjs', 'react', 'typescript', 'tailwindcss', 'ai-customer-care']"
npm pkg set author="Your Name <your.email@example.com>"
npm pkg set license="MIT"
```

### 2. Build and Test

```bash
# Build the project
npm run build

# Test the build
npm run start
```

### 3. Publish to NPM

```bash
# Login to NPM (if not already logged in)
npm login

# Publish the package
npm publish

# Or publish with specific tag
npm publish --tag beta
```

### 4. Usage as NPM Package

Users can then install and use your template:

```bash
# Install the template
npm install @your-org/ai-customer-care-template

# Use in their project
import { AICustomerCareDashboard } from '@your-org/ai-customer-care-template';
```

## Deployment Options

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

### Netlify

```bash
# Build for static export
npm run build
npm run export

# Deploy to Netlify
# Upload the 'out' directory
```

### Docker

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
```

## Customization

### Adding New Features

1. **New Pages**: Add to `src/app/templates/ai-customer-care/`
2. **New Components**: Add to `src/components/ai-customer-care/`
3. **Styling**: Modify Tailwind classes or add custom CSS
4. **Navigation**: Update `src/layout/AppSidebar.tsx`

### Theming

Customize the theme by modifying:

- `tailwind.config.ts` - Color palette and design tokens
- `src/app/globals.css` - Global styles
- Component-specific Tailwind classes

### Integration

Connect to your backend by:

1. Creating API utilities in `src/utils/`
2. Adding environment variables for API endpoints
3. Implementing data fetching in components
4. Adding authentication/authorization

## Troubleshooting

### Common Issues

1. **Build Errors**: Check TypeScript types and imports
2. **Missing Dependencies**: Run `npm install` to ensure all packages are installed
3. **Routing Issues**: Verify file structure matches Next.js App Router conventions
4. **Styling Problems**: Check Tailwind CSS configuration and class names

### Getting Help

- 📧 Email: support@tinadmin.com
- 📚 Documentation: [docs.tinadmin.com](https://docs.tinadmin.com)
- 🐛 Issues: [GitHub Issues](https://github.com/tinadmin/tinadmin/issues)

## Next Steps

After extraction, consider:

1. **Customization**: Modify components and styling to match your brand
2. **Backend Integration**: Connect to your API and database
3. **Authentication**: Add user authentication and authorization
4. **Testing**: Add unit and integration tests
5. **Documentation**: Update README with your specific setup instructions
6. **CI/CD**: Set up automated testing and deployment

---

**Ready to extract your AI Customer Care template? Run the extraction script and start building! 🚀**
