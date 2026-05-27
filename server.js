const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { initDB, queryAll, queryOne, runSQL } = require('./db');

const app = express();
const PORT = Number(process.env.PORT) || 3030;

app.use(cors());
app.use(express.json());

// ========== ADMIN AUTHENTICATION ==========
const activeSessions = new Set();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.replace('Bearer ', '');
  if (token && activeSessions.has(token)) {
    next();
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized: Admin access required' });
  }
}

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.add(token);
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, error: 'Incorrect password' });
  }
});

app.get('/api/admin/verify', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.replace('Bearer ', '');
  if (token && activeSessions.has(token)) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Invalid session' });
  }
});

// Serve static public assets explicitly to prevent exposing database or source files
app.use('/images', express.static(path.join(__dirname, 'images')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/favicon.ico', (req, res) => res.status(204).end());

// ========== MENU ==========
app.get('/api/menu', (req, res) => {
  const { category } = req.query;
  let items;
  if (category && category !== 'all') {
    items = queryAll('SELECT * FROM menu_items WHERE category = ? AND is_available = 1 ORDER BY id', [category]);
  } else {
    items = queryAll('SELECT * FROM menu_items WHERE is_available = 1 ORDER BY id');
  }
  items = items.map(i => ({ ...i, tags: i.tags ? JSON.parse(i.tags) : [] }));
  res.json({ success: true, data: items });
});

app.get('/api/menu/:id', (req, res) => {
  const item = queryOne('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ success: false, error: 'Not found' });
  item.tags = item.tags ? JSON.parse(item.tags) : [];
  res.json({ success: true, data: item });
});

app.get('/api/admin/menu', requireAdmin, (req, res) => {
  const items = queryAll('SELECT * FROM menu_items ORDER BY id')
    .map(i => ({ ...i, tags: i.tags ? JSON.parse(i.tags) : [] }));
  res.json({ success: true, data: items });
});

app.post('/api/menu', requireAdmin, (req, res) => {
  const { name, description, price, category, image, badge, tags } = req.body;
  const parsedPrice = Number(price);
  if (!name || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !category) {
    return res.status(400).json({ success: false, error: 'Name, price, and category are required' });
  }
  const r = runSQL('INSERT INTO menu_items (name,description,price,category,image,badge,tags) VALUES (?,?,?,?,?,?,?)',
    [name.trim(), description || '', parsedPrice, category, image || null, badge || null, JSON.stringify(Array.isArray(tags) ? tags : [])]);
  res.status(201).json({ success: true, data: { id: r.lastId } });
});

app.patch('/api/menu/:id', requireAdmin, (req, res) => {
  const existing = queryOne('SELECT * FROM menu_items WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

  const next = {
    name: req.body.name ?? existing.name,
    description: req.body.description ?? existing.description,
    price: req.body.price ?? existing.price,
    category: req.body.category ?? existing.category,
    image: req.body.image ?? existing.image,
    badge: req.body.badge ?? existing.badge,
    tags: req.body.tags ?? (existing.tags ? JSON.parse(existing.tags) : []),
    is_available: req.body.is_available ?? existing.is_available
  };
  const parsedPrice = Number(next.price);
  const available = next.is_available ? 1 : 0;

  if (!String(next.name).trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !next.category) {
    return res.status(400).json({ success: false, error: 'Name, price, and category are required' });
  }

  runSQL(
    `UPDATE menu_items
     SET name = ?, description = ?, price = ?, category = ?, image = ?, badge = ?, tags = ?, is_available = ?
     WHERE id = ?`,
    [
      String(next.name).trim(),
      next.description || '',
      parsedPrice,
      next.category,
      next.image || null,
      next.badge || null,
      JSON.stringify(Array.isArray(next.tags) ? next.tags : []),
      available,
      req.params.id
    ]
  );
  res.json({ success: true, message: 'Menu item updated' });
});

app.delete('/api/menu/:id', requireAdmin, (req, res) => {
  const r = runSQL('DELETE FROM menu_items WHERE id = ?', [req.params.id]);
  if (r.changes === 0) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, message: 'Deleted' });
});

// ========== ORDERS ==========
app.post('/api/orders', (req, res) => {
  const { customer_name, customer_email, items, notes } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ success: false, error: 'No items' });

  const sizeMultiplier = { small: 0.8, medium: 1, large: 1.3 };
  const validMilks = new Set(['regular', 'oat', 'almond']);
  let total = 0;
  const orderItems = [];

  // Validate items and calc total
  for (const item of items) {
    const menuItemId = Number.parseInt(item.menu_item_id, 10);
    const quantity = Number.parseInt(item.quantity, 10);
    const size = sizeMultiplier[item.size] ? item.size : 'medium';
    const milkOption = validMilks.has(item.milk_option) ? item.milk_option : 'regular';

    if (!Number.isInteger(menuItemId) || menuItemId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid menu item' });
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return res.status(400).json({ success: false, error: 'Quantity must be between 1 and 20' });
    }

    const mi = queryOne('SELECT id, price FROM menu_items WHERE id = ? AND is_available = 1', [menuItemId]);
    if (!mi) return res.status(400).json({ success: false, error: `Item ${menuItemId} not found` });

    const unitPrice = Math.round(mi.price * sizeMultiplier[size] * 100) / 100;
    total += unitPrice * quantity;
    orderItems.push({ menuItemId, quantity, size, milkOption, unitPrice });
  }
  total = Math.round(total * 100) / 100;

  const orderResult = runSQL('INSERT INTO orders (customer_name,customer_email,total,notes) VALUES (?,?,?,?)',
    [customer_name || 'Guest', customer_email || null, total, notes || null]);

  for (const item of orderItems) {
    runSQL('INSERT INTO order_items (order_id,menu_item_id,quantity,size,milk_option,price) VALUES (?,?,?,?,?,?)',
      [orderResult.lastId, item.menuItemId, item.quantity, item.size, item.milkOption, item.unitPrice]);
  }

  res.status(201).json({ success: true, data: { orderId: orderResult.lastId, total } });
});

app.get('/api/orders', requireAdmin, (req, res) => {
  const orders = queryAll('SELECT * FROM orders ORDER BY created_at DESC');
  const orderItems = queryAll(`
    SELECT oi.order_id, oi.quantity, oi.size, oi.milk_option, oi.price, mi.name
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    ORDER BY oi.id
  `);
  const itemsByOrder = orderItems.reduce((acc, item) => {
    if (!acc[item.order_id]) acc[item.order_id] = [];
    acc[item.order_id].push(item);
    return acc;
  }, {});
  const data = orders.map(order => {
    const itemsForOrder = itemsByOrder[order.id] || [];
    return {
      ...order,
      item_count: itemsForOrder.reduce((sum, item) => sum + item.quantity, 0),
      items_summary: itemsForOrder.map(item => `${item.quantity}x ${item.name} (${item.size}, ${item.milk_option})`).join(', ')
    };
  });
  res.json({ success: true, data });
});

app.get('/api/orders/:id', requireAdmin, (req, res) => {
  const order = queryOne('SELECT * FROM orders WHERE id = ?', [req.params.id]);
  if (!order) return res.status(404).json({ success: false, error: 'Not found' });
  const items = queryAll(`
    SELECT oi.*, mi.name, mi.image, ROUND(oi.price * oi.quantity, 2) as line_total
    FROM order_items oi
    JOIN menu_items mi ON oi.menu_item_id = mi.id
    WHERE oi.order_id = ?
  `, [req.params.id]);
  res.json({ success: true, data: { ...order, items } });
});

app.patch('/api/orders/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const valid = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  if (!valid.includes(status)) return res.status(400).json({ success: false, error: 'Invalid status' });
  const r = runSQL('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
  if (r.changes === 0) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, message: `Status → ${status}` });
});

// ========== CONTACT ==========
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ success: false, error: 'Missing fields' });
  const r = runSQL('INSERT INTO contact_messages (name,email,message) VALUES (?,?,?)', [name, email, message]);
  res.status(201).json({ success: true, data: { id: r.lastId }, message: 'Message sent! 💌' });
});

app.get('/api/contact', requireAdmin, (req, res) => {
  res.json({ success: true, data: queryAll('SELECT * FROM contact_messages ORDER BY created_at DESC') });
});

app.patch('/api/contact/:id/read', requireAdmin, (req, res) => {
  const r = runSQL('UPDATE contact_messages SET is_read = 1 WHERE id = ?', [req.params.id]);
  if (r.changes === 0) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, message: 'Message marked as read' });
});

app.delete('/api/contact/:id', requireAdmin, (req, res) => {
  const r = runSQL('DELETE FROM contact_messages WHERE id = ?', [req.params.id]);
  if (r.changes === 0) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, message: 'Message deleted' });
});

// ========== REVIEWS ==========
app.get('/api/reviews', (req, res) => {
  res.json({ success: true, data: queryAll('SELECT * FROM reviews WHERE is_approved = 1 ORDER BY is_featured DESC, created_at DESC') });
});

app.get('/api/reviews/admin', requireAdmin, (req, res) => {
  res.json({ success: true, data: queryAll('SELECT * FROM reviews ORDER BY created_at DESC') });
});

app.patch('/api/reviews/:id/approve', requireAdmin, (req, res) => {
  const r = runSQL('UPDATE reviews SET is_approved = 1 WHERE id = ?', [req.params.id]);
  if (r.changes === 0) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, message: 'Review approved!' });
});

app.patch('/api/reviews/:id/feature', requireAdmin, (req, res) => {
  const { is_featured } = req.body;
  const r = runSQL('UPDATE reviews SET is_featured = ? WHERE id = ?', [is_featured ? 1 : 0, req.params.id]);
  if (r.changes === 0) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, message: `Review featured status set to ${is_featured}` });
});

app.delete('/api/reviews/:id', requireAdmin, (req, res) => {
  const r = runSQL('DELETE FROM reviews WHERE id = ?', [req.params.id]);
  if (r.changes === 0) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, message: 'Review deleted successfully' });
});

app.post('/api/reviews', (req, res) => {
  const { author_name, author_handle, rating, text } = req.body;
  if (!author_name || !text) return res.status(400).json({ success: false, error: 'Missing fields' });
  const parsedRating = Math.min(5, Math.max(1, Number.parseInt(rating, 10) || 5));
  const colors = ['linear-gradient(135deg,#c084fc,#e879f9)', 'linear-gradient(135deg,#fb923c,#f472b6)', 'linear-gradient(135deg,#34d399,#60a5fa)'];
  const r = runSQL('INSERT INTO reviews (author_name,author_handle,rating,text,avatar_color,is_approved) VALUES (?,?,?,?,?,0)',
    [author_name.trim(), author_handle || '', parsedRating, text.trim(), colors[Math.floor(Math.random() * colors.length)]]);
  res.status(201).json({ success: true, data: { id: r.lastId } });
});

// ========== STATS ==========
app.get('/api/stats', (req, res) => {
  const totalOrders = queryOne('SELECT COUNT(*) as c FROM orders').c;
  const totalMenu = queryOne('SELECT COUNT(*) as c FROM menu_items WHERE is_available = 1').c;
  const avgRating = queryOne('SELECT AVG(rating) as a FROM reviews WHERE is_approved = 1').a || 5;
  res.json({ success: true, data: { totalOrders, totalMenu, avgRating: Math.round(avgRating * 10) / 10, happySippers: 15000 + totalOrders } });
});

// Fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// Start server after DB init
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n☕ DRIP Coffee Server → http://localhost:${PORT}`);
    console.log(`📦 Database: drip_coffee.db`);
    console.log(`🚀 API ready!\n`);
  });
}).catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
