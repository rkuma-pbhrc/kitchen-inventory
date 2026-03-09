// ── Date/time helpers ───────────────────────────────────────
function _ds_a(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy'); }
function _ts_a(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm:ss'); }

// ============================================================
// AlertsEngine.gs
// Runs on a daily Apps Script trigger (e.g. 7am).
// Scans for: low stock, expiry within 7 days, stale containers.
// Writes to ALERTS sheet. Sends an email digest if configured.
// ============================================================

/**
 * Main daily scan. Set this as a time-based trigger in Apps Script.
 */
function runDailyAlertScan() {
  Logger.log('=== Daily Alert Scan ===');
  _scanLowStock();
  _scanExpiringItems();
  _scanStaleContainers();
  _sendAlertDigest();
  refreshDashboard();
  Logger.log('=== Alert scan complete ===');
}

/**
 * Scan MASTER_INVENTORY for items at or below reorder level.
 */
function _scanLowStock() {
  const data = getSheetData(SHEETS.MASTER);
  let newAlerts = 0;

  data.forEach(row => {
    const itemId       = row[COL.MASTER.ITEM_ID];
    const currentQty   = parseFloat(row[COL.MASTER.CURRENT_QTY]) || 0;
    const reorderLevel = parseFloat(row[COL.MASTER.REORDER_LEVEL]) || 0;
    const status       = row[COL.MASTER.STATUS];

    if (status === 'DISCONTINUED') return;
    if (reorderLevel <= 0) return;

    if (currentQty === 0) {
      if (!_alertExists(itemId, 'OUT_OF_STOCK')) {
        _createAlert(itemId, 'OUT_OF_STOCK', currentQty, reorderLevel, '');
        newAlerts++;
      }
    } else if (currentQty <= reorderLevel) {
      if (!_alertExists(itemId, 'LOW_STOCK')) {
        _createAlert(itemId, 'LOW_STOCK', currentQty, reorderLevel, '');
        newAlerts++;
      }
    }
  });

  Logger.log(`Low stock alerts created: ${newAlerts}`);
}

/**
 * Scan INBOUND_LOG for items expiring within SYSTEM.EXPIRY_ALERT_DAYS.
 */
function _scanExpiringItems() {
  const data = getSheetData(SHEETS.INBOUND);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + SYSTEM.EXPIRY_ALERT_DAYS);

  let newAlerts = 0;

  data.forEach(row => {
    const expiryDate = row[COL.INBOUND.EXPIRY_DATE];
    if (!expiryDate) return;

    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return;

    if (expiry <= cutoff && expiry >= new Date()) {
      const itemId = row[COL.INBOUND.ITEM_ID];
      if (!_alertExists(itemId, 'EXPIRY')) {
        _createAlert(itemId, 'EXPIRY', null, null, expiryDate);
        newAlerts++;
      }
    }
  });

  Logger.log(`Expiry alerts created: ${newAlerts}`);
}

/**
 * Scan OPEN_CONTAINERS for stale estimates.
 */
function _scanStaleContainers() {
  const containers = getOpenContainers();
  let newAlerts = 0;

  containers.forEach(container => {
    if (container.is_stale) {
      if (!_alertExists(container.item_id, 'CONTAINER_STALE')) {
        _createAlert(container.item_id, 'CONTAINER_STALE', container.estimated_remaining, null, '');
        newAlerts++;
      }
    }
  });

  Logger.log(`Stale container alerts created: ${newAlerts}`);
}

/**
 * Create a new alert row in the ALERTS sheet.
 */
function _createAlert(itemId, alertType, currentQty, reorderLevel, expiryDate) {
  const sheet = getSheet(SHEETS.ALERTS);
  sheet.appendRow([
    generateId('ALT'),
    new Date(),
    _ds_a(new Date()),
    _ts_a(new Date()),
    itemId,
    alertType,
    currentQty !== null ? currentQty : '',
    reorderLevel !== null ? reorderLevel : '',
    expiryDate || '',
    'OPEN',
    '',
  ]);
}

/**
 * Check if an OPEN alert already exists for an item+type combo.
 * Prevents duplicate alerts.
 */
function _alertExists(itemId, alertType) {
  const data = getSheetData(SHEETS.ALERTS);
  return data.some(row =>
    String(row[COL.ALERTS.ITEM_ID])   === String(itemId) &&
    String(row[COL.ALERTS.ALERT_TYPE]) === alertType &&
    String(row[COL.ALERTS.STATUS])    === 'OPEN'
  );
}

/**
 * Acknowledge an alert (set status to ACKNOWLEDGED).
 */
function acknowledgeAlert(alertId) {
  const sheet = getSheet(SHEETS.ALERTS);
  const data  = getSheetData(SHEETS.ALERTS);

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.ALERTS.ALERT_ID]) === String(alertId)) {
      sheet.getRange(i + 2, COL.ALERTS.STATUS + 1).setValue('ACKNOWLEDGED');
      return { success: true };
    }
  }
  throw new Error(`Alert not found: ${alertId}`);
}

/**
 * Resolve an alert (set status to RESOLVED).
 */
function resolveAlert(alertId) {
  const sheet = getSheet(SHEETS.ALERTS);
  const data  = getSheetData(SHEETS.ALERTS);

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.ALERTS.ALERT_ID]) === String(alertId)) {
      sheet.getRange(i + 2, COL.ALERTS.STATUS + 1).setValue('RESOLVED');
      return { success: true };
    }
  }
  throw new Error(`Alert not found: ${alertId}`);
}

/**
 * Get all open alerts (for the Alerts screen).
 */
function getOpenAlerts() {
  const masterData = getSheetData(SHEETS.MASTER);
  const masterMap  = {};
  masterData.forEach(row => {
    masterMap[row[COL.MASTER.ITEM_ID]] = {
      product_name: row[COL.MASTER.PRODUCT_NAME],
      unit_type:    row[COL.MASTER.UNIT_TYPE],
      category:     row[COL.MASTER.CATEGORY],
    };
  });

  return getSheetData(SHEETS.ALERTS)
    .filter(row => String(row[COL.ALERTS.STATUS]) !== 'RESOLVED')
    .map(row => {
      const meta = masterMap[row[COL.ALERTS.ITEM_ID]] || {};
      return {
        alert_id:      row[COL.ALERTS.ALERT_ID],
        timestamp:     formatDate(row[COL.ALERTS.TIMESTAMP]),
        item_id:       row[COL.ALERTS.ITEM_ID],
        alert_type:    row[COL.ALERTS.ALERT_TYPE],
        current_qty:   row[COL.ALERTS.CURRENT_QTY],
        reorder_level: row[COL.ALERTS.REORDER_LEVEL],
        expiry_date:   row[COL.ALERTS.EXPIRY_DATE] ? formatDate(row[COL.ALERTS.EXPIRY_DATE]) : '',
        status:        row[COL.ALERTS.STATUS],
        notes:         row[COL.ALERTS.NOTES],
        product_name:  meta.product_name || '',
        unit_type:     meta.unit_type || '',
        category:      meta.category || '',
      };
    });
}

/**
 * Send a daily email digest of open alerts.
 * Only sends if SYSTEM.ALERT_EMAIL is configured.
 */
function _sendAlertDigest() {
  if (!SYSTEM.ALERT_EMAIL) return;

  const alerts = getOpenAlerts();
  if (alerts.length === 0) return;

  const lowStock    = alerts.filter(a => a.alert_type === 'LOW_STOCK');
  const outOfStock  = alerts.filter(a => a.alert_type === 'OUT_OF_STOCK');
  const expiring    = alerts.filter(a => a.alert_type === 'EXPIRY');
  const stale       = alerts.filter(a => a.alert_type === 'CONTAINER_STALE');

  let body = `Kitchen Inventory Alert — ${today()}\n\n`;

  if (outOfStock.length) {
    body += `OUT OF STOCK (${outOfStock.length}):\n`;
    outOfStock.forEach(a => body += `  • ${a.product_name}\n`);
    body += '\n';
  }
  if (lowStock.length) {
    body += `LOW STOCK (${lowStock.length}):\n`;
    lowStock.forEach(a => body += `  • ${a.product_name} — ${a.current_qty} ${a.unit_type} remaining (reorder at ${a.reorder_level})\n`);
    body += '\n';
  }
  if (expiring.length) {
    body += `EXPIRING SOON (${expiring.length}):\n`;
    expiring.forEach(a => body += `  • ${a.product_name} — expires ${a.expiry_date}\n`);
    body += '\n';
  }
  if (stale.length) {
    body += `STALE OPEN CONTAINERS (${stale.length}):\n`;
    stale.forEach(a => body += `  • ${a.product_name} — estimate not updated in ${SYSTEM.STALE_CONTAINER_DAYS}+ days\n`);
  }

  MailApp.sendEmail({
    to: SYSTEM.ALERT_EMAIL,
    subject: `🔔 Kitchen Inventory: ${alerts.length} alert${alerts.length > 1 ? 's' : ''} — ${today()}`,
    body: body,
  });

  Logger.log(`Alert digest sent to ${SYSTEM.ALERT_EMAIL}`);
}


// ============================================================
// DashboardSync.gs
// Recalculates the DASHBOARD tab after every event.
// ============================================================

/**
 * Refresh all dashboard metrics. Called after inbound/outbound events.
 */
function refreshDashboard() {
  const masterData     = getSheetData(SHEETS.MASTER);
  const alertsData     = getSheetData(SHEETS.ALERTS);
  const containersData = getSheetData(SHEETS.CONTAINERS);
  const inboundData    = getSheetData(SHEETS.INBOUND);

  const now = new Date();

  // Total SKUs
  const totalSkus = masterData.filter(r => r[COL.MASTER.STATUS] !== 'DISCONTINUED').length;

  // By consumption track
  const familyItems = masterData.filter(r => r[COL.MASTER.CONSUMPTION_TRACK] === 'FAMILY').length;
  const staffItems  = masterData.filter(r => r[COL.MASTER.CONSUMPTION_TRACK] === 'STAFF').length;
  const sharedItems = masterData.filter(r => r[COL.MASTER.CONSUMPTION_TRACK] === 'SHARED').length;

  // Low stock (below reorder level, not zero)
  const lowStockCount = masterData.filter(r => {
    const qty    = parseFloat(r[COL.MASTER.CURRENT_QTY]) || 0;
    const reorder= parseFloat(r[COL.MASTER.REORDER_LEVEL]) || 0;
    return reorder > 0 && qty > 0 && qty <= reorder;
  }).length;

  // Out of stock
  const outOfStock = masterData.filter(r => r[COL.MASTER.STATUS] === 'OUT_OF_STOCK').length;

  // Expiring within 7 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + SYSTEM.EXPIRY_ALERT_DAYS);
  const expiringSoon = inboundData.filter(r => {
    const exp = r[COL.INBOUND.EXPIRY_DATE];
    if (!exp) return false;
    const d = new Date(exp);
    return !isNaN(d.getTime()) && d <= cutoff && d >= now;
  }).length;

  // Open containers
  const openContainers = containersData.filter(r => r[COL.CONTAINERS.STATUS] === 'OPEN').length;

  // Pending overrides (open alerts count)
  const openAlerts = alertsData.filter(r => r[COL.ALERTS.STATUS] === 'OPEN').length;

  // Write to DASHBOARD sheet
  const sheet = getSheet(SHEETS.DASHBOARD);
  const updates = [
    ['total_skus',        totalSkus,       formatDate(now)],
    ['family_items',      familyItems,     formatDate(now)],
    ['staff_items',       staffItems,      formatDate(now)],
    ['shared_items',      sharedItems,     formatDate(now)],
    ['low_stock_count',   lowStockCount,   formatDate(now)],
    ['expiring_7_days',   expiringSoon,    formatDate(now)],
    ['out_of_stock',      outOfStock,      formatDate(now)],
    ['open_containers',   openContainers,  formatDate(now)],
    ['pending_overrides', openAlerts,      formatDate(now)],
    ['last_sync',         formatDate(now), formatDate(now)],
  ];

  sheet.getRange(2, 1, updates.length, 3).setValues(updates);
  Logger.log('Dashboard refreshed');
}

/**
 * Get dashboard metrics as a clean object (for the API).
 */
function getDashboardData() {
  const data = getSheetData(SHEETS.DASHBOARD);
  const result = {};
  data.forEach(row => {
    result[row[0]] = row[1];
  });
  return result;
}
