#!/usr/bin/env node

/**
 * TinAdmin Template Sync Script
 * 
 * Automates the process of extracting templates and syncing with standalone repositories
 * Usage: node scripts/sync-template.js [template-name] [options]
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  templates: {
    'ai-customer-care': {
      branch: 'ai-customer-care-bot',
      standaloneDir: 'ai-customer-care-standalone',
      remoteRepo: 'https://github.com/your-org/ai-customer-care-standalone.git'
    },
    'blog-writer': {
      branch: 'blog-writer-admin-panel',
      standaloneDir: 'blog-writer-standalone',
      remoteRepo: 'https://github.com/your-org/blog-writer-standalone.git'
    }
  }
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, options = {}) {
  try {
    return execSync(command, { 
      stdio: 'inherit', 
      encoding: 'utf8',
      ...options 
    });
  } catch (error) {
    log(`❌ Command failed: ${command}`, 'red');
    throw error;
  }
}

function checkGitStatus() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    if (status.trim()) {
      log('⚠️  Warning: You have uncommitted changes. Consider committing them first.', 'yellow');
      return false;
    }
    return true;
  } catch (error) {
    log('❌ Not a git repository or git not available', 'red');
    return false;
  }
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  } catch (error) {
    log('❌ Could not determine current branch', 'red');
    return null;
  }
}

function extractTemplate(templateName) {
  log(`🔄 Extracting ${templateName} template...`, 'cyan');
  
  try {
    exec(`node scripts/extract-template.js ${templateName}`);
    log(`✅ Template ${templateName} extracted successfully`, 'green');
    return true;
  } catch (error) {
    log(`❌ Failed to extract template ${templateName}`, 'red');
    return false;
  }
}

function syncStandaloneRepo(templateName, config) {
  const { standaloneDir, remoteRepo } = config;
  
  log(`🔄 Syncing standalone repository for ${templateName}...`, 'cyan');
  
  try {
    // Check if standalone directory exists
    if (!fs.existsSync(standaloneDir)) {
      log(`❌ Standalone directory ${standaloneDir} not found`, 'red');
      return false;
    }
    
    // Navigate to standalone directory
    process.chdir(standaloneDir);
    
    // Check if it's a git repository
    try {
      execSync('git status', { stdio: 'pipe' });
    } catch (error) {
      log(`🔄 Initializing git repository in ${standaloneDir}...`, 'yellow');
      exec('git init');
      exec(`git remote add origin ${remoteRepo}`);
    }
    
    // Add and commit changes
    exec('git add .');
    
    // Check if there are changes to commit
    try {
      execSync('git diff --cached --quiet', { stdio: 'pipe' });
      log('📝 No changes to commit', 'yellow');
    } catch (error) {
      const commitMessage = `sync: Update from main template ${new Date().toISOString()}`;
      exec(`git commit -m "${commitMessage}"`);
      log(`✅ Committed changes with message: ${commitMessage}`, 'green');
    }
    
    // Push to remote
    try {
      exec('git push origin main');
      log(`✅ Successfully pushed to ${remoteRepo}`, 'green');
    } catch (error) {
      log(`⚠️  Push failed. You may need to set up the remote repository first.`, 'yellow');
      log(`   Remote URL: ${remoteRepo}`, 'blue');
    }
    
    // Return to parent directory
    process.chdir('..');
    return true;
    
  } catch (error) {
    log(`❌ Failed to sync standalone repository`, 'red');
    // Return to parent directory
    process.chdir('..');
    return false;
  }
}

function showHelp() {
  log('TinAdmin Template Sync Script', 'bright');
  log('=====================================', 'bright');
  log('');
  log('Usage:', 'cyan');
  log('  node scripts/sync-template.js <template-name> [options]', 'blue');
  log('');
  log('Available templates:', 'cyan');
  Object.keys(CONFIG.templates).forEach(name => {
    const config = CONFIG.templates[name];
    log(`  - ${name} (branch: ${config.branch})`, 'blue');
  });
  log('');
  log('Options:', 'cyan');
  log('  --extract-only    Only extract template, do not sync', 'blue');
  log('  --sync-only       Only sync existing standalone, do not extract', 'blue');
  log('  --help           Show this help message', 'blue');
  log('');
  log('Examples:', 'cyan');
  log('  node scripts/sync-template.js ai-customer-care', 'blue');
  log('  node scripts/sync-template.js blog-writer --extract-only', 'blue');
  log('  node scripts/sync-template.js ai-customer-care --sync-only', 'blue');
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    showHelp();
    return;
  }
  
  const templateName = args[0];
  const extractOnly = args.includes('--extract-only');
  const syncOnly = args.includes('--sync-only');
  
  // Validate template name
  if (!CONFIG.templates[templateName]) {
    log(`❌ Unknown template: ${templateName}`, 'red');
    log('Available templates:', 'cyan');
    Object.keys(CONFIG.templates).forEach(name => {
      log(`  - ${name}`, 'blue');
    });
    process.exit(1);
  }
  
  const config = CONFIG.templates[templateName];
  
  log(`🚀 Starting sync process for ${templateName}`, 'bright');
  log(`📋 Configuration:`, 'cyan');
  log(`   Branch: ${config.branch}`, 'blue');
  log(`   Standalone Dir: ${config.standaloneDir}`, 'blue');
  log(`   Remote Repo: ${config.remoteRepo}`, 'blue');
  log('');
  
  // Check git status
  if (!checkGitStatus()) {
    log('⚠️  Proceeding with uncommitted changes...', 'yellow');
  }
  
  // Check current branch
  const currentBranch = getCurrentBranch();
  if (currentBranch && currentBranch !== config.branch) {
    log(`⚠️  Current branch (${currentBranch}) differs from template branch (${config.branch})`, 'yellow');
    log(`   Consider switching to ${config.branch} for best results`, 'blue');
  }
  
  let success = true;
  
  // Extract template
  if (!syncOnly) {
    success = extractTemplate(templateName);
    if (!success) {
      log('❌ Template extraction failed. Aborting sync.', 'red');
      process.exit(1);
    }
  }
  
  // Sync standalone repository
  if (!extractOnly) {
    success = syncStandaloneRepo(templateName, config);
    if (!success) {
      log('❌ Standalone sync failed.', 'red');
      process.exit(1);
    }
  }
  
  log('');
  log('🎉 Sync process completed successfully!', 'green');
  log('');
  log('Next steps:', 'cyan');
  log(`   1. Verify the standalone project in ./${config.standaloneDir}/`, 'blue');
  log(`   2. Test the standalone build: cd ${config.standaloneDir} && npm run build`, 'blue');
  log(`   3. Deploy if ready: cd ${config.standaloneDir} && vercel --prod`, 'blue');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  extractTemplate,
  syncStandaloneRepo,
  CONFIG
};
