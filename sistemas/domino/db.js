const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ruta de la base de datos
const dbPath = path.join(__dirname, 'domino.db');

// Asegurarse de que el directorio existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Conectar a la base de datos SQLite
const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, async (err) => {
  if (err) {
    console.error('❌ Error al conectar a la base de datos de dominó:', err.message);
    return;
  }
  
  try {
    console.log('🔄 Inicializando la base de datos...');
    
    // Primero eliminamos las tablas existentes si existen
    await new Promise((resolve, reject) => {
      db.run('DROP TABLE IF EXISTS games', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    await new Promise((resolve, reject) => {
      db.run('DROP TABLE IF EXISTS players', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    // Luego creamos las tablas con el esquema actualizado
    await initializeDatabase();
    console.log('✅ Base de datos inicializada correctamente');
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
  }
});

// Inicializar la base de datos con las tablas necesarias
async function initializeDatabase() {
  // Tabla de partidas
  db.run(`
    CREATE TABLE IF NOT EXISTS games (
      game_id TEXT PRIMARY KEY,
      channel_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      creator_id TEXT NOT NULL,
      current_player INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabla de jugadores
  db.run(`
    CREATE TABLE IF NOT EXISTS players (
      user_id TEXT,
      game_id TEXT,
      position INTEGER,
      score INTEGER DEFAULT 0,
      is_ready BOOLEAN DEFAULT 0,
      PRIMARY KEY (user_id, game_id),
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE
    )
  `);

  // Tabla de fichas (manos de los jugadores)
  db.run(`
    CREATE TABLE IF NOT EXISTS tiles (
      game_id TEXT,
      user_id TEXT,
      left_value INTEGER,
      right_value INTEGER,
      position INTEGER,
      is_played BOOLEAN DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(game_id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES players(user_id) ON DELETE CASCADE
    )
  `);
}

// Promisify los métodos de la base de datos para usar async/await
const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbAll = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  close: () => db.close()
};
