import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, 'domino.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new (sqlite3.verbose().Database)(
  dbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  async (err) => {
    if (err) { console.error('❌ Error conectando a Dominó DB:', err.message); return; }
    try {
      console.log('🔄 Inicializando la base de datos...');
      await dbRun('DROP TABLE IF EXISTS games');
      await dbRun('DROP TABLE IF EXISTS players');
      await initializeDatabase();
      console.log('✅ Base de datos inicializada correctamente');
    } catch (e) { console.error('❌ Error inicializando Dominó DB:', e); }
  }
);

export function dbRun(query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) { if (err) reject(err); else resolve(this); });
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
  db.run(`CREATE TABLE IF NOT EXISTS games (
    game_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', creator_id TEXT NOT NULL,
    current_player INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS players (
    user_id TEXT, game_id TEXT, position INTEGER, score INTEGER DEFAULT 0,
    is_ready BOOLEAN DEFAULT 0,
    PRIMARY KEY (user_id, game_id),
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tiles (
    game_id TEXT, user_id TEXT, left_value INTEGER, right_value INTEGER,
    position INTEGER, is_played BOOLEAN DEFAULT 0,
    FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
  )`);
}

export function close(): void { db.close(); }
export { db };
