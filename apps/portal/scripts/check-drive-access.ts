import { google } from 'googleapis';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkDriveAccess() {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  
  if (!serviceAccountEmail || !privateKey) {
    console.log('Service account credentials not found in env');
    console.log('GOOGLE_SERVICE_ACCOUNT_EMAIL:', !!serviceAccountEmail);
    console.log('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:', !!privateKey);
    return;
  }
  
  console.log('Service Account Email:', serviceAccountEmail);
  
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccountEmail,
      private_key: privateKey.replace(/\\n/g, '\n'),
    },
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
    ],
  });
  
  const drive = google.drive({ version: 'v3', auth });
  
  try {
    console.log('\n--- Checking Shared Drives ---');
    const sharedDrives = await drive.drives.list({ pageSize: 10 });
    
    if (sharedDrives.data.drives && sharedDrives.data.drives.length > 0) {
      console.log('Shared drives accessible:');
      sharedDrives.data.drives.forEach(d => {
        console.log('  - ' + d.name + ' (ID: ' + d.id + ')');
      });
    } else {
      console.log('No shared drives accessible to this service account');
    }
    
    console.log('\n--- Checking My Drive Files ---');
    const files = await drive.files.list({
      pageSize: 5,
      fields: 'files(id, name, mimeType)',
    });
    
    if (files.data.files && files.data.files.length > 0) {
      console.log('Files in service account drive:');
      files.data.files.forEach(f => {
        console.log('  - ' + f.name + ' (' + f.mimeType + ')');
      });
    } else {
      console.log('No files in service account My Drive');
    }
    
    console.log('\n--- Testing Spreadsheet Creation ---');
    const sheets = google.sheets({ version: 'v4', auth });
    try {
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: { properties: { title: 'FinCat Test - Delete Me' } },
      });
      console.log('SUCCESS! Created spreadsheet:', spreadsheet.data.spreadsheetId);
      console.log('URL:', spreadsheet.data.spreadsheetUrl);
      await drive.files.delete({ fileId: spreadsheet.data.spreadsheetId! });
      console.log('Cleaned up test spreadsheet');
    } catch (createErr: any) {
      console.log('Failed to create spreadsheet:', createErr.message);
      console.log('Error code:', createErr.code);
    }
    
  } catch (err: any) {
    console.error('Error:', err.message);
  }
}

checkDriveAccess();

