// ============================================================
// Config.gs
// Central configuration for the Kitchen Inventory System.
// All sheet names, column indices, and system constants live
// here. Every other module imports from this file — never
// hardcode a sheet name or column number anywhere else.
// ============================================================

// ── Sheet Names ──────────────────────────────────────────────
const SHEETS = {
  MASTER:     'MASTER_INVENTORY',
  INBOUND:    'INBOUND_LOG',
  OUTBOUND:   'OUTBOUND_LOG',
  CONTAINERS: 'OPEN_CONTAINERS',
  OVERRIDES:  'STOCK_OVERRIDES',
  PRODUCTS:   'PRODUCTS_DB',
  CATEGORIES: 'CATEGORIES',
  ALERTS:     'ALERTS',
  USERS:      'USERS',
  DASHBOARD:  'DASHBOARD',
};

// ── Column Indices (0-based) ──────────────────────────────────
// These must match exactly what SetupSheets.gs writes as headers.

const COL = {

  MASTER: {
    ITEM_ID:            0,
    BARCODE:            1,
    PRODUCT_NAME:       2,
    BRAND:              3,
    CATEGORY:           4,
    SUB_CATEGORY:       5,
    UNIT_TYPE:          6,
    CURRENT_QTY:        7,
    REORDER_LEVEL:      8,
    REORDER_QTY:        9,
    STORAGE_LOCATION:   10,
    CONSUMPTION_TRACK:  11,
    LAST_UPDATED:       12,
    LAST_OVERRIDE_DATE: 13,
    LAST_OVERRIDE_BY:   14,
    STATUS:             15,
  },

  INBOUND: {
    LOG_ID:            0,
    PURCHASE_DATE:     1,
    TIMESTAMP:         2,
    ITEM_ID:           3,
    BARCODE:           4,
    PRODUCT_NAME:      5,
    BRAND:             6,
    CATEGORY:          7,
    SUB_CATEGORY:      8,
    QTY_ADDED:         9,
    UNIT_TYPE:         10,
    UNIT_PRICE:        11,
    TOTAL_COST:        12,
    SUPPLIER:          13,
    INVOICE_NO:        14,
    EXPIRY_DATE:       15,
    STORAGE_LOCATION:  16,
    ENTERED_BY:        17,
    CONSUMPTION_TRACK: 18,
    NOTES:             19,
  },

  OUTBOUND: {
    LOG_ID:            0,
    TIMESTAMP:         1,
    ITEM_ID:           2,
    BARCODE:           3,
    QTY_REMOVED:       4,
    DRAWDOWN_REASON:   5,
    RECIPE_ID:         6,
    MEAL_EVENT_ID:     7,
    DRAWN_BY:          8,
    CONSUMPTION_TRACK: 9,
    NOTES:             10,
  },

  CONTAINERS: {
    CONTAINER_ID:      0,
    ITEM_ID:           1,
    ORIGINAL_BARCODE:  2,
    ORIGINAL_QTY:      3,
    ESTIMATED_REMAINING: 4,
    UNIT_TYPE:         5,
    OPENED_DATE:       6,
    LAST_ESTIMATED_DATE: 7,
    ESTIMATED_BY:      8,
    STORAGE_LOCATION:  9,
    STATUS:            10,
    NOTES:             11,
  },

  OVERRIDES: {
    OVERRIDE_ID: 0,
    TIMESTAMP:   1,
    ITEM_ID:     2,
    QTY_BEFORE:  3,
    QTY_AFTER:   4,
    DIFFERENCE:  5,
    REASON:      6,
    OVERRIDE_BY: 7,
    APPROVED_BY: 8,
    NOTES:       9,
  },

  PRODUCTS: {
    BARCODE:           0,
    PRODUCT_NAME:      1,
    BRAND:             2,
    DEFAULT_CATEGORY:  3,
    DEFAULT_SUB_CAT:   4,
    DEFAULT_UNIT_TYPE: 5,
    PACK_SIZE:         6,
    DEFAULT_TRACK:     7,
    IMAGE_URL:         8,
    NOTES:             9,
  },

  CATEGORIES: {
    CATEGORY_ID:      0,
    CATEGORY_NAME:    1,
    SUB_CATEGORY_ID:  2,
    SUB_CATEGORY_NAME: 3,
    ICON:             4,
    SORT_ORDER:       5,
  },

  ALERTS: {
    ALERT_ID:      0,
    TIMESTAMP:     1,
    ITEM_ID:       2,
    ALERT_TYPE:    3,
    CURRENT_QTY:   4,
    REORDER_LEVEL: 5,
    EXPIRY_DATE:   6,
    STATUS:        7,
    NOTES:         8,
  },

  USERS: {
    USER_ID:               0,
    NAME:                  1,
    EMAIL:                 2,
    ROLE:                  3,
    CONSUMPTION_TRACK_ACCESS: 4,
    CAN_OVERRIDE:          5,
    ACTIVE:                6,
  },
};

// ── Dropdown Options ─────────────────────────────────────────
// Single source of truth for all validated dropdown values.

const OPTIONS = {
  UNIT_TYPE:         ['g', 'kg', 'ml', 'L', 'pcs', 'pack', 'dozen'],
  CONSUMPTION_TRACK: ['FAMILY', 'BABY', 'STAFF', 'SHARED'],
  STORAGE_LOCATION:  ['Pantry', 'Fridge', 'Freezer', 'Bar', 'Puja Room', 'Medicine Cabinet', 'Store Room', 'Pet Corner'],
  DRAWDOWN_REASON:   ['COOKING', 'EXPIRED', 'DAMAGED', 'TRANSFER'],
  ITEM_STATUS:       ['ACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK', 'OPEN_PARTIAL', 'SEASONAL'],
  OVERRIDE_REASON:   ['PHYSICAL_AUDIT', 'DATA_GAP', 'SPILLAGE', 'OTHER'],
  CONTAINER_STATUS:  ['OPEN', 'EMPTY', 'RECONCILED'],
  ALERT_TYPE:        ['LOW_STOCK', 'EXPIRY', 'OUT_OF_STOCK', 'CONTAINER_STALE'],
  ALERT_STATUS:      ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'],
  ROLE:              ['ADMIN', 'FAMILY', 'STAFF', 'VIEWER'],
};

// ── System Constants ─────────────────────────────────────────
const SYSTEM = {
  EXPIRY_ALERT_DAYS:    7,    // days before expiry to fire alert
  STALE_CONTAINER_DAYS: 7,    // days without estimate update to fire alert
  ALERT_EMAIL:          '',   // set your email here for daily digest
  OPEN_FOOD_FACTS_URL:  'https://world.openfoodfacts.org/api/v0/product/',
  VERSION:              '1.0.0',
};

// ── Helper: get the spreadsheet ──────────────────────────────
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ── Helper: get a sheet by name ──────────────────────────────
function getSheet(sheetName) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`Sheet "${sheetName}" not found. Run SetupSheets.gs first.`);
  return sheet;
}

// ── Helper: get all data from a sheet (excluding header row) ─
function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
}

// ── Helper: generate a unique ID ────────────────────────────
function generateId(prefix) {
  const timestamp = new Date().getTime();
  const random = Math.floor(Math.random() * 10000);
  return `${prefix}-${timestamp}-${random}`;
}

// ── Helper: format date as YYYY-MM-DD ───────────────────────
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ── Helper: today's date as YYYY-MM-DD ──────────────────────
function today() {
  return formatDate(new Date());
}

// ── Helper: build a JSON response for the Web App ───────────
function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Helper: return error response ───────────────────────────
function errorResponse(message, code) {
  return jsonResponse({ success: false, error: message, code: code || 400 });
}

// ── Helper: return success response ─────────────────────────
function successResponse(data) {
  return jsonResponse({ success: true, ...data });
}
