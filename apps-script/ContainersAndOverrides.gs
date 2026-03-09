// ── Date/time helpers ───────────────────────────────────────
function _ds_c(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy'); }
function _ts_c(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm:ss'); }

// ============================================================
// OpenContainerTracker.gs
// Manages partially-used / decanted packs.
// Stock is NOT decremented when a container is opened.
// Deduction only happens on reconciliation (mark empty).
// ============================================================

/**
 * Open a container — called when a sealed pack is decanted.
 * @param {object} data { item_id, barcode, original_qty, unit_type, storage_location, opened_by }
 */
function openContainer(data) {
  const required = ['item_id', 'original_qty', 'unit_type', 'storage_location'];
  required.forEach(f => { if (!data[f]) throw new Error(`Missing: ${f}`); });

  const containerId = generateId('CON');
  const sheet = getSheet(SHEETS.CONTAINERS);

  sheet.appendRow([
    containerId,
    data.item_id,
    data.barcode || '',
    parseFloat(data.original_qty),
    parseFloat(data.original_qty), // estimated_remaining starts at full
    data.unit_type,
    today(),
    today(),
    data.opened_by || Session.getActiveUser().getEmail(),
    data.storage_location,
    'OPEN',
    data.notes || '',
  ]);

  // Mark master item as OPEN_PARTIAL
  _setMasterStatus(data.item_id, 'OPEN_PARTIAL');

  Logger.log(`Container opened: ${containerId} for item ${data.item_id}`);
  return { success: true, container_id: containerId };
}

/**
 * Update the estimated remaining qty in an open container.
 * @param {string} containerId
 * @param {number} remainingQty
 * @param {string} estimatedBy
 */
function updateContainerEstimate(containerId, remainingQty, estimatedBy) {
  const sheet = getSheet(SHEETS.CONTAINERS);
  const data = getSheetData(SHEETS.CONTAINERS);

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.CONTAINERS.CONTAINER_ID]) === String(containerId)) {
      const rowNum = i + 2;
      if (String(data[i][COL.CONTAINERS.STATUS]) !== 'OPEN') {
        throw new Error('Container is not in OPEN status');
      }

      sheet.getRange(rowNum, COL.CONTAINERS.ESTIMATED_REMAINING + 1).setValue(parseFloat(remainingQty));
      sheet.getRange(rowNum, COL.CONTAINERS.LAST_ESTIMATED_DATE + 1).setValue(today());
      sheet.getRange(rowNum, COL.CONTAINERS.ESTIMATED_BY + 1).setValue(estimatedBy || Session.getActiveUser().getEmail());

      Logger.log(`Container estimate updated: ${containerId} → ${remainingQty}`);
      return { success: true, container_id: containerId, estimated_remaining: remainingQty };
    }
  }
  throw new Error(`Container not found: ${containerId}`);
}

/**
 * Reconcile a container — called when the container is empty.
 * Writes the consumed qty to OUTBOUND_LOG and decrements MASTER_INVENTORY.
 * @param {string} containerId
 * @param {number} finalQty - actual remaining when marked empty (usually 0)
 */
function reconcileContainer(containerId, finalQty, reconciledBy) {
  const sheet = getSheet(SHEETS.CONTAINERS);
  const data = getSheetData(SHEETS.CONTAINERS);

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.CONTAINERS.CONTAINER_ID]) === String(containerId)) {
      const rowNum = i + 2;
      const row = data[i];

      if (String(row[COL.CONTAINERS.STATUS]) !== 'OPEN') {
        throw new Error('Container is not OPEN');
      }

      const originalQty   = parseFloat(row[COL.CONTAINERS.ORIGINAL_QTY]);
      const remaining     = parseFloat(finalQty) || 0;
      const consumed      = originalQty - remaining;
      const itemId        = row[COL.CONTAINERS.ITEM_ID];

      // Write to OUTBOUND_LOG for the consumed amount
      if (consumed > 0) {
        removeStock({
          item_id:          itemId,
          qty_removed:      consumed,
          drawdown_reason:  'COOKING',
          drawn_by:         reconciledBy || Session.getActiveUser().getEmail(),
          notes:            `Reconciled from container ${containerId}`,
        });
      }

      // Mark container as RECONCILED
      sheet.getRange(rowNum, COL.CONTAINERS.STATUS + 1).setValue('RECONCILED');
      sheet.getRange(rowNum, COL.CONTAINERS.ESTIMATED_REMAINING + 1).setValue(remaining);
      sheet.getRange(rowNum, COL.CONTAINERS.LAST_ESTIMATED_DATE + 1).setValue(today());

      // Reset master status from OPEN_PARTIAL if no other open containers
      _maybeResetMasterStatus(itemId);

      Logger.log(`Container reconciled: ${containerId} | consumed: ${consumed}`);
      return { success: true, container_id: containerId, consumed };
    }
  }
  throw new Error(`Container not found: ${containerId}`);
}

/**
 * Get all open containers (for the Open Containers screen).
 */
function getOpenContainers() {
  const data = getSheetData(SHEETS.CONTAINERS);
  return data
    .filter(row => String(row[COL.CONTAINERS.STATUS]) === 'OPEN')
    .map(row => _containerRowToObject(row));
}

/**
 * Get containers for a specific item.
 */
function getContainersByItem(itemId) {
  const data = getSheetData(SHEETS.CONTAINERS);
  return data
    .filter(row => String(row[COL.CONTAINERS.ITEM_ID]) === String(itemId))
    .map(row => _containerRowToObject(row));
}

// ── Private helpers ──────────────────────────────────────────

function _setMasterStatus(itemId, status) {
  const sheet = getSheet(SHEETS.MASTER);
  const data = getSheetData(SHEETS.MASTER);
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.MASTER.ITEM_ID]) === String(itemId)) {
      sheet.getRange(i + 2, COL.MASTER.STATUS + 1).setValue(status);
      return;
    }
  }
}

function _maybeResetMasterStatus(itemId) {
  const openContainers = getSheetData(SHEETS.CONTAINERS).filter(
    row => String(row[COL.CONTAINERS.ITEM_ID]) === String(itemId) &&
           String(row[COL.CONTAINERS.STATUS]) === 'OPEN'
  );
  if (openContainers.length === 0) {
    _setMasterStatus(itemId, 'ACTIVE');
  }
}

function _containerRowToObject(row) {
  const openedDate         = row[COL.CONTAINERS.OPENED_DATE];
  const lastEstimatedDate  = row[COL.CONTAINERS.LAST_ESTIMATED_DATE];
  const daysSinceEstimate  = lastEstimatedDate
    ? Math.floor((new Date() - new Date(lastEstimatedDate)) / 86400000)
    : null;

  return {
    container_id:       row[COL.CONTAINERS.CONTAINER_ID],
    item_id:            row[COL.CONTAINERS.ITEM_ID],
    original_barcode:   row[COL.CONTAINERS.ORIGINAL_BARCODE],
    original_qty:       parseFloat(row[COL.CONTAINERS.ORIGINAL_QTY]) || 0,
    estimated_remaining:parseFloat(row[COL.CONTAINERS.ESTIMATED_REMAINING]) || 0,
    unit_type:          row[COL.CONTAINERS.UNIT_TYPE],
    opened_date:        formatDate(openedDate),
    last_estimated_date:formatDate(lastEstimatedDate),
    estimated_by:       row[COL.CONTAINERS.ESTIMATED_BY],
    storage_location:   row[COL.CONTAINERS.STORAGE_LOCATION],
    status:             row[COL.CONTAINERS.STATUS],
    notes:              row[COL.CONTAINERS.NOTES],
    days_since_estimate:daysSinceEstimate,
    is_stale:           daysSinceEstimate !== null && daysSinceEstimate >= SYSTEM.STALE_CONTAINER_DAYS,
  };
}


// ============================================================
// StockOverride.gs
// ADMIN-only manual correction of current_qty.
// Every override is logged to STOCK_OVERRIDES — the delta
// is NOT posted to OUTBOUND_LOG, keeping usage analytics clean.
// ============================================================

/**
 * Submit a stock override request.
 * @param {string} itemId
 * @param {number} newQty
 * @param {string} reason
 * @param {string} overrideBy
 * @param {string} notes
 */
function submitOverride(itemId, newQty, reason, overrideBy, notes) {
  if (!itemId) throw new Error('item_id required');
  if (newQty === undefined || newQty === null) throw new Error('newQty required');
  if (!OPTIONS.OVERRIDE_REASON.includes(reason)) throw new Error('Invalid override reason');

  const masterItem = _getMasterItemById(itemId);
  if (!masterItem) throw new Error(`Item not found: ${itemId}`);

  const qtyBefore = parseFloat(masterItem[COL.MASTER.CURRENT_QTY]) || 0;
  const qtyAfter  = parseFloat(newQty);
  const diff      = qtyAfter - qtyBefore;
  const overrideId = generateId('OVR');
  const now = new Date();
  const by  = overrideBy || Session.getActiveUser().getEmail();

  const sheet = getSheet(SHEETS.OVERRIDES);
  sheet.appendRow([
    overrideId,
    now,
    _ds_c(now),
    _ts_c(now),
    itemId,
    qtyBefore,
    qtyAfter,
    diff,
    reason,
    by,
    '', // approved_by — filled in when approved
    notes || '',
  ]);

  // Apply immediately (no approval step needed for home use).
  // If you want a two-step approval flow, set approved_by to '' here
  // and call approveOverride() separately.
  _applyOverrideToMaster(itemId, qtyAfter, by, now);

  Logger.log(`Override submitted and applied: ${overrideId} | ${itemId} | ${qtyBefore} → ${qtyAfter}`);
  return { success: true, override_id: overrideId, qty_before: qtyBefore, qty_after: qtyAfter, difference: diff };
}

/**
 * Apply the override to MASTER_INVENTORY.
 * Called internally after submitOverride.
 */
function _applyOverrideToMaster(itemId, newQty, approvedBy, timestamp) {
  const sheet = getSheet(SHEETS.MASTER);
  const data  = getSheetData(SHEETS.MASTER);

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.MASTER.ITEM_ID]) === String(itemId)) {
      const rowNum = i + 2;
      sheet.getRange(rowNum, COL.MASTER.CURRENT_QTY + 1).setValue(newQty);
      sheet.getRange(rowNum, COL.MASTER.LAST_OVERRIDE_DATE + 1).setValue(formatDate(timestamp));
      sheet.getRange(rowNum, COL.MASTER.LAST_OVERRIDE_BY + 1).setValue(approvedBy);
      sheet.getRange(rowNum, COL.MASTER.LAST_UPDATED + 1).setValue(timestamp);
      sheet.getRange(rowNum, COL.MASTER.LAST_UPDATED_DATE + 1).setValue(_ds_c(timestamp));
      sheet.getRange(rowNum, COL.MASTER.LAST_UPDATED_TIME + 1).setValue(_ts_c(timestamp));

      const newStatus = newQty === 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
      sheet.getRange(rowNum, COL.MASTER.STATUS + 1).setValue(newStatus);
      return;
    }
  }
  throw new Error(`Item not found for override: ${itemId}`);
}

/**
 * Get override history for an item.
 */
function getOverrideHistory(itemId) {
  const data = getSheetData(SHEETS.OVERRIDES);
  return data
    .filter(row => String(row[COL.OVERRIDES.ITEM_ID]) === String(itemId))
    .map(row => ({
      override_id: row[COL.OVERRIDES.OVERRIDE_ID],
      timestamp:   formatDate(row[COL.OVERRIDES.TIMESTAMP]),
      qty_before:  row[COL.OVERRIDES.QTY_BEFORE],
      qty_after:   row[COL.OVERRIDES.QTY_AFTER],
      difference:  row[COL.OVERRIDES.DIFFERENCE],
      reason:      row[COL.OVERRIDES.REASON],
      override_by: row[COL.OVERRIDES.OVERRIDE_BY],
      approved_by: row[COL.OVERRIDES.APPROVED_BY],
      notes:       row[COL.OVERRIDES.NOTES],
    }));
}

/**
 * Get all overrides (for the admin override log).
 */
function getAllOverrides() {
  return getSheetData(SHEETS.OVERRIDES).map(row => ({
    override_id: row[COL.OVERRIDES.OVERRIDE_ID],
    timestamp:   formatDate(row[COL.OVERRIDES.TIMESTAMP]),
    item_id:     row[COL.OVERRIDES.ITEM_ID],
    qty_before:  row[COL.OVERRIDES.QTY_BEFORE],
    qty_after:   row[COL.OVERRIDES.QTY_AFTER],
    difference:  row[COL.OVERRIDES.DIFFERENCE],
    reason:      row[COL.OVERRIDES.REASON],
    override_by: row[COL.OVERRIDES.OVERRIDE_BY],
    approved_by: row[COL.OVERRIDES.APPROVED_BY],
    notes:       row[COL.OVERRIDES.NOTES],
  }));
}
