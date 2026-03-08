// ============================================================
// BarcodeResolver.gs
// Resolves a barcode to a product. Checks PRODUCTS_DB first,
// falls back to Open Food Facts API for unknown barcodes.
// Fires on every scan — its job is product identification.
// ============================================================

/**
 * Main resolver. Called by WebAppAPI on every scan.
 * @param {string} barcode
 * @returns {object} { found, product } or { found: false }
 */
function lookupBarcode(barcode) {
  if (!barcode) throw new Error('Barcode is required');

  barcode = String(barcode).trim();

  // 1. Check local PRODUCTS_DB first
  const localProduct = _lookupInProductsDb(barcode);
  if (localProduct) {
    Logger.log(`Barcode resolved locally: ${barcode}`);
    return { found: true, source: 'local', product: localProduct };
  }

  // 2. Fall back to Open Food Facts
  const offProduct = _fetchFromOpenFoodFacts(barcode);
  if (offProduct) {
    Logger.log(`Barcode resolved via OpenFoodFacts: ${barcode}`);
    return { found: true, source: 'openfoodfacts', product: offProduct };
  }

  Logger.log(`Barcode not found: ${barcode}`);
  return { found: false, barcode: barcode };
}

/**
 * Register a new product into PRODUCTS_DB.
 * Called when user confirms a new product form.
 * @param {object} data - product fields
 * @returns {object} the saved product
 */
function registerNewProduct(data) {
  const required = ['barcode', 'product_name', 'default_category', 'default_unit_type'];
  required.forEach(field => {
    if (!data[field]) throw new Error(`Missing required field: ${field}`);
  });

  // Check for duplicate
  const existing = _lookupInProductsDb(data.barcode);
  if (existing) {
    Logger.log(`Product already exists for barcode: ${data.barcode}. Updating.`);
    return _updateProductInDb(data);
  }

  const sheet = getSheet(SHEETS.PRODUCTS);
  const row = [
    data.barcode,
    data.product_name,
    data.brand || '',
    data.default_category,
    data.default_sub_category || '',
    data.default_unit_type,
    data.pack_size || '',
    data.default_consumption_track || 'SHARED',
    data.image_url || '',
    data.notes || '',
  ];

  sheet.appendRow(row);
  Logger.log(`New product registered: ${data.product_name} (${data.barcode})`);
  return _rowToProduct(row);
}

/**
 * Update an existing product in PRODUCTS_DB.
 * @param {object} data
 */
function _updateProductInDb(data) {
  const sheet = getSheet(SHEETS.PRODUCTS);
  const allData = getSheetData(SHEETS.PRODUCTS);

  for (let i = 0; i < allData.length; i++) {
    if (String(allData[i][COL.PRODUCTS.BARCODE]) === String(data.barcode)) {
      const rowNum = i + 2; // +2 for header and 0-index
      const updates = [
        data.barcode,
        data.product_name        || allData[i][COL.PRODUCTS.PRODUCT_NAME],
        data.brand               || allData[i][COL.PRODUCTS.BRAND],
        data.default_category    || allData[i][COL.PRODUCTS.DEFAULT_CATEGORY],
        data.default_sub_category|| allData[i][COL.PRODUCTS.DEFAULT_SUB_CAT],
        data.default_unit_type   || allData[i][COL.PRODUCTS.DEFAULT_UNIT_TYPE],
        data.pack_size           || allData[i][COL.PRODUCTS.PACK_SIZE],
        data.default_consumption_track || allData[i][COL.PRODUCTS.DEFAULT_TRACK],
        data.image_url           || allData[i][COL.PRODUCTS.IMAGE_URL],
        data.notes               || allData[i][COL.PRODUCTS.NOTES],
      ];
      sheet.getRange(rowNum, 1, 1, updates.length).setValues([updates]);
      return _rowToProduct(updates);
    }
  }
}

// ── Private: look up barcode in PRODUCTS_DB ──────────────────
function _lookupInProductsDb(barcode) {
  const data = getSheetData(SHEETS.PRODUCTS);
  for (const row of data) {
    if (String(row[COL.PRODUCTS.BARCODE]).trim() === String(barcode).trim()) {
      return _rowToProduct(row);
    }
  }
  return null;
}

// ── Private: query Open Food Facts ──────────────────────────
function _fetchFromOpenFoodFacts(barcode) {
  try {
    const url = `${SYSTEM.OPEN_FOOD_FACTS_URL}${barcode}.json`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });

    if (response.getResponseCode() !== 200) return null;

    const json = JSON.parse(response.getContentText());
    if (json.status !== 1 || !json.product) return null;

    const p = json.product;

    return {
      barcode:                  barcode,
      product_name:             p.product_name || p.product_name_en || '',
      brand:                    p.brands || '',
      default_category:         '', // User must confirm category
      default_sub_category:     '',
      default_unit_type:        _guessUnitType(p),
      pack_size:                _extractPackSize(p),
      default_consumption_track:'SHARED',
      image_url:                p.image_front_url || '',
      notes:                    '',
      // Extra OFF fields for display
      _off_ingredients:         p.ingredients_text || '',
      _off_nutriscore:          p.nutriscore_grade || '',
    };
  } catch (e) {
    Logger.log(`Open Food Facts error: ${e.message}`);
    return null;
  }
}

// ── Private: map a PRODUCTS_DB row to a product object ──────
function _rowToProduct(row) {
  return {
    barcode:                  row[COL.PRODUCTS.BARCODE],
    product_name:             row[COL.PRODUCTS.PRODUCT_NAME],
    brand:                    row[COL.PRODUCTS.BRAND],
    default_category:         row[COL.PRODUCTS.DEFAULT_CATEGORY],
    default_sub_category:     row[COL.PRODUCTS.DEFAULT_SUB_CAT],
    default_unit_type:        row[COL.PRODUCTS.DEFAULT_UNIT_TYPE],
    pack_size:                row[COL.PRODUCTS.PACK_SIZE],
    default_consumption_track:row[COL.PRODUCTS.DEFAULT_TRACK],
    image_url:                row[COL.PRODUCTS.IMAGE_URL],
    notes:                    row[COL.PRODUCTS.NOTES],
  };
}

// ── Private: guess unit type from OFF product data ───────────
function _guessUnitType(p) {
  const qty = String(p.quantity || '').toLowerCase();
  if (qty.includes('ml'))  return 'ml';
  if (qty.includes(' l'))  return 'L';
  if (qty.includes('kg'))  return 'kg';
  if (qty.includes(' g'))  return 'g';
  if (qty.includes('pcs') || qty.includes('pieces')) return 'pcs';
  return 'pack';
}

// ── Private: extract numeric pack size from OFF data ─────────
function _extractPackSize(p) {
  const qty = String(p.quantity || '');
  const match = qty.match(/[\d.]+/);
  return match ? parseFloat(match[0]) : '';
}

/**
 * Get all products from PRODUCTS_DB (for the admin UI).
 * @returns {Array} array of product objects
 */
function getAllProducts() {
  const data = getSheetData(SHEETS.PRODUCTS);
  return data.map(row => _rowToProduct(row));
}

/**
 * Search products by name or brand.
 * @param {string} query
 * @returns {Array}
 */
function searchProducts(query) {
  if (!query) return getAllProducts();
  const q = query.toLowerCase();
  return getAllProducts().filter(p =>
    p.product_name.toLowerCase().includes(q) ||
    p.brand.toLowerCase().includes(q)
  );
}
