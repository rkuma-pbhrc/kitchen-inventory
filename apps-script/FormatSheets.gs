// ============================================================
// FormatSheets.gs
// Applies calming pastel formatting across all sheets.
// Run formatAllSheets() to apply. Safe to re-run at any time.
// ============================================================

// ── Colour Palette ───────────────────────────────────────────
const PALETTE = {
  MASTER_INVENTORY: {
    tab:        '#7A9E72',
    header:     '#C8D8C0',
    headerText: '#2E4A28',
    altRow:     '#F2F5F0',
  },
  INBOUND_LOG: {
    tab:        '#5A8FAA',
    header:     '#BDD4E8',
    headerText: '#1E4A6A',
    altRow:     '#F0F5FA',
  },
  OUTBOUND_LOG: {
    tab:        '#7A6AAA',
    header:     '#D0C8E8',
    headerText: '#3A2A6A',
    altRow:     '#F5F2FB',
  },
  OPEN_CONTAINERS: {
    tab:        '#B07A50',
    header:     '#F0D8C0',
    headerText: '#5A3010',
    altRow:     '#FDF5EF',
  },
  STOCK_OVERRIDES: {
    tab:        '#9A9040',
    header:     '#E8E0B0',
    headerText: '#4A4010',
    altRow:     '#FAFAF0',
  },
  PRODUCTS_DB: {
    tab:        '#4A9A7A',
    header:     '#B8E0D0',
    headerText: '#0A4A30',
    altRow:     '#EFF8F4',
  },
  CATEGORIES: {
    tab:        '#8A6AAA',
    header:     '#D8C8E8',
    headerText: '#3A1A6A',
    altRow:     '#F5F0FB',
  },
  ALERTS: {
    tab:        '#B05A5A',
    header:     '#F0C8C8',
    headerText: '#5A1A1A',
    altRow:     '#FDF0F0',
  },
  DASHBOARD: {
    tab:        '#8A7A5A',
    header:     '#EDE8DC',
    headerText: '#3A3020',
    altRow:     '#FAF8F3',
  },
  USERS: {
    tab:        '#AA6A7A',
    header:     '#E8D0D8',
    headerText: '#5A1A2A',
    altRow:     '#FBF5F7',
  },
};

// ── Number Formats ───────────────────────────────────────────
const FMT = {
  date:      'dd/mm/yyyy',
  timestamp: 'dd/mm/yyyy hh:mm',
  currency:  '₹#,##,##0.00',          // Indian numbering (lakh/crore)
  qty:       '#,##0.##',               // up to 2 decimal places, no trailing zeros
  integer:   '#,##0',
  time:      'hh:mm:ss am/pm',          // time only
  text:      '@',                      // plain text — prevents scientific notation on barcodes/IDs
};

// ── Column number formats per sheet (1-based column index) ───
// Format: { colIndex: formatString }
const COL_FORMATS = {

  MASTER_INVENTORY: {
    1:  FMT.text,       // item_id
    2:  FMT.text,       // barcode
    8:  FMT.qty,        // current_qty
    9:  FMT.qty,        // reorder_level
    10: FMT.qty,        // reorder_qty
    13: FMT.timestamp,  // last_updated
    14: FMT.date,       // last_updated_date (split)
    15: FMT.time,       // last_updated_time (split)
    16: FMT.date,       // last_override_date
  },

  INBOUND_LOG: {
    1:  FMT.text,       // log_id
    2:  FMT.date,       // purchase_date
    3:  FMT.timestamp,  // timestamp
    4:  FMT.date,       // entry_date (split)
    5:  FMT.time,       // entry_time (split)
    6:  FMT.text,       // item_id
    7:  FMT.text,       // barcode
    12: FMT.qty,        // qty_added
    14: FMT.currency,   // unit_price
    15: FMT.currency,   // total_cost
    18: FMT.date,       // expiry_date
  },

  OUTBOUND_LOG: {
    1:  FMT.text,       // log_id
    2:  FMT.timestamp,  // timestamp
    3:  FMT.date,       // entry_date (split)
    4:  FMT.time,       // entry_time (split)
    5:  FMT.text,       // item_id
    6:  FMT.text,       // barcode
    7:  FMT.qty,        // qty_removed
  },

  OPEN_CONTAINERS: {
    1:  FMT.text,       // container_id
    2:  FMT.text,       // item_id
    3:  FMT.text,       // original_barcode
    4:  FMT.qty,        // original_qty
    5:  FMT.qty,        // estimated_remaining
    7:  FMT.date,       // opened_date
    8:  FMT.date,       // last_estimated_date
  },

  STOCK_OVERRIDES: {
    1:  FMT.text,       // override_id
    2:  FMT.timestamp,  // timestamp
    3:  FMT.date,       // override_date (split)
    4:  FMT.time,       // override_time (split)
    5:  FMT.text,       // item_id
    6:  FMT.qty,        // qty_before
    7:  FMT.qty,        // qty_after
    8:  FMT.qty,        // difference
  },

  PRODUCTS_DB: {
    1:  FMT.text,       // barcode
  },

  CATEGORIES: {
    6:  FMT.integer,    // sort_order
  },

  ALERTS: {
    1:  FMT.text,       // alert_id
    2:  FMT.timestamp,  // timestamp
    3:  FMT.date,       // alert_date (split)
    4:  FMT.time,       // alert_time (split)
    5:  FMT.text,       // item_id
    7:  FMT.qty,        // current_qty
    8:  FMT.qty,        // reorder_level
    9:  FMT.date,       // expiry_date
  },

};

// ── Status cell colours ──────────────────────────────────────
const STATUS_COLORS = {
  healthy:  { bg: '#D6EDDA', text: '#2A5C35' },
  low:      { bg: '#FDEBD0', text: '#7A4010' },
  expired:  { bg: '#FADBD8', text: '#7A1A1A' },
  critical: { bg: '#F9EBEA', text: '#922B21' },
};

const GRID_COLOR = '#DADADA';
const BASE_FONT  = 'Arial';


// ============================================================
// MAIN ENTRY POINT
// ============================================================
function formatAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  Object.keys(PALETTE).forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`Sheet not found: ${sheetName} — skipping`);
      return;
    }
    _formatSheet(sheet, PALETTE[sheetName]);
    _applyColumnFormats(sheet, sheetName);
    Logger.log(`Formatted: ${sheetName}`);
  });

  _applyConditionalFormatting(ss);
  Logger.log('✓ All sheets formatted successfully');
}


// ============================================================
// Core sheet formatter — colours, fonts, borders, row heights
// ============================================================
function _formatSheet(sheet, colors) {
  const lastCol  = Math.max(sheet.getLastColumn(), 1);
  const lastRow  = Math.max(sheet.getLastRow(),    2);

  // Tab colour
  sheet.setTabColor(colors.tab);

  // Full sheet base
  sheet.getRange(1, 1, lastRow, lastCol)
    .setFontFamily(BASE_FONT)
    .setFontSize(10)
    .setFontColor('#333333')
    .setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true,
               GRID_COLOR, SpreadsheetApp.BorderStyle.SOLID);

  // Header row
  sheet.getRange(1, 1, 1, lastCol)
    .setBackground(colors.header)
    .setFontColor(colors.headerText)
    .setFontSize(11)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);

  sheet.setFrozenRows(1);
  sheet.setRowHeight(1, 36);

  // Alternating rows
  const dataRows = lastRow - 1;
  if (dataRows > 0) {
    for (let r = 2; r <= lastRow; r++) {
      sheet.getRange(r, 1, 1, lastCol)
        .setBackground(r % 2 === 0 ? colors.altRow : '#FFFFFF')
        .setFontWeight('normal')
        .setHorizontalAlignment('left');
      sheet.setRowHeight(r, 28);
    }
  }

  // Minimum column width guard
  for (let c = 1; c <= lastCol; c++) {
    if (sheet.getColumnWidth(c) < 80) sheet.setColumnWidth(c, 100);
  }
}


// ============================================================
// Number formats — applied per column based on COL_FORMATS map
// ============================================================
function _applyColumnFormats(sheet, sheetName) {
  const formats = COL_FORMATS[sheetName];
  if (!formats) return;

  const lastRow = Math.max(sheet.getLastRow(), 2);

  Object.entries(formats).forEach(([col, fmt]) => {
    const colNum = parseInt(col);
    // Apply to data rows only (row 2 onwards), not header
    sheet.getRange(2, colNum, lastRow - 1, 1).setNumberFormat(fmt);
  });
}


// ============================================================
// Conditional formatting for status/alert columns
// ============================================================
function _applyConditionalFormatting(ss) {

  // MASTER_INVENTORY — STATUS (col 16)
  const master = ss.getSheetByName('MASTER_INVENTORY');
  if (master) {
    const lastRow = Math.max(master.getLastRow(), 2);
    master.clearConditionalFormatRules();
    const range = master.getRange(2, 18, lastRow - 1, 1);  // STATUS shifted to col 18 after split
    master.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('ACTIVE')
        .setBackground(STATUS_COLORS.healthy.bg).setFontColor(STATUS_COLORS.healthy.text)
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('LOW_STOCK')
        .setBackground(STATUS_COLORS.low.bg).setFontColor(STATUS_COLORS.low.text)
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('OUT_OF_STOCK')
        .setBackground(STATUS_COLORS.critical.bg).setFontColor(STATUS_COLORS.critical.text)
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('DISCONTINUED')
        .setBackground('#EEEEEE').setFontColor('#888888')
        .setRanges([range]).build(),
    ]);
  }

  // ALERTS — ALERT_TYPE (col 4)
  const alerts = ss.getSheetByName('ALERTS');
  if (alerts) {
    const lastRow = Math.max(alerts.getLastRow(), 2);
    alerts.clearConditionalFormatRules();
    const range = alerts.getRange(2, 6, lastRow - 1, 1);  // ALERT_TYPE is col 6 after split
    alerts.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('EXPIRY')
        .setBackground(STATUS_COLORS.expired.bg).setFontColor(STATUS_COLORS.expired.text)
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('LOW_STOCK')
        .setBackground(STATUS_COLORS.low.bg).setFontColor(STATUS_COLORS.low.text)
        .setRanges([range]).build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo('OUT_OF_STOCK')
        .setBackground(STATUS_COLORS.critical.bg).setFontColor(STATUS_COLORS.critical.text)
        .setRanges([range]).build(),
    ]);
  }

  // INBOUND_LOG — EXPIRY_DATE (col 16) past today
  const inbound = ss.getSheetByName('INBOUND_LOG');
  if (inbound) {
    const lastRow = Math.max(inbound.getLastRow(), 2);
    inbound.clearConditionalFormatRules();
    inbound.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule()
        .whenDateBefore(SpreadsheetApp.RelativeDate.TODAY)
        .setBackground(STATUS_COLORS.expired.bg).setFontColor(STATUS_COLORS.expired.text)
        .setRanges([inbound.getRange(2, 18, lastRow - 1, 1)])  // EXPIRY_DATE shifted to col 18
        .build(),
    ]);
  }

  // STOCK_OVERRIDES — highlight negative DIFFERENCE (col 6) in soft red
  const overrides = ss.getSheetByName('STOCK_OVERRIDES');
  if (overrides) {
    const lastRow = Math.max(overrides.getLastRow(), 2);
    overrides.clearConditionalFormatRules();
    overrides.setConditionalFormatRules([
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberLessThan(0)
        .setBackground(STATUS_COLORS.expired.bg).setFontColor(STATUS_COLORS.expired.text)
        .setRanges([overrides.getRange(2, 8, lastRow - 1, 1)])  // DIFFERENCE shifted to col 8
        .build(),
      SpreadsheetApp.newConditionalFormatRule()
        .whenNumberGreaterThan(0)
        .setBackground(STATUS_COLORS.healthy.bg).setFontColor(STATUS_COLORS.healthy.text)
        .setRanges([overrides.getRange(2, 8, lastRow - 1, 1)])
        .build(),
    ]);
  }
}


// ============================================================
// Utility: refresh alternating rows after bulk data entry
// ============================================================
function refreshAlternatingRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(PALETTE).forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const lastRow = Math.max(sheet.getLastRow(), 2);
    const colors  = PALETTE[sheetName];
    for (let r = 2; r <= lastRow; r++) {
      sheet.getRange(r, 1, 1, lastCol)
        .setBackground(r % 2 === 0 ? colors.altRow : '#FFFFFF');
    }
    _applyColumnFormats(sheet, sheetName);
  });
  Logger.log('✓ Alternating rows and number formats refreshed');
}
