const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, 'blackjack.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite database
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
  if (err) {
    console.error('❌ Error connecting to Blackjack database:', err.message);
    return;
  }
  
  try {
    console.log('🔄 Initializing Blackjack database...');
    await initializeDatabase();
    console.log('✅ Blackjack database initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing Blackjack database:', error);
  }
});

// Initialize database with required tables
async function initializeDatabase() {
  // Games table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting', -- waiting, in_progress, finished
      current_player_index INTEGER DEFAULT 0,
      deck TEXT, -- JSON array of remaining cards
      dealer_hand TEXT, -- JSON array of dealer's cards
      current_bet INTEGER DEFAULT 0,
      message_id TEXT, -- ID of the game message in Discord
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add message_id column if it doesn't exist
  try {
    await dbRun('ALTER TABLE games ADD COLUMN message_id TEXT');
  } catch (e) {
    // Column already exists, ignore the error
    if (!e.message.includes('duplicate column name')) {
      console.error('Error adding message_id column:', e);
    }
  }

  // Players table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS players (
      user_id TEXT NOT NULL,
      game_id TEXT NOT NULL,
      username TEXT,
      balance INTEGER DEFAULT 1000,
      current_bet INTEGER DEFAULT 0,
      hand TEXT, -- JSON array of cards
      status TEXT DEFAULT 'waiting', -- waiting, playing, stood, busted, blackjack
      is_bot BOOLEAN DEFAULT 0,
      position INTEGER DEFAULT 0,
      PRIMARY KEY (user_id, game_id),
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
    )
  `);
  
  // Add username column if it doesn't exist
  try {
    await dbRun('ALTER TABLE players ADD COLUMN username TEXT');
  } catch (e) {
    // Column already exists, ignore error
    if (!e.message.includes('duplicate column name')) {
      console.error('Error adding username column:', e);
    }
  }
  
  // Add is_bot column if it doesn't exist
  try {
    await dbRun('ALTER TABLE players ADD COLUMN is_bot BOOLEAN DEFAULT 0');
  } catch (e) {
    // Column already exists, ignore the error
    if (!e.message.includes('duplicate column name')) {
      console.error('Error adding is_bot column:', e);
    }
  }

  // Player actions log
  await dbRun(`
    CREATE TABLE IF NOT EXISTS player_actions (
      action_id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL, -- bet, hit, stand, double, split, insurance
      amount INTEGER,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
    )
  `);
}

// Promisify database methods for async/await
function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Close database connection
function close() {
  db.close();
}

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  close
};
