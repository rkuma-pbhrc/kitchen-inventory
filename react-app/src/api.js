// ============================================================
// api.js
// Single API client for all Apps Script Web App calls.
// All fetch() calls in the app go through this file.
// Set VITE_API_URL in your .env file.
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL;

if (!BASE_URL) {
  console.error('VITE_API_URL is not set. Create a .env file with your Apps Script deployment URL.');
}

// ── Core fetch wrapper ────────────────────────────────────────

async function _get(endpoint, params = {}) {
  const url = new URL(BASE_URL);
  url.searchParams.set('endpoint', endpoint);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== null && v !== undefined && v !== '') url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), {
    method: 'GET',
    redirect: 'follow',
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Unknown error');
  return data;
}

async function _post(endpoint, payload = {}) {
  const res = await fetch(BASE_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain' }, // Apps Script requires text/plain for POST
    body: JSON.stringify({ endpoint, ...payload }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.success) throw new Error(data.error || 'Unknown error');
  return data;
}

// ── Health ────────────────────────────────────────────────────

export const checkHealth = () => _get('health');

// ── Barcode ───────────────────────────────────────────────────

export const resolveBarcode = (barcode) =>
  _get('resolveBarcode', { barcode });

export const registerProduct = (data) =>
  _post('registerProduct', data);

export const getProducts = () => _get('getProducts');

export const searchProducts = (query) =>
  _get('searchProducts', { query });

// ── Inventory ─────────────────────────────────────────────────

export const getInventory = (filters = {}) =>
  _get('getInventory', filters);

export const getItemDetail = (item_id) =>
  _get('getItemDetail', { item_id });

export const addStock = (data) =>
  _post('addStock', data);

export const removeStock = (data) =>
  _post('removeStock', data);

export const updateReorderLevel = (item_id, reorder_level, reorder_qty) =>
  _post('updateReorderLevel', { item_id, reorder_level, reorder_qty });

export const updateItemStatus = (item_id, status) =>
  _post('updateItemStatus', { item_id, status });

// ── Open Containers ───────────────────────────────────────────

export const getOpenContainers = () =>
  _get('getOpenContainers');

export const openContainer = (data) =>
  _post('openContainer', data);

export const updateContainerEstimate = (container_id, remaining_qty) =>
  _post('updateContainerEstimate', { container_id, remaining_qty });

export const reconcileContainer = (container_id, final_qty) =>
  _post('reconcileContainer', { container_id, final_qty });

// ── Stock Override ────────────────────────────────────────────

export const submitOverride = (item_id, new_qty, reason, notes) =>
  _post('submitOverride', { item_id, new_qty, reason, notes });

export const getAllOverrides = () =>
  _get('getOverrides');

// ── Alerts ────────────────────────────────────────────────────

export const getAlerts = () =>
  _get('getAlerts');

export const acknowledgeAlert = (alert_id) =>
  _post('acknowledgeAlert', { alert_id });

export const resolveAlert = (alert_id) =>
  _post('resolveAlert', { alert_id });

// ── Dashboard ─────────────────────────────────────────────────

export const getDashboard = () =>
  _get('getDashboard');

// ── Reference data ────────────────────────────────────────────

export const getCategories = () =>
  _get('getCategories');

export const getOptions = () =>
  _get('getOptions');
