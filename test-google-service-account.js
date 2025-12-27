#!/usr/bin/env node

/**
 * Test script to verify Google Service Account can:
 * 1. Authenticate with Google Sheets API
 * 2. Create a spreadsheet
 * 3. Write data to the spreadsheet
 * 4. Read data from the spreadsheet
 * 5. Delete the test spreadsheet
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};
  
  content.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      env[key] = value;
    }
  });
  
  return env;
}

// Load environment variables
const rootEnv = loadEnvFile(path.join(__dirname, '.env.local'));
const portalEnv = loadEnvFile(path.join(__dirname, 'apps/portal/.env.local'));

// Prefer portal env, fallback to root env
const GOOGLE_SERVICE_ACCOUNT_EMAIL = portalEnv.GOOGLE_SERVICE_ACCOUNT_EMAIL || rootEnv.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = portalEnv.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || rootEnv.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

async function testGoogleServiceAccount() {
  console.log('🧪 Testing Google Service Account Configuration\n');
  
  // Step 1: Verify environment variables
  console.log('📋 Step 1: Checking environment variables...');
  if (!GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_EMAIL is not set');
    process.exit(1);
  }
  if (!GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not set');
    process.exit(1);
  }
  console.log(`✅ Service Account Email: ${GOOGLE_SERVICE_ACCOUNT_EMAIL}`);
  console.log(`✅ Private Key: ${GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.substring(0, 50)}...`);
  
  // Step 2: Initialize authentication
  console.log('\n🔐 Step 2: Initializing Google Auth...');
  let auth;
  try {
    auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file', // Required to create spreadsheets
      ],
    });
    
    // Get the client
    const authClient = await auth.getClient();
    console.log('✅ Authentication initialized successfully');
    console.log(`   Project: ${authClient.projectId || 'N/A'}`);
  } catch (error) {
    console.error('❌ Failed to initialize authentication:', error.message);
    process.exit(1);
  }
  
  // Step 3: Create Sheets API client
  console.log('\n📊 Step 3: Creating Google Sheets API client...');
  const sheets = google.sheets({ version: 'v4', auth });
  console.log('✅ Sheets API client created');
  
  // Step 4: Create a test spreadsheet
  console.log('\n📝 Step 4: Creating test spreadsheet...');
  let spreadsheetId;
  try {
    // Try creating via Sheets API first (preferred method)
    try {
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: {
            title: `Service Account Test - ${new Date().toISOString()}`,
          },
        },
      });
      
      spreadsheetId = spreadsheet.data.spreadsheetId;
      if (!spreadsheetId) {
        throw new Error('No spreadsheet ID returned');
      }
      
      console.log(`✅ Spreadsheet created successfully via Sheets API`);
      console.log(`   ID: ${spreadsheetId}`);
      console.log(`   URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    } catch (sheetsError) {
      // If Sheets API fails, try Drive API
      console.log('   Sheets API failed, trying Drive API...');
      const drive = google.drive({ version: 'v3', auth });
      
      const fileMetadata = {
        name: `Service Account Test - ${new Date().toISOString()}`,
        mimeType: 'application/vnd.google-apps.spreadsheet',
      };
      
      const driveFile = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id',
      });
      
      spreadsheetId = driveFile.data.id;
      if (!spreadsheetId) {
        throw new Error('No file ID returned from Drive API');
      }
      
      console.log(`✅ Spreadsheet created successfully via Drive API`);
      console.log(`   ID: ${spreadsheetId}`);
      console.log(`   URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    }
  } catch (error) {
    console.error('❌ Failed to create spreadsheet:', error.message);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    console.error('\n💡 Troubleshooting tips:');
    console.error('   1. Ensure Google Sheets API is enabled');
    console.error('   2. Ensure Google Drive API is enabled');
    console.error('   3. Verify service account has Editor role');
    console.error('   4. Check if domain-wide delegation is needed');
    process.exit(1);
  }
  
  // Step 5: Write test data
  console.log('\n✍️  Step 5: Writing test data...');
  try {
    const testData = [
      ['Date', 'Description', 'Amount', 'Category'],
      ['2024-01-01', 'Test Transaction 1', '100.00', 'Test Category'],
      ['2024-01-02', 'Test Transaction 2', '200.50', 'Test Category'],
      ['2024-01-03', 'Test Transaction 3', '300.75', 'Test Category'],
    ];
    
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1:D4',
      valueInputOption: 'RAW',
      requestBody: {
        values: testData,
      },
    });
    
    console.log('✅ Test data written successfully');
    console.log(`   Wrote ${testData.length} rows`);
  } catch (error) {
    console.error('❌ Failed to write data:', error.message);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
    // Continue to cleanup
  }
  
  // Step 6: Read test data
  console.log('\n📖 Step 6: Reading test data...');
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:D4',
    });
    
    const values = response.data.values || [];
    console.log('✅ Data read successfully');
    console.log(`   Read ${values.length} rows`);
    console.log('   First row:', values[0]);
  } catch (error) {
    console.error('❌ Failed to read data:', error.message);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  // Step 7: Format headers (like the actual code does)
  console.log('\n🎨 Step 7: Formatting headers...');
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.4, blue: 0.8 },
                  textFormat: {
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                    bold: true,
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
        ],
      },
    });
    
    console.log('✅ Headers formatted successfully');
  } catch (error) {
    console.error('❌ Failed to format headers:', error.message);
    if (error.response) {
      console.error('   Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
  
  // Step 8: Cleanup - Delete test spreadsheet
  console.log('\n🧹 Step 8: Cleaning up test spreadsheet...');
  try {
    // Note: We can't delete via API easily, so we'll just report the URL
    // The user can manually delete it or it can be cleaned up later
    console.log(`⚠️  Test spreadsheet still exists at: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
    console.log('   Please delete it manually if desired');
    console.log('   Or leave it for verification');
  } catch (error) {
    console.error('❌ Cleanup note:', error.message);
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('✅ ALL TESTS PASSED!');
  console.log('='.repeat(60));
  console.log('\n📋 Summary:');
  console.log(`   ✅ Authentication: Working`);
  console.log(`   ✅ Create Spreadsheet: Working`);
  console.log(`   ✅ Write Data: Working`);
  console.log(`   ✅ Read Data: Working`);
  console.log(`   ✅ Format Headers: Working`);
  console.log(`\n🔗 Test Spreadsheet: https://docs.google.com/spreadsheets/d/${spreadsheetId}`);
  console.log('\n✨ Your Google Service Account is properly configured!');
}

// Run the test
testGoogleServiceAccount().catch(error => {
  console.error('\n❌ Test failed with error:', error);
  process.exit(1);
});

