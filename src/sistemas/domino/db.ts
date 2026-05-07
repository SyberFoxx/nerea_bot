import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, 'domino.db');
const dbDir  = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new (sqlite3.verbose().Database)(
  dbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  async (err) => {
    if (err) { console.error('❌ Error conectando a Dominó DB:', err.message); return; }
    try {
      console.log('🔄 Inicializando base de datos de Dominó...');
      await initializeDatabase();
      console.log('✅ Base de datos de Dominó lista');
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
    db.all(query, params, (err, rows) => { if (err) reject(err); else resolve(rows ?? []); });
  });
}
export function dbGet(query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => { if (err) reject(err); else resolve(row ?? null); });
  });
}

async function initializeDatabase(): Promise<void> {
  // Partidas
  await dbRun(`CREATE TABLE IF NOT EXISTS domino_games (
    game_id     TEXT PRIMARY KEY,
    channel_id  TEXT NOT NULL,
    creator_id  TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'waiting',
    current_pos INTEGER DEFAULT 0,
    board       TEXT DEFAULT '[]',
    left_end    INTEGER DEFAULT -1,
    right_end   INTEGER DEFAULT -1,
    pass_count  INTEGER DEFAULT 0,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Jugadores
  await dbRun(`CREATE TABLE IF NOT EXISTS domino_players (
    game_id  TEXT NOT NULL,
    user_id  TEXT NOT NULL,
    username TEXT,
    position INTEGER NOT NULL,
    is_bot   INTEGER DEFAULT 0,
    tiles    TEXT DEFAULT '[]',
    PRIMARY KEY (game_id, user_id),
    FOREIGN KEY (game_id) REFERENCES domino_games(game_id) ON DELETE CASCADE
  )`);

  // Migraciones seguras
  const migrations = [
    'ALTER TABLE domino_games ADD COLUMN pass_count INTEGER DEFAULT 0',
    'ALTER TABLE domino_players ADD COLUMN is_bot INTEGER DEFAULT 0',
    'ALTER TABLE domino_players ADD COLUMN username TEXT',
  ];
  for (const sql of migrations) {
    try { await dbRun(sql); } catch { /* ya existe */ }
  }
}

export function close(): void { db.close(); }
export { db };
