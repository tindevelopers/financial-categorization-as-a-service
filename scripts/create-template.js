#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Template Generator Script
 * Creates new industry-specific templates from the base template
 */

const templates = {
  ecommerce: {
    name: 'TinAdmin E-commerce',
    description: 'E-commerce dashboard template',
    features: ['products', 'orders', 'customers', 'analytics'],
    colors: {
      primary: '#3B82F6',
      secondary: '#10B981'
    }
  },
  healthcare: {
    name: 'TinAdmin Healthcare',
    description: 'Healthcare management dashboard',
    features: ['patients', 'appointments', 'medical-records', 'billing'],
    colors: {
      primary: '#059669',
      secondary: '#0EA5E9'
    }
  },
  finance: {
    name: 'TinAdmin Finance',
    description: 'Financial dashboard template',
    features: ['transactions', 'accounts', 'reports', 'budgeting'],
    colors: {
      primary: '#7C3AED',
      secondary: '#F59E0B'
    }
  },
  education: {
    name: 'TinAdmin Education',
    description: 'Educational institution dashboard',
    features: ['students', 'courses', 'grades', 'attendance'],
    colors: {
      primary: '#DC2626',
      secondary: '#EA580C'
    }
  },
  saas: {
    name: 'TinAdmin SaaS',
    description: 'SaaS application dashboard',
    features: ['users', 'subscriptions', 'analytics', 'billing'],
    colors: {
      primary: '#8B5CF6',
      secondary: '#06B6D4'
    }
  },
  'blog-writer': {
    name: 'TinAdmin Blog Writer',
    description: 'Marketing dashboard for small business client management, social media, email marketing, and appointment booking',
    features: ['client-management', 'social-media', 'email-marketing', 'appointment-booking', 'content-creation'],
    colors: {
      primary: '#F59E0B',
      secondary: '#EF4444'
    }
  },
  'ai-customer-care': {
    name: 'TinAdmin AI Customer Care',
    description: 'Enterprise-grade admin platform for managing AI voice agents, chat conversations, call analytics, and omnichannel customer interactions',
    features: ['voice-agent-management', 'chat-agent-management', 'call-analytics', 'live-monitoring', 'analytics-reporting', 'integration-hub'],
    colors: {
      primary: '#4F46E5',
      secondary: '#06B6D4'
    }
  }
};

function createTemplate(templateType) {
  const template = templates[templateType];
  
  if (!template) {
    console.error(`❌ Template "${templateType}" not found. Available templates:`, Object.keys(templates));
    process.exit(1);
  }

  console.log(`🚀 Creating ${template.name} template...`);

  // Create template directory structure
  const templateDir = path.join(__dirname, '..', 'templates', templateType);
  
  if (!fs.existsSync(templateDir)) {
    fs.mkdirSync(templateDir, { recursive: true });
  }

  // Copy base template files
  copyTemplateFiles(templateDir, template);
  
  // Generate template-specific configuration
  generateTemplateConfig(templateDir, template);
  
  console.log(`✅ ${template.name} template created successfully!`);
  console.log(`📁 Location: ${templateDir}`);
}

function copyTemplateFiles(templateDir, template) {
  const baseDir = path.join(__dirname, '..', 'src');
  const templateSrcDir = path.join(templateDir, 'src');
  
  // Copy source files (you can customize this based on your needs)
  if (!fs.existsSync(templateSrcDir)) {
    fs.mkdirSync(templateSrcDir, { recursive: true });
  }
  
  // Copy specific components based on template features
  template.features.forEach(feature => {
    const featureDir = path.join(templateSrcDir, 'components', feature);
    if (!fs.existsSync(featureDir)) {
      fs.mkdirSync(featureDir, { recursive: true });
    }
  });
}

function generateTemplateConfig(templateDir, template) {
  const config = {
    name: template.name,
    description: template.description,
    version: '1.0.0',
    features: template.features,
    theme: {
      colors: template.colors
    },
    dependencies: {
      // Template-specific dependencies
    }
  };

  fs.writeFileSync(
    path.join(templateDir, 'template.config.json'),
    JSON.stringify(config, null, 2)
  );
}

// CLI usage
const templateType = process.argv[2];
if (!templateType) {
  console.log('Usage: node create-template.js <template-type>');
  console.log('Available templates:', Object.keys(templates).join(', '));
  process.exit(1);
}

createTemplate(templateType);
