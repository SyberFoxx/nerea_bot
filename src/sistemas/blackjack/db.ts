import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, 'blackjack.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new (sqlite3.verbose().Database)(
  dbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  async (err) => {
    if (err) { console.error('❌ Error conectando a Blackjack DB:', err.message); return; }
    try {
      console.log('🔄 Initializing Blackjack database...');
      await initializeDatabase();
      console.log('✅ Blackjack database initialized successfully');
    } catch (e) { console.error('❌ Error inicializando Blackjack DB:', e); }
  }
);

export function dbRun(query: string, params: any[] = []): Promise<{ lastID: number; changes: number }> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

export function dbAll(query: string, params: any[] = []): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => { if (err) reject(err); else resolve(rows); });
  });
}

export function dbGet(query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => { if (err) reject(err); else resolve(row); });
  });
}

async function initializeDatabase(): Promise<void> {
  await dbRun(`CREATE TABLE IF NOT EXISTS games (
    game_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', current_player_index INTEGER DEFAULT 0,
    deck TEXT, dealer_hand TEXT, current_bet INTEGER DEFAULT 0,
    message_id TEXT, creator_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Migraciones — agregar columnas si no existen (base de datos antigua)
  const migrations = [
    'ALTER TABLE games ADD COLUMN message_id TEXT',
    'ALTER TABLE games ADD COLUMN creator_id TEXT',
    'ALTER TABLE games ADD COLUMN current_player_index INTEGER DEFAULT 0',
  ];
  for (const sql of migrations) {
    try { await dbRun(sql); } catch { /* columna ya existe */ }
  }

  await dbRun(`CREATE TABLE IF NOT EXISTS players (
    user_id TEXT NOT NULL, game_id TEXT NOT NULL, username TEXT,
    balance INTEGER DEFAULT 1000, current_bet INTEGER DEFAULT 0,
    hand TEXT, status TEXT DEFAULT 'waiting', is_bot BOOLEAN DEFAULT 0,
    position INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, game_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
  )`);
  try { await dbRun('ALTER TABLE players ADD COLUMN username TEXT'); } catch { /* ya existe */ }
  try { await dbRun('ALTER TABLE players ADD COLUMN is_bot BOOLEAN DEFAULT 0'); } catch { /* ya existe */ }

  await dbRun(`CREATE TABLE IF NOT EXISTS player_actions (
    action_id INTEGER PRIMARY KEY AUTOINCREMENT, game_id TEXT NOT NULL,
    user_id TEXT NOT NULL, action TEXT NOT NULL, amount INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
  )`);
}

export function close(): void { db.close(); }
export { db };
