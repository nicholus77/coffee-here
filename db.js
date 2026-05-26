const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'drip_coffee.db');

let db;

async function initDB() {
  const SQL = await initSqlJs();

  // Load existing DB or create new
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('📦 Loaded existing database');
  } else {
    db = new SQL.Database();
    console.log('📦 Created new database');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      image TEXT,
      badge TEXT,
      tags TEXT,
      is_available INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT,
      customer_email TEXT,
      status TEXT DEFAULT 'pending',
      total REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      size TEXT DEFAULT 'medium',
      milk_option TEXT DEFAULT 'regular',
      price REAL NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_name TEXT NOT NULL,
      author_handle TEXT,
      rating INTEGER DEFAULT 5,
      text TEXT NOT NULL,
      avatar_color TEXT,
      is_featured INTEGER DEFAULT 0,
      is_approved INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed if empty
  const count = db.exec("SELECT COUNT(*) as count FROM menu_items");
  if (count[0].values[0][0] === 0) {
    seedData();
  }

  saveDB();
  return db;
}

function seedData() {
  console.log('🌱 Seeding database...');

  const menuItems = [
    ['Lavender Oat Latte', "Dreamy lavender meets silky oat milk. It's giving main character energy.", 6.50, 'hot', 'images/hero.png', 'BESTSELLER 🔥', '["🌿 Vegan","💜 Floral"]'],
    ['Iced Caramel Cloud', 'Cold brew topped with cloud-like caramel foam. No crumbs, just sips.', 7.00, 'iced', 'images/iced-coffee.png', 'NEW ✨', '["🧊 Iced","🍯 Sweet"]'],
    ['Matcha Mochi Latte', "Ceremonial matcha + mochi bites. It's giving Tokyo café realness.", 7.50, 'special', 'images/matcha.png', 'FAN FAV 💚', '["🍵 Matcha","🍡 Mochi"]'],
    ['Brown Sugar Espresso', 'Double shot with house-made brown sugar syrup. Bold and unapologetic.', 5.50, 'hot', 'images/hero.png', null, '["⚡ Strong","🤎 Rich"]'],
    ['Strawberry Sunset', 'Strawberry puree + cold brew = a sunset in your cup. Period. 🌅', 7.25, 'iced', 'images/iced-coffee.png', null, '["🍓 Fruity","🧊 Iced"]'],
    ['Butterfly Pea Lemonade', 'Color-changing magic in a cup. TikTok approved, taste-bud certified. 💜→💙', 6.75, 'special', 'images/matcha.png', 'LIMITED 🦋', '["🦋 Magic","🍋 Citrus"]'],
    ['Vanilla Bean Cold Brew', 'Slow-steeped perfection with real vanilla bean. Smooth like butter.', 5.75, 'iced', 'images/iced-coffee.png', null, '["🧊 Iced","🍦 Vanilla"]'],
    ['Dirty Chai Latte', 'Spiced chai + espresso shot. For when you need that extra oomph.', 6.25, 'hot', 'images/hero.png', null, '["🌶️ Spicy","⚡ Strong"]']
  ];

  for (const item of menuItems) {
    db.run("INSERT INTO menu_items (name, description, price, category, image, badge, tags) VALUES (?,?,?,?,?,?,?)", item);
  }

  const reviews = [
    ['Sarah K.', '@sarahsips ✨', 5, "The lavender oat latte literally changed my life. I'm not being dramatic, it's that good. The vibes here are immaculate.", 'linear-gradient(135deg, #c084fc, #e879f9)', 0],
    ['Jake M.', '@jakebrews 🔥', 5, 'Went for the coffee, stayed for the aesthetic. This place is literally the main character of coffee shops. 10/10 no notes.', 'linear-gradient(135deg, #fb923c, #f472b6)', 1],
    ['Mia L.', '@mimatcha 💚', 5, 'The matcha mochi latte is giving everything it needs to give. Plus the WiFi is fast enough for my zoom calls. Slay.', 'linear-gradient(135deg, #34d399, #60a5fa)', 0]
  ];

  for (const r of reviews) {
    db.run("INSERT INTO reviews (author_name, author_handle, rating, text, avatar_color, is_featured) VALUES (?,?,?,?,?,?)", r);
  }

  console.log('✅ Database seeded!');
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function getDB() {
  return db;
}

// Helper to run SELECT and return array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const results = queryAll(sql, params);
  return results.length > 0 ? results[0] : null;
}

function runSQL(sql, params = []) {
  db.run(sql, params);
  const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
  const changes = db.getRowsModified();
  saveDB();
  return { lastId, changes };
}

module.exports = { initDB, getDB, queryAll, queryOne, runSQL, saveDB };
