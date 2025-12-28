# Google Workspace MCP Server Setup Guide

## Overview

The Google Workspace MCP Server (`@presto-ai/google-workspace-mcp`) provides access to:
- ✅ **Gmail** - Search emails, read messages, send emails, create/manage drafts
- ✅ **Google Drive** - Search files, download documents, access metadata
- ✅ **Google Docs** - Read and manage documents
- ✅ **Google Sheets** - Read and manage spreadsheets
- ✅ **Google Calendar** - List calendars, create/read/update/delete events, find free time
- ✅ **Google Chat** - Access chat messages

## ✅ Configuration Added

The Google Workspace MCP server has been added to your `~/.cursor/mcp.json`:

```json
"google-workspace": {
  "command": "npx",
  "args": ["-y", "@presto-ai/google-workspace-mcp"],
  "env": {}
}
```

**Package Version**: 1.0.12  
**Homepage**: https://github.com/jrenaldi79/google-workspace-mcp

---

## 🔐 Setup Steps

### Step 1: Enable Required Google APIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create a new one)
3. Navigate to **APIs & Services** > **Library**
4. Enable the following APIs:
   - ✅ **Gmail API**
   - ✅ **Google Drive API**
   - ✅ **Google Docs API**
   - ✅ **Google Sheets API**
   - ✅ **Google Calendar API** (optional, for calendar features)
   - ✅ **Google Chat API** (optional, for chat features)

### Step 2: Create OAuth 2.0 Credentials

1. In Google Cloud Console, go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - Choose **Internal** (for personal use) or **External** (for wider distribution)
   - Fill in required fields (App name, User support email, etc.)
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/drive.readonly`
     - `https://www.googleapis.com/auth/documents.readonly`
     - `https://www.googleapis.com/auth/spreadsheets.readonly`
     - `https://www.googleapis.com/auth/calendar.readonly`
   - Save and continue
4. Create OAuth Client ID:
   - Application type: **Desktop Application**
   - Name: `Google Workspace MCP` (or any name)
   - Click **Create**
5. **Important**: You'll see a dialog with your Client ID and Client Secret
   - **Do NOT download the JSON file** - the MCP server handles authentication interactively
   - The credentials will be stored securely after first authentication

### Step 3: Restart Cursor

1. **Restart Cursor** to load the new MCP configuration
2. The Google Workspace MCP server will be available after restart

### Step 4: First-Time Authentication

When you first use the Google Workspace MCP server:

1. The server will prompt you to authenticate
2. A browser window will open asking you to sign in with your Google account
3. Grant the requested permissions
4. The authentication token will be stored securely for future use

---

## 🚀 Usage Examples

Once configured, you can use the Google Workspace MCP server through Cursor's AI assistant:

### Gmail Examples:
- "Search my Gmail for emails from [sender]"
- "Read the latest email in my inbox"
- "Send an email to [recipient] with subject [subject]"
- "Show me unread emails from this week"

### Google Drive Examples:
- "List files in my Google Drive"
- "Search for files named [filename]"
- "Download the file [filename]"
- "Show me recent files"

### Google Docs Examples:
- "Read the document [document name]"
- "List my Google Docs"
- "Get the content of [document ID]"

### Google Sheets Examples:
- "Read data from spreadsheet [spreadsheet name]"
- "List my Google Sheets"
- "Get values from [spreadsheet ID]"

### Google Calendar Examples:
- "Show my calendar events for today"
- "Create a calendar event for [date/time]"
- "Find free time in my calendar"
- "List my calendars"

---

## 🔧 Configuration Options

### Environment Variables (Optional)

You can customize the behavior with environment variables:

```json
"google-workspace": {
  "command": "npx",
  "args": ["-y", "@presto-ai/google-workspace-mcp"],
  "env": {
    "GOOGLE_WORKSPACE_ENABLED_CAPABILITIES": "[\"drive\", \"docs\", \"gmail\", \"sheets\", \"calendar\"]"
  }
}
```

### Scopes

The MCP server requests these OAuth scopes:
- `gmail.readonly` - Read Gmail messages
- `gmail.send` - Send emails
- `drive.readonly` - Read Google Drive files
- `documents.readonly` - Read Google Docs
- `spreadsheets.readonly` - Read Google Sheets
- `calendar.readonly` - Read Google Calendar

---

## 🛠️ Troubleshooting

### Issue: Authentication fails
**Solution**: 
- Make sure you've enabled all required APIs in Google Cloud Console
- Check that OAuth consent screen is configured
- Try clearing stored credentials and re-authenticating

### Issue: "Permission denied" errors
**Solution**:
- Verify that you granted all requested permissions during OAuth flow
- Check that the required APIs are enabled in your Google Cloud project

### Issue: MCP server not appearing
**Solution**:
- Restart Cursor completely
- Check `~/.cursor/mcp.json` syntax is valid
- Verify the package exists: `npm view @presto-ai/google-workspace-mcp`

### Issue: Can't access specific service
**Solution**:
- Ensure the corresponding API is enabled in Google Cloud Console
- Check that you granted permissions for that service during OAuth

---

## 📚 Additional Resources

- **Package**: https://www.npmjs.com/package/@presto-ai/google-workspace-mcp
- **GitHub**: https://github.com/jrenaldi79/google-workspace-mcp
- **Google Workspace APIs**: https://developers.google.com/workspace
- **Gmail API**: https://developers.google.com/gmail/api
- **Drive API**: https://developers.google.com/drive
- **Docs API**: https://developers.google.com/docs
- **Sheets API**: https://developers.google.com/sheets

---

## 🔒 Security Notes

- OAuth tokens are stored locally on your machine
- The MCP server uses read-only scopes by default (except Gmail send)
- Never share your OAuth credentials
- Use "Internal" OAuth consent screen for personal use

---

## ✅ Verification

To verify the setup is working:

1. Restart Cursor
2. Try asking: "List my Google Drive files" or "Show me my Gmail inbox"
3. If prompted, complete the OAuth authentication flow
4. The MCP server should respond with your data

---

**Status**: ✅ Configured and ready to use after restart

**Next Step**: Restart Cursor and authenticate when prompted


