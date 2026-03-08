// ============================================================
// InventoryInbound.gs
// Handles all stock additions. Writes to INBOUND_LOG and
// updates MASTER_INVENTORY. Auto-sets purchase_date to today.
// ============================================================

/**
 * Add stock to inventory.
 * @param {object} data - inbound payload
 * @returns {object} { log_id, item_id, new_qty }
 */
function addStock(data) {
  _validateInboundData(data);

  const logId = generateId('IN');
  const now = new Date();
  const purchaseDate = data.purchase_date || today();

  // 1. Find or create the item in MASTER_INVENTORY
  const item = _findOrCreateMasterItem(data);

  // 2. Write to INBOUND_LOG
  const inboundSheet = getSheet(SHEETS.INBOUND);
  const inboundRow = [
    logId,
    purchaseDate,
    now,
    item.item_id,
    data.barcode,
    data.product_name,
    data.brand || '',
    data.category,
    data.sub_category || '',
    data.qty_added,
    data.unit_type,
    data.unit_price || '',
    data.unit_price ? (parseFloat(data.unit_price) * parseFloat(data.qty_added)) : '',
    data.supplier || '',
    data.invoice_no || '',
    data.expiry_date || '',
    data.storage_location,
    data.entered_by || Session.getActiveUser().getEmail(),
    data.consumption_track,
    data.notes || '',
  ];
  inboundSheet.appendRow(inboundRow);

  // 3. Update MASTER_INVENTORY qty
  const newQty = _incrementMasterQty(item.item_id, parseFloat(data.qty_added));

  // 4. Refresh dashboard
  try { refreshDashboard(); } catch(e) {}

  Logger.log(`Stock added: ${data.product_name} | qty: ${data.qty_added} | item_id: ${item.item_id}`);

  return {
    success: true,
    log_id: logId,
    item_id: item.item_id,
    new_qty: newQty,
    product_name: data.product_name,
  };
}

/**
 * Validate required inbound fields.
 */
function _validateInboundData(data) {
  const required = ['barcode', 'product_name', 'qty_added', 'unit_type', 'category', 'storage_location', 'consumption_track'];
  required.forEach(field => {
    if (data[field] === undefined || data[field] === null || data[field] === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  });
  if (parseFloat(data.qty_added) <= 0) throw new Error('qty_added must be greater than 0');
  if (!OPTIONS.CONSUMPTION_TRACK.includes(data.consumption_track)) throw new Error('Invalid consumption_track');
  if (!OPTIONS.UNIT_TYPE.includes(data.unit_type)) throw new Error('Invalid unit_type');
}

/**
 * Find existing master item by barcode or create a new one.
 */
function _findOrCreateMasterItem(data) {
  const masterData = getSheetData(SHEETS.MASTER);
  for (const row of masterData) {
    if (String(row[COL.MASTER.BARCODE]).trim() === String(data.barcode).trim()) {
      return { item_id: row[COL.MASTER.ITEM_ID], exists: true };
    }
  }

  // Create new master item
  const itemId = generateId('ITEM');
  const masterSheet = getSheet(SHEETS.MASTER);
  masterSheet.appendRow([
    itemId,
    data.barcode,
    data.product_name,
    data.brand || '',
    data.category,
    data.sub_category || '',
    data.unit_type,
    0, // current_qty — will be incremented next
    data.reorder_level || 0,
    data.reorder_qty || 0,
    data.storage_location,
    data.consumption_track,
    new Date(),
    '', '', // override fields
    'ACTIVE',
  ]);
  Logger.log(`New master item created: ${itemId}`);
  return { item_id: itemId, exists: false };
}

/**
 * Increment current_qty in MASTER_INVENTORY for a given item_id.
 */
function _incrementMasterQty(itemId, qty) {
  const sheet = getSheet(SHEETS.MASTER);
  const data = getSheetData(SHEETS.MASTER);

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.MASTER.ITEM_ID]) === String(itemId)) {
      const rowNum = i + 2;
      const currentQty = parseFloat(data[i][COL.MASTER.CURRENT_QTY]) || 0;
      const newQty = currentQty + qty;

      sheet.getRange(rowNum, COL.MASTER.CURRENT_QTY + 1).setValue(newQty);
      sheet.getRange(rowNum, COL.MASTER.LAST_UPDATED + 1).setValue(new Date());

      // Clear OUT_OF_STOCK status if it was set
      if (String(data[i][COL.MASTER.STATUS]) === 'OUT_OF_STOCK') {
        sheet.getRange(rowNum, COL.MASTER.STATUS + 1).setValue('ACTIVE');
      }

      return newQty;
    }
  }
  throw new Error(`Item not found in MASTER_INVENTORY: ${itemId}`);
}


// ============================================================
// InventoryOutbound.gs
// Handles all stock deductions. Prevents negative stock.
// Writes to OUTBOUND_LOG. Triggers low-stock alerts.
// ============================================================

/**
 * Remove stock from inventory.
 * @param {object} data - outbound payload
 * @returns {object} { log_id, item_id, new_qty }
 */
function removeStock(data) {
  _validateOutboundData(data);

  // 1. Get current master item
  const masterItem = _getMasterItemById(data.item_id);
  if (!masterItem) throw new Error(`Item not found: ${data.item_id}`);

  const currentQty = parseFloat(masterItem[COL.MASTER.CURRENT_QTY]) || 0;
  const qtyToRemove = parseFloat(data.qty_removed);

  // 2. Prevent negative stock
  if (qtyToRemove > currentQty) {
    throw new Error(`Insufficient stock. Current: ${currentQty} ${masterItem[COL.MASTER.UNIT_TYPE]}, Requested: ${qtyToRemove}`);
  }

  const logId = generateId('OUT');
  const now = new Date();

  // 3. Write to OUTBOUND_LOG
  const outboundSheet = getSheet(SHEETS.OUTBOUND);
  outboundSheet.appendRow([
    logId,
    now,
    data.item_id,
    masterItem[COL.MASTER.BARCODE],
    qtyToRemove,
    data.drawdown_reason,
    data.recipe_id || '',
    data.meal_event_id || '',
    data.drawn_by || Session.getActiveUser().getEmail(),
    masterItem[COL.MASTER.CONSUMPTION_TRACK],
    data.notes || '',
  ]);

  // 4. Decrement MASTER_INVENTORY
  const newQty = _decrementMasterQty(data.item_id, qtyToRemove);

  // 5. Check reorder threshold
  _checkReorderThreshold(data.item_id, newQty, masterItem);

  // 6. Refresh dashboard
  try { refreshDashboard(); } catch(e) {}

  Logger.log(`Stock removed: ${data.item_id} | qty: ${qtyToRemove} | reason: ${data.drawdown_reason}`);

  return {
    success: true,
    log_id: logId,
    item_id: data.item_id,
    new_qty: newQty,
    unit_type: masterItem[COL.MASTER.UNIT_TYPE],
  };
}

/**
 * Validate required outbound fields.
 */
function _validateOutboundData(data) {
  const required = ['item_id', 'qty_removed', 'drawdown_reason'];
  required.forEach(field => {
    if (!data[field]) throw new Error(`Missing required field: ${field}`);
  });
  if (parseFloat(data.qty_removed) <= 0) throw new Error('qty_removed must be greater than 0');
  if (!OPTIONS.DRAWDOWN_REASON.includes(data.drawdown_reason)) throw new Error('Invalid drawdown_reason');
}

/**
 * Decrement current_qty in MASTER_INVENTORY.
 */
function _decrementMasterQty(itemId, qty) {
  const sheet = getSheet(SHEETS.MASTER);
  const data = getSheetData(SHEETS.MASTER);

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.MASTER.ITEM_ID]) === String(itemId)) {
      const rowNum = i + 2;
      const currentQty = parseFloat(data[i][COL.MASTER.CURRENT_QTY]) || 0;
      const newQty = Math.max(0, currentQty - qty);

      sheet.getRange(rowNum, COL.MASTER.CURRENT_QTY + 1).setValue(newQty);
      sheet.getRange(rowNum, COL.MASTER.LAST_UPDATED + 1).setValue(new Date());

      if (newQty === 0) {
        sheet.getRange(rowNum, COL.MASTER.STATUS + 1).setValue('OUT_OF_STOCK');
      }

      return newQty;
    }
  }
  throw new Error(`Item not found: ${itemId}`);
}

/**
 * Check if qty has dropped below reorder level and fire alert.
 */
function _checkReorderThreshold(itemId, newQty, masterItem) {
  const reorderLevel = parseFloat(masterItem[COL.MASTER.REORDER_LEVEL]) || 0;
  if (reorderLevel > 0 && newQty <= reorderLevel) {
    const alertType = newQty === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK';
    _createAlert(itemId, alertType, newQty, reorderLevel, '');
  }
}

/**
 * Get a single master item row by item_id.
 */
function _getMasterItemById(itemId) {
  const data = getSheetData(SHEETS.MASTER);
  return data.find(row => String(row[COL.MASTER.ITEM_ID]) === String(itemId)) || null;
}

/**
 * Get all master items (for the inventory list UI).
 */
function getAllInventoryItems(filters) {
  const data = getSheetData(SHEETS.MASTER);
  let items = data.map(row => _masterRowToObject(row));

  if (filters) {
    if (filters.category)         items = items.filter(i => i.category === filters.category);
    if (filters.consumption_track)items = items.filter(i => i.consumption_track === filters.consumption_track);
    if (filters.storage_location) items = items.filter(i => i.storage_location === filters.storage_location);
    if (filters.status)           items = items.filter(i => i.status === filters.status);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(i =>
        i.product_name.toLowerCase().includes(q) ||
        i.brand.toLowerCase().includes(q) ||
        i.barcode.includes(q)
      );
    }
  }

  return items;
}

/**
 * Get item history (inbound + outbound).
 */
function getItemHistory(itemId) {
  const inbound = getSheetData(SHEETS.INBOUND)
    .filter(row => String(row[COL.INBOUND.ITEM_ID]) === String(itemId))
    .map(row => ({ type: 'inbound', ...row }));

  const outbound = getSheetData(SHEETS.OUTBOUND)
    .filter(row => String(row[COL.OUTBOUND.ITEM_ID]) === String(itemId))
    .map(row => ({ type: 'outbound', ...row }));

  return { inbound, outbound };
}

/**
 * Map a MASTER row array to a readable object.
 */
function _masterRowToObject(row) {
  return {
    item_id:            row[COL.MASTER.ITEM_ID],
    barcode:            row[COL.MASTER.BARCODE],
    product_name:       row[COL.MASTER.PRODUCT_NAME],
    brand:              row[COL.MASTER.BRAND],
    category:           row[COL.MASTER.CATEGORY],
    sub_category:       row[COL.MASTER.SUB_CATEGORY],
    unit_type:          row[COL.MASTER.UNIT_TYPE],
    current_qty:        parseFloat(row[COL.MASTER.CURRENT_QTY]) || 0,
    reorder_level:      parseFloat(row[COL.MASTER.REORDER_LEVEL]) || 0,
    reorder_qty:        parseFloat(row[COL.MASTER.REORDER_QTY]) || 0,
    storage_location:   row[COL.MASTER.STORAGE_LOCATION],
    consumption_track:  row[COL.MASTER.CONSUMPTION_TRACK],
    last_updated:       row[COL.MASTER.LAST_UPDATED],
    last_override_date: row[COL.MASTER.LAST_OVERRIDE_DATE],
    last_override_by:   row[COL.MASTER.LAST_OVERRIDE_BY],
    status:             row[COL.MASTER.STATUS],
  };
}
