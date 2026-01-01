# Google Apps Script: Row-level edit timestamps for FinCat sync

This script stamps `sheet_modified_at` and `sheet_modified_by` whenever a user edits a row in the **All Transactions** tab. FinCat uses these timestamps for **row-level last-write-wins** synchronization.

## What it does

- Runs on every **user edit** in the spreadsheet (Apps Script `onEdit` trigger).
- If the edit is on the `All Transactions` tab and affects a data row (row ≥ 2), it writes:
  - `sheet_modified_at` (ISO timestamp)
  - `sheet_modified_by` (editor email if available, else blank)
- It does **not** run for API writes done by FinCat (Apps Script `onEdit` does not trigger on API writes), preventing sync loops.

## Required sheet columns

The **All Transactions** tab must include these columns (FinCat will add them automatically on export):

- `Portal Modified At`
- `Sheet Modified At`
- `Sheet Modified By`

By default FinCat hides the system columns; you can unhide them if you need to inspect.

## Installation

1. Open your Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Create a new file (or use `Code.gs`) and paste the script below.
4. Click **Run** once to authorize.
5. In the Apps Script editor, go to **Triggers** (clock icon):
   - Add a trigger for function `onEdit`
   - Event source: **From spreadsheet**
   - Event type: **On edit**

## Script (paste into Apps Script)

```javascript
/**
 * FinCat row-level edit stamping for LWW sync.
 *
 * Stamps:
 * - Sheet Modified At (ISO timestamp)
 * - Sheet Modified By (editor email if available)
 *
 * Notes:
 * - Only fires on user edits (not API writes), which avoids sync loops.
 * - Requires All Transactions header row to contain the expected column names.
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;

    var sheet = e.range.getSheet();
    if (!sheet) return;

    var sheetName = sheet.getName();
    if (sheetName !== 'All Transactions') return;

    var row = e.range.getRow();
    if (row < 2) return; // skip header

    // Find the system columns by header labels (row 1)
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) return;

    var header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    var portalModifiedAtCol = header.indexOf('Portal Modified At') + 1;
    var sheetModifiedAtCol = header.indexOf('Sheet Modified At') + 1;
    var sheetModifiedByCol = header.indexOf('Sheet Modified By') + 1;

    if (!sheetModifiedAtCol) return; // cannot stamp without the column

    // Avoid stamping when the edit itself is in the stamping columns
    var editedCol = e.range.getColumn();
    if (editedCol === sheetModifiedAtCol || editedCol === sheetModifiedByCol || editedCol === portalModifiedAtCol) {
      return;
    }

    var nowIso = new Date().toISOString();
    sheet.getRange(row, sheetModifiedAtCol).setValue(nowIso);

    // Best-effort editor identity (requires domain/admin settings; may be blank)
    var email = '';
    try {
      email = Session.getActiveUser().getEmail() || '';
    } catch (err) {
      email = '';
    }

    if (sheetModifiedByCol) {
      sheet.getRange(row, sheetModifiedByCol).setValue(email);
    }
  } catch (err) {
    // Fail closed: do not interrupt spreadsheet editing
    // Logger.log(err);
  }
}
```

## Notes / limitations

- `Session.getActiveUser().getEmail()` may return blank depending on workspace policies.
- If you rename the `All Transactions` tab, update the script accordingly.


