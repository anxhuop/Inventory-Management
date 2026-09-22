-- Run this once in PostgreSQL after creating the inventory_management database.
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(30),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  cost_price NUMERIC(12,2) NOT NULL CHECK (cost_price >= 0),
  selling_price NUMERIC(12,2) NOT NULL CHECK (selling_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  refill_threshold INTEGER NOT NULL DEFAULT 5 CHECK (refill_threshold >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  cost_at_sale NUMERIC(12,2) CHECK (cost_at_sale >= 0),
  sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC(12,2) CHECK (cost_at_sale >= 0);

CREATE INDEX IF NOT EXISTS sales_sold_at_idx ON sales (sold_at);
CREATE INDEX IF NOT EXISTS sales_order_id_idx ON sales (order_id);
CREATE INDEX IF NOT EXISTS products_supplier_id_idx ON products (supplier_id);
