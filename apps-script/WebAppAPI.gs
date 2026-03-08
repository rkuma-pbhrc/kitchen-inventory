// ============================================================
// WebAppAPI.gs
// Exposes the entire system as a REST API.
// Deploy as a Google Apps Script Web App.
// The React front-end communicates exclusively through this file.
//
// HOW TO DEPLOY:
//   1. In Apps Script editor: Deploy → New Deployment
//   2. Type: Web App
//   3. Execute as: Me
//   4. Who has access: Anyone (or your Google Workspace domain)
//   5. Copy the deployment URL → paste into React .env as VITE_API_URL
//
// CORS NOTE:
//   Apps Script Web Apps do not support custom CORS headers.
//   The front-end must use the URL directly without preflight.
//   For cross-origin requests, the React app sends requests
//   with no-cors mode or via a proxy. See api.js in the React app.
// ============================================================

/**
 * Handle GET requests.
 * Usage: GET ?endpoint=<name>&param1=value1...
 */
function doGet(e) {
  try {
    _checkOrigin(e);
    const endpoint = e.parameter.endpoint;
    if (!endpoint) return errorResponse('endpoint parameter required');

    switch (endpoint) {

      case 'health':
        return successResponse({ status: 'ok', version: SYSTEM.VERSION, timestamp: new Date().toISOString() });

      case 'resolveBarcode':
        return successResponse(lookupBarcode(e.parameter.barcode));

      case 'getInventory':
        return successResponse({
          items: getAllInventoryItems({
            category:          e.parameter.category || null,
            consumption_track: e.parameter.consumption_track || null,
            storage_location:  e.parameter.storage_location || null,
            status:            e.parameter.status || null,
            search:            e.parameter.search || null,
          })
        });

      case 'getItemDetail':
        const item = _getMasterItemById(e.parameter.item_id);
        if (!item) return errorResponse('Item not found', 404);
        const history = getItemHistory(e.parameter.item_id);
        const containers = getContainersByItem(e.parameter.item_id);
        const overrides  = getOverrideHistory(e.parameter.item_id);
        return successResponse({ item: _masterRowToObject(item), history, containers, overrides });

      case 'getAlerts':
        return successResponse({ alerts: getOpenAlerts() });

      case 'getDashboard':
        return successResponse({ dashboard: getDashboardData() });

      case 'getOpenContainers':
        return successResponse({ containers: getOpenContainers() });

      case 'getCategories':
        return successResponse({ categories: _getCategoriesStructured() });

      case 'getProducts':
        return successResponse({ products: getAllProducts() });

      case 'searchProducts':
        return successResponse({ products: searchProducts(e.parameter.query) });

      case 'getOptions':
        return successResponse({ options: OPTIONS });

      case 'getOverrides':
        return successResponse({ overrides: getAllOverrides() });

      default:
        return errorResponse(`Unknown endpoint: ${endpoint}`, 404);
    }

  } catch (err) {
    Logger.log(`doGet error: ${err.message}\n${err.stack}`);
    return errorResponse(err.message, 500);
  }
}

/**
 * Handle POST requests.
 * Usage: POST with JSON body { endpoint: <name>, ...payload }
 */
function doPost(e) {
  try {
    _checkOrigin(e);
    let payload = {};

    if (e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const endpoint = payload.endpoint || e.parameter.endpoint;
    if (!endpoint) return errorResponse('endpoint required');

    switch (endpoint) {

      case 'addStock':
        return successResponse(addStock(payload));

      case 'removeStock':
        return successResponse(removeStock(payload));

      case 'registerProduct':
        return successResponse(registerNewProduct(payload));

      case 'openContainer':
        return successResponse(openContainer(payload));

      case 'updateContainerEstimate':
        return successResponse(updateContainerEstimate(
          payload.container_id,
          payload.remaining_qty,
          payload.estimated_by
        ));

      case 'reconcileContainer':
        return successResponse(reconcileContainer(
          payload.container_id,
          payload.final_qty,
          payload.reconciled_by
        ));

      case 'submitOverride':
        return successResponse(submitOverride(
          payload.item_id,
          payload.new_qty,
          payload.reason,
          payload.override_by,
          payload.notes
        ));

      case 'acknowledgeAlert':
        return successResponse(acknowledgeAlert(payload.alert_id));

      case 'resolveAlert':
        return successResponse(resolveAlert(payload.alert_id));

      case 'updateReorderLevel':
        return successResponse(_updateReorderLevel(
          payload.item_id,
          payload.reorder_level,
          payload.reorder_qty
        ));

      case 'updateItemStatus':
        return successResponse(_updateItemStatus(payload.item_id, payload.status));

      case 'runAlertScan':
        runDailyAlertScan();
        return successResponse({ message: 'Alert scan complete' });

      default:
        return errorResponse(`Unknown endpoint: ${endpoint}`, 404);
    }

  } catch (err) {
    Logger.log(`doPost error: ${err.message}\n${err.stack}`);
    return errorResponse(err.message, 500);
  }
}

// ── Private helpers ──────────────────────────────────────────

/**
 * Basic origin check. Extend this for production security.
 */
function _checkOrigin(e) {
  // In production, validate e.parameter.token against your USERS sheet
  // For now, all requests are allowed (the Web App URL is the secret)
}

/**
 * Get categories in a structured format for dropdowns.
 * Returns { [categoryName]: [subCategoryName, ...], ... }
 */
function _getCategoriesStructured() {
  const data = getSheetData(SHEETS.CATEGORIES);
  const result = {};

  data.forEach(row => {
    const catName = row[COL.CATEGORIES.CATEGORY_NAME];
    const subName = row[COL.CATEGORIES.SUB_CATEGORY_NAME];
    const catId   = row[COL.CATEGORIES.CATEGORY_ID];
    const icon    = row[COL.CATEGORIES.ICON];

    if (!result[catName]) {
      result[catName] = { id: catId, icon: icon, sub_categories: [] };
    }
    if (subName) {
      result[catName].sub_categories.push({
        id:   row[COL.CATEGORIES.SUB_CATEGORY_ID],
        name: subName,
      });
    }
  });

  return result;
}

/**
 * Update reorder level and qty for a master item.
 */
function _updateReorderLevel(itemId, reorderLevel, reorderQty) {
  const sheet = getSheet(SHEETS.MASTER);
  const data  = getSheetData(SHEETS.MASTER);

  for (let i = 0; i < data.length; i++) {
    if (String(data[i][COL.MASTER.ITEM_ID]) === String(itemId)) {
      sheet.getRange(i + 2, COL.MASTER.REORDER_LEVEL + 1).setValue(parseFloat(reorderLevel) || 0);
      sheet.getRange(i + 2, COL.MASTER.REORDER_QTY + 1).setValue(parseFloat(reorderQty) || 0);
      return { success: true, item_id: itemId };
    }
  }
  throw new Error(`Item not found: ${itemId}`);
}

/**
 * Update status of a master item.
 */
function _updateItemStatus(itemId, status) {
  if (!OPTIONS.ITEM_STATUS.includes(status)) throw new Error('Invalid status');
  _setMasterStatus(itemId, status);
  return { success: true, item_id: itemId, status };
}
