require('dotenv').config();

const path = require('path');
const express = require('express');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 3000);

app.use(express.json());
app.use(express.static(__dirname));

const productSelect = `
  SELECT p.id, p.name, p.category, COALESCE(s.name, 'No supplier') AS supplier,
         p.cost_price AS cost, p.selling_price AS price,
         p.stock_quantity AS stock, p.refill_threshold AS threshold
  FROM products p LEFT JOIN suppliers s ON s.id = p.supplier_id`;

async function ensureOrderSchema() {
  await pool.query('CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await pool.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS order_id INTEGER REFERENCES orders(id) ON DELETE RESTRICT');
  await pool.query('CREATE INDEX IF NOT EXISTS sales_order_id_idx ON sales (order_id)');
  await pool.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC(12,2) CHECK (cost_at_sale >= 0)');
}

async function supplierId(client, supplier) {
  const result = await client.query(
    `INSERT INTO suppliers (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`, [supplier.trim()]
  );
  return result.rows[0].id;
}

function validateProduct(product) {
  const fields = ['name', 'category', 'supplier'];
  if (fields.some(field => !String(product[field] || '').trim())) return 'Name, category, and supplier are required.';
  if (['cost', 'price', 'stock', 'threshold'].some(field => !Number.isFinite(Number(product[field])) || Number(product[field]) < 0)) return 'Prices and quantities must be zero or greater.';
  return null;
}

app.get('/api/products', async (_req, res, next) => {
  try { res.json((await pool.query(`${productSelect} ORDER BY p.id DESC`)).rows); } catch (error) { next(error); }
});

app.post('/api/products', async (req, res, next) => {
  const message = validateProduct(req.body);
  if (message) return res.status(400).json({ error: message });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const id = await supplierId(client, req.body.supplier);
    const result = await client.query(
      `INSERT INTO products (name, category, supplier_id, cost_price, selling_price, stock_quantity, refill_threshold)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [req.body.name.trim(), req.body.category.trim(), id, req.body.cost, req.body.price, req.body.stock, req.body.threshold]
    );
    await client.query('COMMIT');
    const product = await pool.query(`${productSelect} WHERE p.id = $1`, [result.rows[0].id]);
    res.status(201).json(product.rows[0]);
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

app.delete('/api/products/:id', async (req, res, next) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Product not found.' });
    res.status(204).end();
  } catch (error) { next(error); }
});

app.put('/api/products/:id/restock', async (req, res, next) => {
  const quantity = Number(req.body.quantity);
  const cost = req.body.cost === '' || req.body.cost == null ? null : Number(req.body.cost);
  const price = req.body.price === '' || req.body.price == null ? null : Number(req.body.price);
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'Add-stock quantity must be at least 1.' });
  if ((cost !== null && (!Number.isFinite(cost) || cost < 0)) || (price !== null && (!Number.isFinite(price) || price < 0))) return res.status(400).json({ error: 'Prices must be zero or greater.' });
  try {
    const result = await pool.query(
      `UPDATE products SET stock_quantity = stock_quantity + $1,
       cost_price = COALESCE($2, cost_price), selling_price = COALESCE($3, selling_price), updated_at = NOW()
       WHERE id = $4 RETURNING id`, [quantity, cost, price, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Product not found.' });
    res.json({ message: 'Stock updated.' });
  } catch (error) { next(error); }
});

app.post('/api/sales', async (req, res, next) => {
  const quantity = Number(req.body.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: 'Quantity must be at least 1.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const product = await client.query('SELECT id, selling_price, cost_price, stock_quantity FROM products WHERE id = $1 FOR UPDATE', [req.body.productId]);
    if (!product.rowCount) throw Object.assign(new Error('Product not found.'), { status: 404 });
    if (product.rows[0].stock_quantity < quantity) throw Object.assign(new Error('Not enough stock.'), { status: 400 });
    const order = await client.query('INSERT INTO orders DEFAULT VALUES RETURNING id');
    await client.query('INSERT INTO sales (order_id, product_id, quantity, unit_price, cost_at_sale) VALUES ($1,$2,$3,$4,$5)', [order.rows[0].id, product.rows[0].id, quantity, product.rows[0].selling_price, product.rows[0].cost_price]);
    await client.query('UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2', [quantity, product.rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Sale recorded.', orderId: order.rows[0].id });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

app.post('/api/sales/batch', async (req, res, next) => {
  const items = req.body.items;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Add at least one product to the bill.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const order = await client.query('INSERT INTO orders DEFAULT VALUES RETURNING id');
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) throw Object.assign(new Error('Each quantity must be at least 1.'), { status: 400 });
      const product = await client.query('SELECT id, selling_price, cost_price, stock_quantity FROM products WHERE id = $1 FOR UPDATE', [item.productId]);
      if (!product.rowCount) throw Object.assign(new Error('A product in this bill no longer exists.'), { status: 404 });
      if (product.rows[0].stock_quantity < quantity) throw Object.assign(new Error('Not enough stock for a product in this bill.'), { status: 400 });
      await client.query('INSERT INTO sales (order_id, product_id, quantity, unit_price, cost_at_sale) VALUES ($1,$2,$3,$4,$5)', [order.rows[0].id, product.rows[0].id, quantity, product.rows[0].selling_price, product.rows[0].cost_price]);
      await client.query('UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2', [quantity, product.rows[0].id]);
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Sale recorded.', orderId: order.rows[0].id });
  } catch (error) { await client.query('ROLLBACK'); next(error); } finally { client.release(); }
});

app.get('/api/dashboard', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(SUM(s.quantity * s.unit_price), 0)::float AS sales,
             COALESCE(SUM(s.quantity * (s.unit_price - COALESCE(s.cost_at_sale, p.cost_price))), 0)::float AS profit,
             COALESCE(SUM(s.quantity), 0)::int AS sold,
             COALESCE((SELECT SUM(stock_quantity) FROM products), 0)::int AS units,
             COALESCE((SELECT SUM(stock_quantity * cost_price) FROM products), 0)::float AS investment,
             COALESCE((SELECT SUM(stock_quantity * selling_price) FROM products), 0)::float AS remaining
      FROM sales s JOIN products p ON p.id = s.product_id
      WHERE date_trunc('month', s.sold_at) = date_trunc('month', NOW())`);
    res.json(result.rows[0]);
  } catch (error) { next(error); }
});

app.get('/api/sales/monthly', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT p.name, COALESCE(sp.name, 'No supplier') AS supplier,
             SUM(s.quantity)::int AS quantity, SUM(s.quantity * s.unit_price)::float AS amount
      FROM sales s JOIN products p ON p.id = s.product_id
      LEFT JOIN suppliers sp ON sp.id = p.supplier_id
      WHERE date_trunc('month', s.sold_at) = date_trunc('month', NOW())
      GROUP BY p.id, p.name, sp.name ORDER BY quantity DESC, p.name`);
    res.json(result.rows);
  } catch (error) { next(error); }
});

app.get('/api/sales/recent', async (_req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT COALESCE(s.order_id, s.id) AS id,
             COUNT(DISTINCT s.product_id)::int AS item_count,
             SUM(s.quantity)::int AS quantity,
             SUM(s.quantity * s.unit_price)::float AS amount,
             MIN(s.sold_at) AS sold_at
      FROM sales s JOIN products p ON p.id = s.product_id
      GROUP BY COALESCE(s.order_id, s.id)
      ORDER BY MIN(s.sold_at) DESC LIMIT 12`);
    res.json(result.rows);
  } catch (error) { next(error); }
});

app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'staff.html')));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'Database request failed.' });
});

ensureOrderSchema()
  .then(() => app.listen(port, () => console.log(`Inventory Management is running. Staff: http://localhost:${port}/staff.html | Admin: http://localhost:${port}/admin.html`)))
  .catch(error => { console.error('Database setup failed:', error); process.exit(1); });
