-- Kassa360 Relational Database Schema
-- Compatible with PostgreSQL and SQLite

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'seller', -- 'admin', 'manager', 'seller', 'warehouse'
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  barcode TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  brand TEXT,
  color TEXT,
  color_hex TEXT,
  size TEXT,
  sizes_json TEXT, -- JSON array of sizes: ["S", "M", "L", "XL"]
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  minimum_stock INTEGER NOT NULL DEFAULT 3,
  supplier TEXT,
  image_path TEXT,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  color TEXT,
  color_hex TEXT,
  size TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  barcode TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  client_uuid TEXT UNIQUE, -- Idempotency key for offline sales sync
  device_id TEXT,
  seller_id TEXT,
  seller_name TEXT,
  date TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  item_discounts_total REAL NOT NULL DEFAULT 0,
  subtotal_after_item_discounts REAL NOT NULL DEFAULT 0,
  global_discount_percent REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total_discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  change_amount REAL NOT NULL DEFAULT 0,
  debt_amount REAL NOT NULL DEFAULT 0,
  initial_debt_amount REAL NOT NULL DEFAULT 0,
  initial_paid_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL, -- 'Nağd', 'Kart', 'Borc'
  partial_payment_method TEXT,
  customer_name TEXT,
  notes TEXT,
  is_returned INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'SYNCED', -- 'SYNCED', 'PENDING_SYNC'
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sale_items (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  product_barcode TEXT,
  brand TEXT,
  color TEXT,
  color_hex TEXT,
  size TEXT,
  variant_id TEXT,
  comment TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  original_price REAL NOT NULL,
  discount_amount REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL,
  cost_price REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL,
  profit REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS debt_payments (
  id TEXT PRIMARY KEY,
  sale_id TEXT NOT NULL,
  amount REAL NOT NULL,
  previous_debt REAL NOT NULL,
  remaining_debt REAL NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'İlkin stok', 'Stok düzəlişi', 'Alış', 'Satış', 'Qaytarma', 'Satış ləğvi'
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  notes TEXT,
  user_id TEXT,
  user_name TEXT,
  date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  total_amount REAL NOT NULL,
  payment_method TEXT NOT NULL,
  notes TEXT,
  items_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount REAL NOT NULL,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL, -- 'Aylıq', 'Həftəlik', 'İllik'
  day_of_month INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incomes (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  source TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_operations (
  id TEXT PRIMARY KEY,
  client_uuid TEXT UNIQUE NOT NULL,
  device_id TEXT NOT NULL,
  entity_type TEXT NOT NULL, -- 'sale', 'product', 'stock'
  operation TEXT NOT NULL, -- 'create', 'update', 'delete'
  status TEXT NOT NULL, -- 'SUCCESS', 'FAILED', 'DUPLICATE'
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indices for rapid query performance across 40+ concurrent devices
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(date);
CREATE INDEX IF NOT EXISTS idx_sales_client_uuid ON sales(client_uuid);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
