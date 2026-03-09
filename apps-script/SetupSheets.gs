// ============================================================
// SetupSheets.gs
// One-time bootstrap. Run setupAllSheets() from the Apps Script
// editor to create all 10 sheets, write headers, apply
// formatting, set data validation dropdowns, seed the
// CATEGORIES tab, and apply sheet protection.
//
// IDEMPOTENT: Safe to re-run. Will skip existing sheets and
// only apply missing columns or categories.
// ============================================================

// ── Schema: headers per sheet ────────────────────────────────
const HEADERS = {
  MASTER_INVENTORY: [
    'item_id', 'barcode', 'product_name', 'brand', 'category', 'sub_category',
    'unit_type', 'current_qty', 'reorder_level', 'reorder_qty',
    'storage_location', 'consumption_track', 'last_updated',
    'last_override_date', 'last_override_by', 'status'
  ],
  INBOUND_LOG: [
    'log_id', 'purchase_date', 'timestamp', 'item_id', 'barcode',
    'product_name', 'brand', 'category', 'sub_category',
    'qty_added', 'unit_type', 'unit_price', 'total_cost',
    'supplier', 'invoice_no', 'expiry_date',
    'storage_location', 'entered_by', 'consumption_track', 'notes'
  ],
  OUTBOUND_LOG: [
    'log_id', 'timestamp', 'item_id', 'barcode', 'qty_removed',
    'drawdown_reason', 'recipe_id', 'meal_event_id',
    'drawn_by', 'consumption_track', 'notes'
  ],
  OPEN_CONTAINERS: [
    'container_id', 'item_id', 'original_barcode', 'original_qty',
    'estimated_remaining_qty', 'unit_type', 'opened_date',
    'last_estimated_date', 'estimated_by', 'storage_location', 'status', 'notes'
  ],
  STOCK_OVERRIDES: [
    'override_id', 'timestamp', 'item_id', 'qty_before', 'qty_after',
    'difference', 'reason', 'override_by', 'approved_by', 'notes'
  ],
  PRODUCTS_DB: [
    'barcode', 'product_name', 'brand', 'default_category', 'default_sub_category',
    'default_unit_type', 'pack_size', 'default_consumption_track', 'image_url', 'notes'
  ],
  CATEGORIES: [
    'category_id', 'category_name', 'sub_category_id', 'sub_category_name', 'icon', 'sort_order'
  ],
  ALERTS: [
    'alert_id', 'timestamp', 'item_id', 'alert_type',
    'current_qty', 'reorder_level', 'expiry_date', 'status', 'notes'
  ],
  USERS: [
    'user_id', 'name', 'email', 'role',
    'consumption_track_access', 'can_override_stock', 'active'
  ],
  DASHBOARD: [
    'metric', 'value', 'last_updated'
  ],
};

// ── Tab colours ───────────────────────────────────────────────
const TAB_COLORS = {
  MASTER_INVENTORY: '#1a5276',
  INBOUND_LOG:      '#1e8449',
  OUTBOUND_LOG:     '#922b21',
  OPEN_CONTAINERS:  '#5d4037',
  STOCK_OVERRIDES:  '#4a235a',
  PRODUCTS_DB:      '#7d6608',
  CATEGORIES:       '#2e7d32',
  ALERTS:           '#784212',
  USERS:            '#154360',
  DASHBOARD:        '#0e6655',
};

// ── Column widths (pixels) ────────────────────────────────────
const COL_WIDTHS = {
  item_id:          120,
  log_id:           140,
  override_id:      140,
  container_id:     140,
  barcode:          160,
  product_name:     220,
  brand:            140,
  category:         160,
  sub_category:     180,
  unit_type:        80,
  current_qty:      100,
  qty_added:        90,
  qty_removed:      90,
  reorder_level:    110,
  reorder_qty:      100,
  storage_location: 140,
  consumption_track: 130,
  last_updated:     140,
  purchase_date:    120,
  expiry_date:      120,
  timestamp:        160,
  entered_by:       160,
  drawn_by:         160,
  supplier:         150,
  invoice_no:       130,
  unit_price:       100,
  total_cost:       100,
  notes:            250,
  status:           120,
  default_category: 160,
  default_sub_category: 180,
  default_unit_type: 100,
  default_consumption_track: 150,
  image_url:        200,
  pack_size:        90,
  opened_date:      120,
  last_estimated_date: 150,
  estimated_by:     150,
  estimated_remaining_qty: 150,
  original_qty:     100,
  original_barcode: 160,
  qty_before:       90,
  qty_after:        90,
  difference:       90,
  reason:           130,
  override_by:      150,
  approved_by:      150,
  alert_type:       130,
  reorder_level:    110,
  category_id:      100,
  category_name:    180,
  sub_category_id:  120,
  sub_category_name: 220,
  icon:             60,
  sort_order:       80,
  user_id:          120,
  name:             160,
  email:            200,
  role:             100,
  consumption_track_access: 180,
  can_override_stock: 140,
  active:           80,
  metric:           200,
  value:            120,
  drawdown_reason:  140,
  recipe_id:        120,
  meal_event_id:    130,
};

// ── Data Validations per sheet/column ────────────────────────
const VALIDATIONS = {
  INBOUND_LOG: {
    unit_type:         OPTIONS.UNIT_TYPE,
    consumption_track: OPTIONS.CONSUMPTION_TRACK,
    storage_location:  OPTIONS.STORAGE_LOCATION,
  },
  OUTBOUND_LOG: {
    drawdown_reason:   OPTIONS.DRAWDOWN_REASON,
    consumption_track: OPTIONS.CONSUMPTION_TRACK,
  },
  MASTER_INVENTORY: {
    unit_type:         OPTIONS.UNIT_TYPE,
    consumption_track: OPTIONS.CONSUMPTION_TRACK,
    storage_location:  OPTIONS.STORAGE_LOCATION,
    status:            OPTIONS.ITEM_STATUS,
  },
  STOCK_OVERRIDES: {
    reason: OPTIONS.OVERRIDE_REASON,
  },
  OPEN_CONTAINERS: {
    status:    OPTIONS.CONTAINER_STATUS,
    unit_type: OPTIONS.UNIT_TYPE,
  },
  ALERTS: {
    alert_type: OPTIONS.ALERT_TYPE,
    status:     OPTIONS.ALERT_STATUS,
  },
  USERS: {
    role:   OPTIONS.ROLE,
    active: ['TRUE', 'FALSE'],
  },
};

// ── Categories seed data (all 25 categories) ─────────────────
const CATEGORIES_SEED = [
  // [category_id, category_name, sub_category_id, sub_category_name, icon, sort_order]
  // 01 Grains & Cereals
  ['CAT01', 'Grains & Cereals', 'CAT01-01', 'Rice (Basmati, Sona Masuri, Brown, Parboiled)', '🌾', 1],
  ['CAT01', 'Grains & Cereals', 'CAT01-02', 'Wheat & Atta (Whole wheat, Multigrain)', '🌾', 1],
  ['CAT01', 'Grains & Cereals', 'CAT01-03', 'Millets (Jowar, Bajra, Ragi, Foxtail)', '🌾', 1],
  ['CAT01', 'Grains & Cereals', 'CAT01-04', 'Semolina & Poha', '🌾', 1],
  ['CAT01', 'Grains & Cereals', 'CAT01-05', 'Oats & Cornflakes', '🌾', 1],
  ['CAT01', 'Grains & Cereals', 'CAT01-06', 'Pasta & Noodles', '🌾', 1],
  ['CAT01', 'Grains & Cereals', 'CAT01-07', 'Bread & Bakery', '🌾', 1],
  // 02 Pulses & Legumes
  ['CAT02', 'Pulses & Legumes', 'CAT02-01', 'Dals (Toor, Moong, Masoor, Urad, Chana)', '🫘', 2],
  ['CAT02', 'Pulses & Legumes', 'CAT02-02', 'Whole Legumes (Rajma, Chole, Lobia, Moath)', '🫘', 2],
  ['CAT02', 'Pulses & Legumes', 'CAT02-03', 'Soya Products', '🫘', 2],
  ['CAT02', 'Pulses & Legumes', 'CAT02-04', 'Dried Peas', '🫘', 2],
  // 03 Oils, Fats & Vinegars
  ['CAT03', 'Oils, Fats & Vinegars', 'CAT03-01', 'Cooking Oils (Sunflower, Mustard, Coconut, Groundnut)', '🫙', 3],
  ['CAT03', 'Oils, Fats & Vinegars', 'CAT03-02', 'Vanaspati', '🫙', 3],
  ['CAT03', 'Oils, Fats & Vinegars', 'CAT03-03', 'Premium Oils (Olive, Sesame, Avocado)', '🫙', 3],
  ['CAT03', 'Oils, Fats & Vinegars', 'CAT03-04', 'Ghee & Butter', '🫙', 3],
  ['CAT03', 'Oils, Fats & Vinegars', 'CAT03-05', 'Vinegars (White, Apple Cider, Balsamic, Rice)', '🫙', 3],
  ['CAT03', 'Oils, Fats & Vinegars', 'CAT03-06', 'Cooking Sprays', '🫙', 3],
  // 04 Spices & Masalas
  ['CAT04', 'Spices & Masalas', 'CAT04-01', 'Whole Spices', '🌶️', 4],
  ['CAT04', 'Spices & Masalas', 'CAT04-02', 'Ground Spices', '🌶️', 4],
  ['CAT04', 'Spices & Masalas', 'CAT04-03', 'Kashmiri / Deggi Mirch', '🌶️', 4],
  ['CAT04', 'Spices & Masalas', 'CAT04-04', 'Blended Masalas (Garam Masala, Chaat, Pav Bhaji)', '🌶️', 4],
  ['CAT04', 'Spices & Masalas', 'CAT04-05', 'Regional Masalas (Chettinad, Malvani, Kolhapuri, Sambhar)', '🌶️', 4],
  ['CAT04', 'Spices & Masalas', 'CAT04-06', 'International Spices (Za\'atar, Sumac, Smoked Paprika)', '🌶️', 4],
  ['CAT04', 'Spices & Masalas', 'CAT04-07', 'Dried Herbs (Oregano, Thyme, Rosemary)', '🌶️', 4],
  ['CAT04', 'Spices & Masalas', 'CAT04-08', 'Kewra, Rose Water & Edible Extracts', '🌶️', 4],
  // 05 Condiments & Sauces
  ['CAT05', 'Condiments & Sauces', 'CAT05-01', 'Indian Condiments (Pickles, Chutneys, Papad)', '🧂', 5],
  ['CAT05', 'Condiments & Sauces', 'CAT05-02', 'Soy & Asian Sauces (Oyster, Fish, Hoisin)', '🧂', 5],
  ['CAT05', 'Condiments & Sauces', 'CAT05-03', 'Ketchup & Mustard', '🧂', 5],
  ['CAT05', 'Condiments & Sauces', 'CAT05-04', 'Hot Sauces', '🧂', 5],
  ['CAT05', 'Condiments & Sauces', 'CAT05-05', 'Pasta Sauces', '🧂', 5],
  ['CAT05', 'Condiments & Sauces', 'CAT05-06', 'Mayonnaise & Dressings', '🧂', 5],
  ['CAT05', 'Condiments & Sauces', 'CAT05-07', 'Tamarind & Kokum', '🧂', 5],
  // 06 Canned & Preserved
  ['CAT06', 'Canned & Preserved', 'CAT06-01', 'Canned Vegetables', '🥫', 6],
  ['CAT06', 'Canned & Preserved', 'CAT06-02', 'Canned Legumes', '🥫', 6],
  ['CAT06', 'Canned & Preserved', 'CAT06-03', 'Canned Fish & Seafood', '🥫', 6],
  ['CAT06', 'Canned & Preserved', 'CAT06-04', 'Canned Fruits', '🥫', 6],
  ['CAT06', 'Canned & Preserved', 'CAT06-05', 'Coconut Milk & Cream', '🥫', 6],
  ['CAT06', 'Canned & Preserved', 'CAT06-06', 'Tomato Products (Puree, Paste, Crushed)', '🥫', 6],
  // 07 Baking & Confectionery
  ['CAT07', 'Baking & Confectionery', 'CAT07-01', 'Flours (Maida, Besan, Rice Flour, Almond Flour)', '🧁', 7],
  ['CAT07', 'Baking & Confectionery', 'CAT07-02', 'Leavening (Yeast, Baking Soda, Baking Powder)', '🧁', 7],
  ['CAT07', 'Baking & Confectionery', 'CAT07-03', 'Sugars & Sweeteners', '🧁', 7],
  ['CAT07', 'Baking & Confectionery', 'CAT07-04', 'Chocolate & Cocoa', '🧁', 7],
  ['CAT07', 'Baking & Confectionery', 'CAT07-05', 'Vanilla & Extracts', '🧁', 7],
  ['CAT07', 'Baking & Confectionery', 'CAT07-06', 'Gelatine & Agar', '🧁', 7],
  ['CAT07', 'Baking & Confectionery', 'CAT07-07', 'Nuts & Dried Fruits', '🧁', 7],
  ['CAT07', 'Baking & Confectionery', 'CAT07-08', 'Food Colouring', '🧁', 7],
  // 08 Mithai & Indian Sweets
  ['CAT08', 'Mithai & Indian Sweets', 'CAT08-01', 'Khoya / Mawa', '🍬', 8],
  ['CAT08', 'Mithai & Indian Sweets', 'CAT08-02', 'Chenna & Ricotta', '🍬', 8],
  ['CAT08', 'Mithai & Indian Sweets', 'CAT08-03', 'Condensed & Evaporated Milk', '🍬', 8],
  ['CAT08', 'Mithai & Indian Sweets', 'CAT08-04', 'Edible Silver Leaf (Varak)', '🍬', 8],
  ['CAT08', 'Mithai & Indian Sweets', 'CAT08-05', 'Specialty Sweets Flours (Rajgira, Water Chestnut)', '🍬', 8],
  // 09 Dairy & Alternatives
  ['CAT09', 'Dairy & Alternatives', 'CAT09-01', 'Milk (Full Fat, Toned, Skimmed, A2)', '🥛', 9],
  ['CAT09', 'Dairy & Alternatives', 'CAT09-02', 'Curd & Yoghurt', '🥛', 9],
  ['CAT09', 'Dairy & Alternatives', 'CAT09-03', 'Cheese (Indian & International)', '🥛', 9],
  ['CAT09', 'Dairy & Alternatives', 'CAT09-04', 'Paneer', '🥛', 9],
  ['CAT09', 'Dairy & Alternatives', 'CAT09-05', 'Cream & Butter', '🥛', 9],
  ['CAT09', 'Dairy & Alternatives', 'CAT09-06', 'Plant Milks (Oat, Almond, Soy, Coconut)', '🥛', 9],
  // 10 Meat, Poultry & Seafood
  ['CAT10', 'Meat, Poultry & Seafood', 'CAT10-01', 'Chicken', '🥩', 10],
  ['CAT10', 'Meat, Poultry & Seafood', 'CAT10-02', 'Mutton & Lamb', '🥩', 10],
  ['CAT10', 'Meat, Poultry & Seafood', 'CAT10-03', 'Fish (Fresh, Frozen, Dried)', '🥩', 10],
  ['CAT10', 'Meat, Poultry & Seafood', 'CAT10-04', 'Prawns & Shellfish', '🥩', 10],
  ['CAT10', 'Meat, Poultry & Seafood', 'CAT10-05', 'Processed Meats (Sausages, Salami)', '🥩', 10],
  ['CAT10', 'Meat, Poultry & Seafood', 'CAT10-06', 'Eggs', '🥩', 10],
  // 11 Fresh Produce
  ['CAT11', 'Fresh Produce', 'CAT11-01', 'Leafy Vegetables', '🥦', 11],
  ['CAT11', 'Fresh Produce', 'CAT11-02', 'Root Vegetables', '🥦', 11],
  ['CAT11', 'Fresh Produce', 'CAT11-03', 'Gourds & Melons', '🥦', 11],
  ['CAT11', 'Fresh Produce', 'CAT11-04', 'Onions, Garlic & Ginger', '🥦', 11],
  ['CAT11', 'Fresh Produce', 'CAT11-05', 'Tomatoes & Peppers', '🥦', 11],
  ['CAT11', 'Fresh Produce', 'CAT11-06', 'Fruits (Seasonal)', '🥦', 11],
  ['CAT11', 'Fresh Produce', 'CAT11-07', 'Fresh Herbs (Coriander, Curry Leaf, Mint, Basil)', '🥦', 11],
  // 12 Frozen Foods
  ['CAT12', 'Frozen Foods', 'CAT12-01', 'Frozen Vegetables', '🧊', 12],
  ['CAT12', 'Frozen Foods', 'CAT12-02', 'Frozen Snacks', '🧊', 12],
  ['CAT12', 'Frozen Foods', 'CAT12-03', 'Frozen Meats & Seafood', '🧊', 12],
  ['CAT12', 'Frozen Foods', 'CAT12-04', 'Ice Cream & Desserts', '🧊', 12],
  // 13 Beverages & Hot Drinks
  ['CAT13', 'Beverages & Hot Drinks', 'CAT13-01', 'Tea (CTC, Green, Herbal, Masala, White)', '☕', 13],
  ['CAT13', 'Beverages & Hot Drinks', 'CAT13-02', 'Coffee (Ground, Instant, Beans)', '☕', 13],
  ['CAT13', 'Beverages & Hot Drinks', 'CAT13-03', 'Juices & Concentrates', '☕', 13],
  ['CAT13', 'Beverages & Hot Drinks', 'CAT13-04', 'Sharbat Concentrates (Roohafza, Rasna)', '☕', 13],
  ['CAT13', 'Beverages & Hot Drinks', 'CAT13-05', 'Soft Drink Mixers', '☕', 13],
  ['CAT13', 'Beverages & Hot Drinks', 'CAT13-06', 'Health Drinks (Horlicks, Bournvita)', '☕', 13],
  ['CAT13', 'Beverages & Hot Drinks', 'CAT13-07', 'Electrolytes & Sports Drinks', '☕', 13],
  ['CAT13', 'Beverages & Hot Drinks', 'CAT13-08', 'Protein Powders & Supplements', '☕', 13],
  // 14 Ready-to-Cook / RTE
  ['CAT14', 'Ready-to-Cook / RTE', 'CAT14-01', 'Instant Noodles', '🍜', 14],
  ['CAT14', 'Ready-to-Cook / RTE', 'CAT14-02', 'Ready Mixes (Idli, Dosa, Gulab Jamun, Dhokla)', '🍜', 14],
  ['CAT14', 'Ready-to-Cook / RTE', 'CAT14-03', 'Instant Soups', '🍜', 14],
  ['CAT14', 'Ready-to-Cook / RTE', 'CAT14-04', 'Frozen Meals', '🍜', 14],
  // 15 Alcohol & Bar
  ['CAT15', 'Alcohol & Bar', 'CAT15-01', 'Spirits (Whisky, Gin, Rum, Vodka, Brandy)', '🍷', 15],
  ['CAT15', 'Alcohol & Bar', 'CAT15-02', 'Wine (Red, White, Sparkling, Rosé)', '🍷', 15],
  ['CAT15', 'Alcohol & Bar', 'CAT15-03', 'Beer & Cider', '🍷', 15],
  ['CAT15', 'Alcohol & Bar', 'CAT15-04', 'Liqueurs & Aperitifs', '🍷', 15],
  ['CAT15', 'Alcohol & Bar', 'CAT15-05', 'Mixers & Sodas', '🍷', 15],
  ['CAT15', 'Alcohol & Bar', 'CAT15-06', 'Bitters & Garnishes', '🍷', 15],
  ['CAT15', 'Alcohol & Bar', 'CAT15-07', 'Bar Consumables (Straws, Picks)', '🍷', 15],
  // 16 Baby & Toddler
  ['CAT16', 'Baby & Toddler', 'CAT16-01', 'Infant Formula', '🍼', 16],
  ['CAT16', 'Baby & Toddler', 'CAT16-02', 'Baby Cereals & Purees', '🍼', 16],
  ['CAT16', 'Baby & Toddler', 'CAT16-03', 'Baby Snacks', '🍼', 16],
  ['CAT16', 'Baby & Toddler', 'CAT16-04', 'Baby Supplements', '🍼', 16],
  ['CAT16', 'Baby & Toddler', 'CAT16-05', 'Sterilisation Supplies', '🍼', 16],
  // 17 Pet Food & Supplies
  ['CAT17', 'Pet Food & Supplies', 'CAT17-01', 'Dry Pet Food', '🐾', 17],
  ['CAT17', 'Pet Food & Supplies', 'CAT17-02', 'Wet / Canned Pet Food', '🐾', 17],
  ['CAT17', 'Pet Food & Supplies', 'CAT17-03', 'Pet Treats', '🐾', 17],
  ['CAT17', 'Pet Food & Supplies', 'CAT17-04', 'Pet Supplements', '🐾', 17],
  ['CAT17', 'Pet Food & Supplies', 'CAT17-05', 'Grooming Consumables', '🐾', 17],
  // 18 Puja & Religious Supplies
  ['CAT18', 'Puja & Religious Supplies', 'CAT18-01', 'Incense & Dhoop', '🪔', 18],
  ['CAT18', 'Puja & Religious Supplies', 'CAT18-02', 'Camphor & Diyas', '🪔', 18],
  ['CAT18', 'Puja & Religious Supplies', 'CAT18-03', 'Dry Fruits for Prasad', '🪔', 18],
  ['CAT18', 'Puja & Religious Supplies', 'CAT18-04', 'Coconut & Flowers (Dried)', '🪔', 18],
  ['CAT18', 'Puja & Religious Supplies', 'CAT18-05', 'Sacred Grains for Pooja', '🪔', 18],
  ['CAT18', 'Puja & Religious Supplies', 'CAT18-06', 'Festival-specific Items', '🪔', 18],
  // 19 Pharmacy & First Aid
  ['CAT19', 'Pharmacy & First Aid', 'CAT19-01', 'OTC Medicines', '💊', 19],
  ['CAT19', 'Pharmacy & First Aid', 'CAT19-02', 'Vitamins & Supplements', '💊', 19],
  ['CAT19', 'Pharmacy & First Aid', 'CAT19-03', 'First Aid Supplies', '💊', 19],
  ['CAT19', 'Pharmacy & First Aid', 'CAT19-04', 'Topical Creams & Ointments', '💊', 19],
  ['CAT19', 'Pharmacy & First Aid', 'CAT19-05', 'Ayurvedic Remedies', '💊', 19],
  // 20 Paper & Disposables
  ['CAT20', 'Paper & Disposables', 'CAT20-01', 'Tissue & Kitchen Towels', '🧻', 20],
  ['CAT20', 'Paper & Disposables', 'CAT20-02', 'Paper Plates & Cups', '🧻', 20],
  ['CAT20', 'Paper & Disposables', 'CAT20-03', 'Disposable Cutlery', '🧻', 20],
  ['CAT20', 'Paper & Disposables', 'CAT20-04', 'Aluminium Foil & Cling Wrap', '🧻', 20],
  ['CAT20', 'Paper & Disposables', 'CAT20-05', 'Zip-lock & Storage Bags', '🧻', 20],
  ['CAT20', 'Paper & Disposables', 'CAT20-06', 'Garbage Bags', '🧻', 20],
  // 21 Water & Filtration
  ['CAT21', 'Water & Filtration', 'CAT21-01', 'Packaged Drinking Water', '💧', 21],
  ['CAT21', 'Water & Filtration', 'CAT21-02', 'Mineral Water (Cooking Grade)', '💧', 21],
  ['CAT21', 'Water & Filtration', 'CAT21-03', 'Water Filter Cartridges', '💧', 21],
  ['CAT21', 'Water & Filtration', 'CAT21-04', 'Water Purifier Accessories', '💧', 21],
  // 22 Cleaning & Supplies
  ['CAT22', 'Cleaning & Supplies', 'CAT22-01', 'Dishwashing (Liquid, Powder, Pods)', '🧹', 22],
  ['CAT22', 'Cleaning & Supplies', 'CAT22-02', 'Surface Cleaners', '🧹', 22],
  ['CAT22', 'Cleaning & Supplies', 'CAT22-03', 'Floor Cleaners', '🧹', 22],
  ['CAT22', 'Cleaning & Supplies', 'CAT22-04', 'Scrubs & Sponges', '🧹', 22],
  ['CAT22', 'Cleaning & Supplies', 'CAT22-05', 'Disinfectants', '🧹', 22],
  // 23 Equipment Consumables
  ['CAT23', 'Equipment Consumables', 'CAT23-01', 'LPG Cylinders', '⚙️', 23],
  ['CAT23', 'Equipment Consumables', 'CAT23-02', 'Lighter Fluid & Match Boxes', '⚙️', 23],
  ['CAT23', 'Equipment Consumables', 'CAT23-03', 'Charcoal & Briquettes', '⚙️', 23],
  ['CAT23', 'Equipment Consumables', 'CAT23-04', 'Oven Liners & Baking Paper', '⚙️', 23],
  ['CAT23', 'Equipment Consumables', 'CAT23-05', 'Gas Lighter Refills', '⚙️', 23],
  // 24 Staff Pantry
  ['CAT24', 'Staff Pantry', 'CAT24-01', 'Staff Staples (Rice, Dal, Atta)', '👨‍🍳', 24],
  ['CAT24', 'Staff Pantry', 'CAT24-02', 'Staff Cooking Oils & Spices', '👨‍🍳', 24],
  ['CAT24', 'Staff Pantry', 'CAT24-03', 'Staff Snacks', '👨‍🍳', 24],
  ['CAT24', 'Staff Pantry', 'CAT24-04', 'Staff Beverages', '👨‍🍳', 24],
  ['CAT24', 'Staff Pantry', 'CAT24-05', 'Staff Personal Care', '👨‍🍳', 24],
  // 25 Seasonal / Festival
  // 26 Baby & Infant
  ['CAT26', 'Baby & Infant', 'CAT26-01', 'Diapers & Nappy Pants', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-02', 'Wet Wipes & Cotton Pads', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-03', 'Baby Food & Purees', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-04', 'Infant Formula & Milk Powder', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-05', 'Baby Cereals & Porridge', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-06', 'Baby Snacks & Finger Foods', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-07', 'Baby Medicines & Drops', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-08', 'Baby Skincare (Lotion, Oil, Powder)', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-09', 'Baby Bath & Shampoo', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-10', 'Feeding Accessories (Bottles, Nipples, Steriliser)', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-11', 'Teethers & Soothers', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-12', 'Baby Laundry & Detergent', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-13', 'Nursing & Breastfeeding (Breast Pads, Nipple Cream, Nursing Bags)', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-14', 'Baby Vitamins & Supplements (Vitamin D, Iron Drops)', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-15', 'Baby Oral Care (Finger Brush, Gum Cleaner)', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-16', 'Mosquito & Insect Protection (Baby-safe Patches, Roll-ons)', '👶', 26],
  ['CAT26', 'Baby & Infant', 'CAT26-17', 'Baby Sanitisers & Surface Wipes', '👶', 26],

  ['CAT25', 'Seasonal / Festival', 'CAT25-01', 'Diwali Specials', '🎉', 25],
  ['CAT25', 'Seasonal / Festival', 'CAT25-02', 'Holi Specials', '🎉', 25],
  ['CAT25', 'Seasonal / Festival', 'CAT25-03', 'Eid Specials', '🎉', 25],
  ['CAT25', 'Seasonal / Festival', 'CAT25-04', 'Christmas & New Year', '🎉', 25],
  ['CAT25', 'Seasonal / Festival', 'CAT25-05', 'Navratri / Fasting Items', '🎉', 25],
  ['CAT25', 'Seasonal / Festival', 'CAT25-06', 'Other Festival Items', '🎉', 25],
];

// ── Dashboard seed rows ───────────────────────────────────────
const DASHBOARD_SEED = [
  ['total_skus',         0, ''],
  ['family_items',       0, ''],
  ['staff_items',        0, ''],
  ['shared_items',       0, ''],
  ['low_stock_count',    0, ''],
  ['expiring_7_days',    0, ''],
  ['out_of_stock',       0, ''],
  ['open_containers',    0, ''],
  ['pending_overrides',  0, ''],
  ['last_sync',          '', ''],
];

// ════════════════════════════════════════════════════════════
// MAIN ENTRY POINT
// ════════════════════════════════════════════════════════════
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('=== Kitchen Inventory Setup v1.0 ===');

  // Phase 1: Create sheets
  _createSheets(ss);

  // Phase 2: Write headers + formatting
  _writeHeaders(ss);

  // Phase 3: Data validations
  _applyValidations(ss);

  // Phase 4: Seed CATEGORIES
  _seedCategories(ss);

  // Phase 5: Seed DASHBOARD
  _seedDashboard(ss);

  // Phase 6: Apply sheet protection
  _applyProtection(ss);

  // Phase 7: Create named ranges
  _createNamedRanges(ss);

  // Phase 8: Delete default Sheet1 if present
  _cleanupDefaultSheet(ss);

  Logger.log('=== Setup complete ===');
  SpreadsheetApp.getUi().alert('✅ Kitchen Inventory System setup complete!\n\nAll 10 sheets created, headers written, dropdowns configured, and categories seeded.\n\nYou can now deploy the Web App.');
}

// ── Migration entry point (run to add new categories or columns)
function runMigrations() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log('=== Running migrations ===');
  _syncCategories(ss);
  _addMissingColumns(ss);
  Logger.log('=== Migrations complete ===');
}

// ════════════════════════════════════════════════════════════
// PHASE 1: Create Sheets
// ════════════════════════════════════════════════════════════
function _createSheets(ss) {
  Object.keys(HEADERS).forEach(sheetName => {
    if (!ss.getSheetByName(sheetName)) {
      ss.insertSheet(sheetName);
      Logger.log(`Created sheet: ${sheetName}`);
    } else {
      Logger.log(`Sheet already exists, skipping: ${sheetName}`);
    }
    // Apply tab colour
    const sheet = ss.getSheetByName(sheetName);
    if (TAB_COLORS[sheetName]) {
      sheet.setTabColor(TAB_COLORS[sheetName]);
    }
  });
}

// ════════════════════════════════════════════════════════════
// PHASE 2: Write Headers
// ════════════════════════════════════════════════════════════
function _writeHeaders(ss) {
  Object.entries(HEADERS).forEach(([sheetName, headers]) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    // Check if headers already written
    const existingFirstCell = sheet.getRange(1, 1).getValue();
    if (existingFirstCell === headers[0]) {
      Logger.log(`Headers already present: ${sheetName}`);
      return;
    }

    // Write headers
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);

    // Style headers
    headerRange
      .setFontWeight('bold')
      .setFontColor('#FFFFFF')
      .setBackground('#1a1a2e')
      .setFontSize(10)
      .setBorder(false, false, true, false, false, false, '#f0c040', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

    // Freeze header row
    sheet.setFrozenRows(1);

    // Set row height
    sheet.setRowHeight(1, 34);

    // Set column widths
    headers.forEach((header, i) => {
      const width = COL_WIDTHS[header] || 120;
      sheet.setColumnWidth(i + 1, width);
    });

    // Alternating row colours for readability (first 200 rows)
    const dataRange = sheet.getRange(2, 1, 200, headers.length);
    dataRange.setBackground('#0d0d0d');

    Logger.log(`Headers written: ${sheetName}`);
  });
}

// ════════════════════════════════════════════════════════════
// PHASE 3: Data Validations
// ════════════════════════════════════════════════════════════
function _applyValidations(ss) {
  Object.entries(VALIDATIONS).forEach(([sheetName, columnValidations]) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const headers = HEADERS[sheetName];
    const maxRows = 1000; // Apply validation to first 1000 data rows

    Object.entries(columnValidations).forEach(([colName, allowedValues]) => {
      const colIndex = headers.indexOf(colName);
      if (colIndex === -1) return;

      const colNum = colIndex + 1;
      const range = sheet.getRange(2, colNum, maxRows, 1);

      const rule = SpreadsheetApp.newDataValidation()
        .requireValueInList(allowedValues, true)
        .setAllowInvalid(false)
        .setHelpText(`Choose from: ${allowedValues.join(', ')}`)
        .build();

      range.setDataValidation(rule);
      Logger.log(`Validation applied: ${sheetName}.${colName}`);
    });
  });
}

// ════════════════════════════════════════════════════════════
// PHASE 4: Seed CATEGORIES
// ════════════════════════════════════════════════════════════
function _seedCategories(ss) {
  const sheet = ss.getSheetByName('CATEGORIES');
  if (!sheet) return;

  // Check if already seeded
  if (sheet.getLastRow() > 1) {
    Logger.log('CATEGORIES already seeded — use _syncCategories() to add new ones');
    return;
  }

  sheet.getRange(2, 1, CATEGORIES_SEED.length, 6).setValues(CATEGORIES_SEED);
  Logger.log(`Seeded ${CATEGORIES_SEED.length} sub-category rows into CATEGORIES`);
}

// ════════════════════════════════════════════════════════════
// PHASE 5: Seed DASHBOARD
// ════════════════════════════════════════════════════════════
function _seedDashboard(ss) {
  const sheet = ss.getSheetByName('DASHBOARD');
  if (!sheet || sheet.getLastRow() > 1) return;
  sheet.getRange(2, 1, DASHBOARD_SEED.length, 3).setValues(DASHBOARD_SEED);
  Logger.log('DASHBOARD seeded');
}

// ════════════════════════════════════════════════════════════
// PHASE 6: Sheet Protection
// ════════════════════════════════════════════════════════════
function _applyProtection(ss) {
  // Protect MASTER_INVENTORY and DASHBOARD from direct edits.
  // Scripts can still write via the service account.
  const protectedSheets = ['MASTER_INVENTORY', 'DASHBOARD'];
  const me = Session.getEffectiveUser();

  protectedSheets.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    // Remove existing protections first
    sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET).forEach(p => p.remove());

    const protection = sheet.protect()
      .setDescription(`Protected — managed by Apps Script only`)
      .setWarningOnly(true); // Warning-only so the script can still write

    Logger.log(`Protection applied: ${sheetName}`);
  });
}

// ════════════════════════════════════════════════════════════
// PHASE 7: Named Ranges
// ════════════════════════════════════════════════════════════
function _createNamedRanges(ss) {
  const rangeDefinitions = [
    { name: 'PRODUCTS_BARCODES', sheet: 'PRODUCTS_DB',       startRow: 2, startCol: 1, numCols: 1 },
    { name: 'CATEGORIES_LIST',   sheet: 'CATEGORIES',         startRow: 2, startCol: 2, numCols: 1 },
    { name: 'MASTER_ITEMS',      sheet: 'MASTER_INVENTORY',   startRow: 2, startCol: 1, numCols: 1 },
    { name: 'MASTER_STATUS',     sheet: 'MASTER_INVENTORY',   startRow: 2, startCol: 16, numCols: 1 },
    { name: 'ALERTS_OPEN',       sheet: 'ALERTS',              startRow: 2, startCol: 8, numCols: 1 },
  ];

  rangeDefinitions.forEach(def => {
    const sheet = ss.getSheetByName(def.sheet);
    if (!sheet) return;

    // Remove existing named range with same name if present
    try {
      const existing = ss.getRangeByName(def.name);
      if (existing) ss.removeNamedRange(def.name);
    } catch(e) {}

    const range = sheet.getRange(def.startRow, def.startCol, 10000, def.numCols);
    ss.setNamedRange(def.name, range);
    Logger.log(`Named range created: ${def.name}`);
  });
}

// ════════════════════════════════════════════════════════════
// PHASE 8: Cleanup default sheet
// ════════════════════════════════════════════════════════════
function _cleanupDefaultSheet(ss) {
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
    Logger.log('Deleted default Sheet1');
  }
}

// ════════════════════════════════════════════════════════════
// MIGRATION: Sync new categories (safe to run on live data)
// ════════════════════════════════════════════════════════════
function _syncCategories(ss) {
  const sheet = ss.getSheetByName('CATEGORIES');
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  const existingData = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, 3).getValues()
    : [];

  // Build set of existing sub_category_ids
  const existingIds = new Set(existingData.map(row => row[2]));

  const newRows = CATEGORIES_SEED.filter(row => !existingIds.has(row[2]));

  if (newRows.length === 0) {
    Logger.log('CATEGORIES: no new rows to add');
    return;
  }

  sheet.getRange(lastRow + 1, 1, newRows.length, 6).setValues(newRows);
  Logger.log(`CATEGORIES: added ${newRows.length} new sub-category rows`);
}

// ════════════════════════════════════════════════════════════
// MIGRATION: Add missing columns to existing sheets
// ════════════════════════════════════════════════════════════
function _addMissingColumns(ss) {
  Object.entries(HEADERS).forEach(([sheetName, expectedHeaders]) => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 1) return;

    const lastCol = sheet.getLastColumn();
    const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    const missingHeaders = expectedHeaders.filter(h => !existingHeaders.includes(h));
    if (missingHeaders.length === 0) return;

    missingHeaders.forEach(header => {
      const newColNum = sheet.getLastColumn() + 1;
      sheet.getRange(1, newColNum).setValue(header)
        .setFontWeight('bold')
        .setFontColor('#FFFFFF')
        .setBackground('#1a1a2e');
      sheet.setColumnWidth(newColNum, COL_WIDTHS[header] || 120);
      Logger.log(`Added missing column "${header}" to ${sheetName}`);
    });
  });
}
