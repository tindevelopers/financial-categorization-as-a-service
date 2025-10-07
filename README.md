# TinAdmin Master Admin Panel V1.0

> **Modern, responsive, and customizable admin dashboard templates built with Tailwind CSS and Next.js**

TinAdmin provides industry-specific dashboard templates that you can install and customize in minutes. Perfect for developers who need beautiful, functional dashboards quickly.

## 🚀 Quick Start

### Install Any Template Instantly

```bash
# E-commerce Dashboard
npx create-tinadmin@latest ecommerce my-store

# Healthcare Management  
npx create-tinadmin@latest healthcare my-clinic

# Financial Dashboard
npx create-tinadmin@latest finance my-finance-app

# Education Platform
npx create-tinadmin@latest education my-school

# SaaS Application
npx create-tinadmin@latest saas my-saas-app
```

### Interactive Installation
```bash
# Run without template name to see all options
npx create-tinadmin@latest
```

## 🎯 Available Templates

| Template | Industry | Key Features | Use Cases |
|----------|----------|--------------|-----------|
| **🛒 E-commerce** | Online Retail | Products, Orders, Customers, Analytics | Online stores, marketplaces, retail |
| **🏥 Healthcare** | Medical | Patients, Appointments, Records, Billing | Clinics, hospitals, telemedicine |
| **💰 Finance** | Financial Services | Transactions, Accounts, Reports, Budgeting | Banks, fintech, accounting |
| **🎓 Education** | Educational | Students, Courses, Grades, Attendance | Schools, universities, online learning |
| **💼 SaaS** | Software Services | Users, Subscriptions, Analytics, Billing | B2B software, subscription platforms |

## 📚 Documentation

- [📖 **User Guide**](docs/USER_GUIDE.md) - Complete installation and customization guide
- [👨‍💻 **Developer Guide**](docs/DEVELOPER_GUIDE.md) - Advanced development and template creation
- [🏗️ **Template System**](DEVELOPMENT.md) - Multi-template architecture overview
- [🚀 **Live Demo**](https://tinadmin-demo.vercel.app) - See templates in action

## ⚡ Features

- **🎨 Modern Design** - Beautiful, responsive UI with dark/light themes
- **⚡ Fast Performance** - Built with Next.js 15 and optimized for speed
- **📱 Mobile-First** - Perfect experience on all devices
- **🔧 Easy Customization** - Tailwind CSS for rapid styling
- **📊 Rich Components** - Charts, tables, forms, and more
- **🔒 TypeScript** - Full type safety and better development experience
- **📦 NPM Packages** - Install templates as NPM packages
- **🚀 One-Click Deploy** - Deploy to Vercel, Netlify, or any platform

## 🛠️ Development

### For Users
```bash
# Install and customize templates
npx create-tinadmin@latest [template-name] [project-name]
cd [project-name]
npm run dev
```

### For Developers

#### Multi-Template Development
```bash
# Clone and develop
git clone https://github.com/tindevelopers/tinadmin-master-admin-panel.git
cd tinadmin-master-admin-panel
npm install
npm run dev

# Create new templates
npm run template:create [template-name]
```

#### Template Extraction & Standalone Development

**Extract Template to Standalone Project:**
```bash
# Extract AI Customer Care template
node scripts/extract-template.js ai-customer-care

# This creates: ./ai-customer-care-standalone/
cd ai-customer-care-standalone/
npm run dev
```

**Create Independent Repository:**
```bash
cd ai-customer-care-standalone/
git init
git remote add origin https://github.com/your-org/ai-customer-care-standalone.git
git add .
git commit -m "Initial AI Customer Care standalone template"
git push -u origin main
```

#### Continued Development Workflow

**Option 1: Re-extract After Major Updates**
```bash
# 1. Update main template
git checkout ai-customer-care-bot
# ... make changes to templates/ and src/components/
git add . && git commit -m "feat: Add new features"
git push origin ai-customer-care-bot

# 2. Re-extract to standalone
node scripts/extract-template.js ai-customer-care

# 3. Update standalone repo
cd ai-customer-care-standalone/
git add . && git commit -m "feat: Update with latest features"
git push origin main
```

**Option 2: Direct Standalone Development**
```bash
# Develop directly in standalone project
cd ai-customer-care-standalone/
# ... make changes
git add . && git commit -m "feat: Add new feature"
git push origin main

# Periodically sync back to main template
```

#### Available Templates & Branches

| Template | Branch | Status | Standalone |
|----------|--------|--------|------------|
| **🤖 AI Customer Care** | `ai-customer-care-bot` | ✅ Active | ✅ Extracted |
| **📝 Blog Writer** | `blog-writer-admin-panel` | ✅ Active | ⏳ Pending |
| **🛒 E-commerce** | `main` | ✅ Active | ⏳ Pending |
| **🏥 Healthcare** | `main` | ✅ Active | ⏳ Pending |
| **💰 Finance** | `main` | ✅ Active | ⏳ Pending |

#### CI/CD & Deployment

**Automated Pipeline:**
- ✅ **GitHub Actions** - Automated testing and building
- ✅ **Template Extraction** - Automatic standalone project generation
- ✅ **Retry Logic** - Network timeout handling with 3-attempt retry
- ✅ **Enhanced Caching** - npm dependency caching for faster builds
- ✅ **Multi-Environment** - Test, staging, and production deployments

**Deployment Options:**
```bash
# Vercel (Recommended)
vercel --prod

# Netlify
npm run build && npm run export

# Docker
docker build -t tinadmin-template .
docker run -p 3000:3000 tinadmin-template

# Railway
railway deploy
```

**Monitor CI/CD:**
- **GitHub Actions**: https://github.com/tindevelopers/tinadmin-master-admin-panel/actions
- **Template Status**: Check individual template extraction jobs
- **Build Artifacts**: Download extracted templates from Actions

## Installation

### Prerequisites

To get started with TinAdmin Master Admin Panel, ensure you have the following prerequisites installed and set up:

- Node.js 18.x or later (recommended to use Node.js 20.x or later)

### Getting Started

1. Install dependencies:

   ```bash
   npm install
   # or
   yarn install
   ```

   > Use `--legacy-peer-deps` flag if you face peer-dependency error during installation.

2. Start the development server:
   ```bash
   npm run dev
   # or
   yarn dev
   ```

## Changelog

### Version 2.2.0 - [July 30, 2025]

* Fixed reported minor bugs and UI issues
* Updated packages
#### 🧭 **Logistics Dashboard** – *Added*

* Redesigned logistics dashboard interface
* Delivery activity table
* Delivery tracking timeline
* Total revenue earned chart

#### 🛍️ **E-commerce Pages** – *Added*

* **Products**:

  * Product list table
  * Add product form
* **Invoices**:

  * Invoice list table
  * Single invoice view
  * View invoice modal
  * Create invoice form
* **Transactions**:

  * Transaction list table
  * Single transaction detail view

#### 🧠 **AI Assistant Suite (New App Example)** – *Newly Added*

* Text generator
* Image generator
* Code generator
* Video generator

#### 🔑 **API Key Management** – *Newly Added*

* API key dashboard
* API key table view
* Add API key modal

#### 🔌 **Integrations (Pages)** – *Newly Added*

* Integration cards UI
* Integration details modal
* Add integration modal
* Integration settings modal
* Delete integration confirmation modal

### ⚙️ **Support (New App Example)** – *Newly Added*

* Support ticket list page
* Support ticket reply interface

#### 📊 **Charts & Visuals** - *Imporoved*

* New bar chart design added

### Version 2.1.2 - [Jun 02, 2025]

#### Update Overview

- Basic Table 3 Dropdown (cropped) update
- Popover and Tooltip component overflow (cropped) issue update

### Version 2.1.1 - [March 25, 2025]

- Updated to Next v15.2.3 for [CVE-2025-29927](https://nextjs.org/blog/cve-2025-29927) concerns
- Included overrides vectormaps for packages to prevent peer dependency errors during installation.
- Migrated from react-flatpickr to flatpickr package for React 19 support

### Version 2.1.0 - [March 10, 2025]

#### Update Overview

- Added new dashboard design for saas product.
- New Metrics card
- Product performance tab with charts

### Version 2.0.1 - [February 27, 2025]

#### Update Overview

- Upgraded to Tailwind CSS v4 for better performance and efficiency.
- Updated class usage to match the latest syntax and features.
- Replaced deprecated class and optimized styles.

#### Next Steps

- Run npm install or yarn install to update dependencies.
- Check for any style changes or compatibility issues.
- Refer to the Tailwind CSS v4 [Migration Guide](https://tailwindcss.com/docs/upgrade-guide) on this release. if needed.
- This update keeps the project up to date with the latest Tailwind improvements. 🚀

### v2.0.0 (February 2025)

A major update focused on Next.js 15 implementation and comprehensive redesign.

#### Major Improvements

- Complete redesign using Next.js 15 App Router and React Server Components
- Enhanced user interface with Next.js-optimized components
- Improved responsiveness and accessibility
- New features including collapsible sidebar, chat screens, and calendar
- Redesigned authentication using Next.js App Router and server actions
- Updated data visualization using ApexCharts for React

#### Breaking Changes

- Migrated from Next.js 14 to Next.js 15
- Chart components now use ApexCharts for React
- Authentication flow updated to use Server Actions and middleware

#### Breaking Changes

- Migrated from Next.js 14 to Next.js 15
- Chart components now use ApexCharts for React
- Authentication flow updated to use Server Actions and middleware

[Read more](https://tailadmin.com/docs/update-logs/nextjs) on this release.

### v1.3.4 (July 01, 2024)

- Fixed JSvectormap rendering issues

### v1.3.3 (June 20, 2024)

- Fixed build error related to Loader component

### v1.3.2 (June 19, 2024)

- Added ClickOutside component for dropdown menus
- Refactored sidebar components
- Updated Jsvectormap package

### v1.3.1 (Feb 12, 2024)

- Fixed layout naming consistency
- Updated styles

### v1.3.0 (Feb 05, 2024)

- Upgraded to Next.js 14
- Added Flatpickr integration
- Improved form elements
- Enhanced multiselect functionality
- Added default layout component

## License

Refer to our [LICENSE](https://tailadmin.com/license) page for more information.
