#!/usr/bin/env node

/**
 * Template Extraction Wrapper Script
 * 
 * This script provides a simple interface for extracting templates.
 * 
 * Usage: node scripts/extract-template.js <template-name> [output-directory]
 * 
 * Available templates:
 * - ai-customer-care
 * 
 * Examples:
 * node scripts/extract-template.js ai-customer-care
 * node scripts/extract-template.js ai-customer-care ./my-ai-app
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AVAILABLE_TEMPLATES = {
  'ai-customer-care': 'AI Customer Care Template - Enterprise-grade admin platform for managing AI voice agents, chat conversations, and call analytics'
};

function printUsage() {
  console.log('Template Extraction Script');
  console.log('');
  console.log('Usage: node scripts/extract-template.js <template-name> [output-directory]');
  console.log('');
  console.log('Available templates:');
  Object.entries(AVAILABLE_TEMPLATES).forEach(([name, description]) => {
    console.log(`  ${name.padEnd(20)} - ${description}`);
  });
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/extract-template.js ai-customer-care');
  console.log('  node scripts/extract-template.js ai-customer-care ./my-ai-app');
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  const templateName = args[0];
  const outputDir = args[1];
  
  if (!AVAILABLE_TEMPLATES[templateName]) {
    console.error(`❌ Unknown template: ${templateName}`);
    console.error('');
    printUsage();
    process.exit(1);
  }
  
  console.log(`🚀 Extracting ${AVAILABLE_TEMPLATES[templateName]}...`);
  console.log('');
  
  try {
    if (templateName === 'ai-customer-care') {
      const extractorPath = path.join(__dirname, 'extract-ai-customer-care.js');
      const command = `node "${extractorPath}"${outputDir ? ` "${outputDir}"` : ''}`;
      
      console.log(`Running: ${command}`);
      execSync(command, { stdio: 'inherit' });
    } else {
      console.error(`❌ Template extraction not implemented for: ${templateName}`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Extraction failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
