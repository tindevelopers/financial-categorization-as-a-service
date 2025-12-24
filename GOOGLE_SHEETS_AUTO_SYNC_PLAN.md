# Google Sheets Auto-Sync Enhancement Plan

**Created:** December 21, 2024  
**Status:** Planning  
**Target Phase:** Phase 5

---

## 📊 Current Implementation Analysis

### ✅ What Currently Works (Manual Export)

**File:** `apps/portal/app/api/categorization/jobs/[jobId]/export/google-sheets/route.ts`

**Current Features:**
1. ✅ Creates a new Google Sheet on-demand
2. ✅ Exports all transactions for a job
3. ✅ Formats header row (blue background, white text, bold)
4. ✅ Auto-resizes columns
5. ✅ Returns shareable URL
6. ✅ Service account authentication

**Current Flow:**
```
User clicks "Export to Google Sheets" 
  → API creates new sheet
  → Writes all transactions
  → Formats headers
  → Returns URL
```

**Limitations:**
- ❌ Manual trigger only (no automation)
- ❌ Creates new sheet every time (no updates)
- ❌ No sync preferences/settings
- ❌ No scheduled exports
- ❌ No real-time sync on changes
- ❌ No template customization
- ❌ No sync history/logs
- ❌ No notification when sync completes
- ❌ Single format only (no templates)

---

## 🎯 Enhancement Goals

### Phase 5 Auto-Sync Features

1. **Scheduled Automatic Exports**
   - Daily, weekly, or monthly exports
   - Background job runs on schedule
   - No manual intervention needed

2. **Update Existing Sheets**
   - Track which sheet belongs to which job
   - Update existing sheet instead of creating new
   - Append new transactions or full refresh

3. **Real-Time Sync (Optional)**
   - Sync when transactions are updated
   - Sync when transactions are confirmed
   - Configurable per user

4. **Sheet Templates**
   - Multiple formatting options
   - Custom column selection
   - User-defined layouts

5. **Sync Preferences UI**
   - Enable/disable auto-sync
   - Set sync frequency
   - Choose template
   - Configure notifications

6. **Sync History & Logs**
   - Track all syncs
   - Show success/failure status
   - Error messages
   - Last sync timestamp

---

## 🗄️ Database Schema Changes

### New Tables

#### 1. `google_sheets_connections`
Store Google Sheet IDs and sync preferences per user.

```sql
CREATE TABLE google_sheets_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  spreadsheet_id TEXT NOT NULL,
  spreadsheet_name TEXT NOT NULL,
  sheet_url TEXT NOT NULL,
  
  -- Sync settings
  auto_sync_enabled BOOLEAN DEFAULT false,
  sync_frequency TEXT DEFAULT 'manual', -- manual, daily, weekly, monthly
  last_sync_at TIMESTAMPTZ,
  next_sync_at TIMESTAMPTZ,
  
  -- Template settings
  template_name TEXT DEFAULT 'default',
  custom_columns JSONB, -- Which columns to include
  custom_formatting JSONB, -- Color scheme, fonts, etc.
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, spreadsheet_id)
);

-- RLS policies
ALTER TABLE google_sheets_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sheet connections"
  ON google_sheets_connections
  FOR ALL
  USING (auth.uid() = user_id);
```

#### 2. `google_sheets_sync_logs`
Track all sync operations for debugging and history.

```sql
CREATE TABLE google_sheets_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES google_sheets_connections(id) ON DELETE CASCADE,
  job_id UUID REFERENCES categorization_jobs(id) ON DELETE SET NULL,
  
  -- Sync details
  sync_type TEXT NOT NULL, -- manual, scheduled, real_time
  sync_mode TEXT NOT NULL, -- create, update, append
  status TEXT NOT NULL, -- success, partial, failed
  
  -- Results
  transactions_synced INT DEFAULT 0,
  rows_added INT DEFAULT 0,
  rows_updated INT DEFAULT 0,
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INT,
  
  CONSTRAINT valid_status CHECK (status IN ('success', 'partial', 'failed')),
  CONSTRAINT valid_sync_type CHECK (sync_type IN ('manual', 'scheduled', 'real_time'))
);

-- RLS policies
ALTER TABLE google_sheets_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own sync logs"
  ON google_sheets_sync_logs
  FOR SELECT
  USING (auth.uid() = user_id);
```

#### 3. `google_sheets_templates`
Pre-defined and custom templates for sheet formatting.

```sql
CREATE TABLE google_sheets_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system templates
  template_name TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,
  
  -- Template configuration
  columns JSONB NOT NULL, -- Array of column definitions
  header_format JSONB NOT NULL, -- Header styling
  row_format JSONB, -- Row styling (alternating colors, etc.)
  conditional_formatting JSONB, -- Rules for highlighting
  
  -- Metadata
  description TEXT,
  preview_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, template_name)
);

-- RLS policies
ALTER TABLE google_sheets_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system templates and their own"
  ON google_sheets_templates
  FOR SELECT
  USING (is_system = true OR auth.uid() = user_id);

CREATE POLICY "Users can manage their own templates"
  ON google_sheets_templates
  FOR ALL
  USING (auth.uid() = user_id AND is_system = false);
```

#### 4. Update `categorization_jobs` table
Add tracking for which sheet this job syncs to.

```sql
ALTER TABLE categorization_jobs
ADD COLUMN sheet_connection_id UUID REFERENCES google_sheets_connections(id) ON DELETE SET NULL,
ADD COLUMN last_synced_to_sheets_at TIMESTAMPTZ;
```

---

## 📁 Files to Create

### 1. API Routes

#### `apps/portal/app/api/integrations/google-sheets/connect/route.ts`
Initialize or link a Google Sheet connection.

```typescript
// POST - Create new sheet connection or link existing sheet
// Body: { spreadsheetId?, createNew?, templateName?, syncFrequency? }
```

#### `apps/portal/app/api/integrations/google-sheets/sync/route.ts`
Manual sync trigger (improved version of current export).

```typescript
// POST - Sync specific job to Google Sheets
// Body: { jobId, mode: 'create' | 'update' | 'append' }
```

#### `apps/portal/app/api/integrations/google-sheets/settings/route.ts`
Manage sync preferences.

```typescript
// GET - Get user's sync settings
// PATCH - Update sync preferences
// Body: { autoSyncEnabled?, syncFrequency?, templateName? }
```

#### `apps/portal/app/api/integrations/google-sheets/templates/route.ts`
Manage sheet templates.

```typescript
// GET - List available templates
// POST - Create custom template
// PATCH - Update template
// DELETE - Delete custom template
```

#### `apps/portal/app/api/integrations/google-sheets/history/route.ts`
View sync history.

```typescript
// GET - Get sync logs for user
// Query params: ?limit=50&offset=0&status=all
```

#### `apps/portal/app/api/background/sync-google-sheets/route.ts`
Scheduled background job for auto-sync.

```typescript
// Runs on schedule (Vercel Cron)
// Finds all connections where next_sync_at < NOW()
// Syncs each one
```

### 2. UI Components

#### `apps/portal/app/dashboard/integrations/google-sheets/page.tsx`
Main Google Sheets integration settings page.

**Features:**
- Connect new sheet or link existing
- Enable/disable auto-sync
- Configure sync frequency
- View sync status
- Disconnect sheet

#### `apps/portal/components/integrations/GoogleSheetsSettings.tsx`
Settings form component.

```typescript
interface GoogleSheetsSettings {
  autoSyncEnabled: boolean;
  syncFrequency: 'manual' | 'daily' | 'weekly' | 'monthly';
  templateName: string;
  spreadsheetId?: string;
}
```

#### `apps/portal/components/integrations/GoogleSheetsSyncStatus.tsx`
Display current sync status.

```typescript
// Shows:
// - Last sync time
// - Next scheduled sync
// - Sync in progress indicator
// - Quick manual sync button
```

#### `apps/portal/components/integrations/GoogleSheetsSyncHistory.tsx`
Table showing sync history.

```typescript
// Displays:
// - Date/time
// - Sync type
// - Status (badge)
// - Transactions count
// - Duration
// - Error message (if failed)
```

#### `apps/portal/components/integrations/GoogleSheetsTemplateSelector.tsx`
Template selection UI.

```typescript
// Shows:
// - Template preview cards
// - System templates
// - User custom templates
// - Create new template button
```

### 3. Shared Libraries

#### `apps/portal/lib/google-sheets/client.ts`
Reusable Google Sheets API client.

```typescript
export class GoogleSheetsClient {
  constructor(auth: GoogleAuth);
  
  // Create new spreadsheet
  async createSpreadsheet(title: string, template: Template): Promise<string>;
  
  // Update existing spreadsheet
  async updateSpreadsheet(spreadsheetId: string, data: any[]): Promise<void>;
  
  // Append to spreadsheet
  async appendToSpreadsheet(spreadsheetId: string, data: any[]): Promise<void>;
  
  // Apply formatting
  async applyFormatting(spreadsheetId: string, template: Template): Promise<void>;
  
  // Get spreadsheet info
  async getSpreadsheetInfo(spreadsheetId: string): Promise<SpreadsheetInfo>;
}
```

#### `apps/portal/lib/google-sheets/sync.ts`
Sync logic and orchestration.

```typescript
export async function syncJobToGoogleSheets(
  jobId: string,
  userId: string,
  mode: 'create' | 'update' | 'append'
): Promise<SyncResult>;

export async function scheduledSync(): Promise<void>;

export async function calculateNextSyncTime(
  frequency: string,
  lastSyncAt: Date
): Date;
```

#### `apps/portal/lib/google-sheets/templates.ts`
Template definitions and rendering.

```typescript
export interface Template {
  name: string;
  columns: ColumnDefinition[];
  headerFormat: FormatConfig;
  rowFormat?: FormatConfig;
  conditionalFormatting?: ConditionalRule[];
}

export const SYSTEM_TEMPLATES: Template[] = [
  // Default template
  // Accounting template (with debit/credit columns)
  // Simple template (minimal columns)
  // Detailed template (all fields)
];

export function renderTemplate(
  template: Template,
  transactions: Transaction[]
): any[][];
```

---

## 🔄 Implementation Plan

### Step 1: Database Migration (Day 1)
- [ ] Create migration file
- [ ] Add new tables
- [ ] Update existing tables
- [ ] Create RLS policies
- [ ] Add indexes for performance

**Migration File:** `apps/portal/supabase/migrations/20241222000000_google_sheets_auto_sync.sql`

### Step 2: Refactor Existing Export (Day 1-2)
- [ ] Extract Google Sheets logic to reusable library
- [ ] Create `GoogleSheetsClient` class
- [ ] Update existing export route to use new client
- [ ] Add error handling and logging
- [ ] Test backward compatibility

### Step 3: Build Core Sync Functionality (Day 2-3)
- [ ] Implement sync logic (create/update/append modes)
- [ ] Build template system
- [ ] Create sync orchestrator
- [ ] Add transaction change detection
- [ ] Implement sync logging

### Step 4: API Routes (Day 3)
- [ ] Connection management routes
- [ ] Settings routes
- [ ] Template routes
- [ ] History routes
- [ ] Update existing export route

### Step 5: Background Jobs (Day 4)
- [ ] Create scheduled sync job
- [ ] Configure Vercel Cron
- [ ] Add job monitoring
- [ ] Implement retry logic
- [ ] Add failure notifications

### Step 6: UI Components (Day 4-5)
- [ ] Settings page
- [ ] Sync status widget
- [ ] Sync history table
- [ ] Template selector
- [ ] Connection flow

### Step 7: Testing & Polish (Day 5)
- [ ] Test manual sync
- [ ] Test scheduled sync
- [ ] Test real-time sync
- [ ] Test error scenarios
- [ ] Performance optimization

---

## 🎨 UI/UX Design

### Settings Page Layout

```
┌─────────────────────────────────────────────────────────┐
│ Google Sheets Integration                               │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Connected Sheet]                                        │
│ ┌────────────────────────────────────────────────────┐  │
│ │ 📊 Financial Transactions - Dec 2024               │  │
│ │ Last synced: 2 hours ago                           │  │
│ │ [Open Sheet] [Disconnect]                          │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Auto-Sync Settings                                       │
│ ┌────────────────────────────────────────────────────┐  │
│ │ ☑ Enable automatic sync                           │  │
│ │                                                     │  │
│ │ Sync Frequency                                     │  │
│ │ ○ Daily  ● Weekly  ○ Monthly                       │  │
│ │                                                     │  │
│ │ Next sync: December 28, 2024 at 2:00 AM           │  │
│ │                                                     │  │
│ │ [Sync Now] [Save Settings]                        │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Template                                                 │
│ ┌────────────────────────────────────────────────────┐  │
│ │ [Default ▼]                                        │  │
│ │ - Default (All columns)                            │  │
│ │ - Accounting (Debit/Credit format)                 │  │
│ │ - Simple (Essential columns only)                  │  │
│ │ - Custom Template 1                                │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
│ Sync History                                             │
│ ┌────────────────────────────────────────────────────┐  │
│ │ Dec 21, 2024 2:30 PM  Manual    ✓ Success  45 rows │  │
│ │ Dec 20, 2024 2:00 AM  Scheduled ✓ Success  38 rows │  │
│ │ Dec 13, 2024 2:00 AM  Scheduled ✓ Success  52 rows │  │
│ │ [View All]                                         │  │
│ └────────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Sync Status Widget (Dashboard)

```
┌────────────────────────────────────────┐
│ 📊 Google Sheets Sync                  │
├────────────────────────────────────────┤
│ Status: ✓ Up to date                   │
│ Last sync: 2 hours ago                 │
│ Next sync: In 22 hours                 │
│                                         │
│ [Sync Now] [Settings]                  │
└────────────────────────────────────────┘
```

---

## ⚙️ Technical Implementation Details

### Sync Modes

#### 1. Create Mode (Default for first sync)
- Creates a new Google Sheet
- Writes all transactions
- Saves spreadsheet ID in database
- Future syncs will use Update mode

#### 2. Update Mode (Default for subsequent syncs)
- Clears existing data (except headers)
- Writes all current transactions
- Maintains sheet ID
- Fast and clean

#### 3. Append Mode (Optional)
- Only adds new transactions since last sync
- Keeps historical data
- Useful for continuous logs
- Requires tracking synced transaction IDs

### Real-Time Sync Triggers

```typescript
// When transaction is confirmed
async function onTransactionConfirmed(transactionId: string) {
  const settings = await getUserSyncSettings(userId);
  
  if (settings.autoSyncEnabled && settings.syncOnConfirm) {
    await triggerSync(userId, 'real_time');
  }
}

// When transaction is updated
async function onTransactionUpdated(transactionId: string) {
  const settings = await getUserSyncSettings(userId);
  
  if (settings.autoSyncEnabled && settings.syncOnUpdate) {
    await triggerSync(userId, 'real_time');
  }
}
```

### Scheduled Sync (Vercel Cron)

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/background/sync-google-sheets",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Cron Job Logic:**

```typescript
// Runs daily at 2:00 AM
export async function GET() {
  const now = new Date();
  
  // Find all connections due for sync
  const connections = await supabase
    .from('google_sheets_connections')
    .select('*')
    .eq('auto_sync_enabled', true)
    .lte('next_sync_at', now.toISOString());
  
  // Sync each connection
  for (const connection of connections.data || []) {
    await syncConnection(connection);
  }
  
  return NextResponse.json({ success: true });
}
```

### Error Handling & Retry Logic

```typescript
async function syncWithRetry(
  connectionId: string,
  maxRetries = 3
): Promise<SyncResult> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await performSync(connectionId);
    } catch (error) {
      if (attempt === maxRetries) {
        // Log failure, send notification
        await logSyncFailure(connectionId, error);
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => 
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }
}
```

---

## 🔔 Notifications

### Sync Success Notification
- In-app notification
- Optional email notification
- Shows sync summary (rows added/updated)

### Sync Failure Notification
- In-app notification (high priority)
- Email notification
- Shows error message
- Provides "Retry" button

---

## 📊 Success Metrics

### Functional Requirements
- [ ] Auto-sync works reliably (99%+ success rate)
- [ ] Scheduled syncs run on time (< 5 min variance)
- [ ] Real-time syncs complete in < 10 seconds
- [ ] Template rendering is accurate
- [ ] Sync history is complete and accurate

### Performance Requirements
- [ ] Manual sync completes in < 15 seconds
- [ ] Scheduled sync completes in < 30 seconds
- [ ] Can handle 10,000+ transactions per sheet
- [ ] No impact on main app performance
- [ ] Database queries optimized (< 100ms)

### User Experience
- [ ] Settings page is intuitive
- [ ] Sync status is always visible
- [ ] Error messages are clear and actionable
- [ ] Template selection is visual
- [ ] One-click sync trigger

---

## 🚀 Deployment Checklist

### Prerequisites
- [ ] Google Sheets API credentials configured
- [ ] Database migrations applied
- [ ] Vercel Cron enabled
- [ ] Environment variables set

### Testing
- [ ] Manual sync tested
- [ ] Scheduled sync tested
- [ ] Template rendering tested
- [ ] Error scenarios tested
- [ ] Load testing completed

### Rollout
- [ ] Deploy to staging
- [ ] Beta test with 10 users
- [ ] Monitor for 48 hours
- [ ] Fix any issues
- [ ] Deploy to production
- [ ] Monitor sync logs
- [ ] Gather user feedback

---

## 📝 Future Enhancements (Post-Phase 5)

### Advanced Features
- [ ] Two-way sync (import from Sheets)
- [ ] Share sheets with team members
- [ ] Custom formulas and calculations
- [ ] Charts and graphs in sheets
- [ ] Multiple sheets per user
- [ ] Sync specific categories only
- [ ] Archive old sheets automatically
- [ ] Export to Google Drive folders
- [ ] Batch operations across jobs
- [ ] API for programmatic sync

---

## 🔗 Related Documents

- `COMPLETE_PHASED_PLAN.md` - Phase 5 details
- `PHASE_1_IMPLEMENTATION.md` - Original export feature
- Current implementation: `apps/portal/app/api/categorization/jobs/[jobId]/export/google-sheets/route.ts`

---

**Status:** Ready for Implementation  
**Estimated Duration:** 5-6 days  
**Next Step:** Create database migration and refactor existing export

