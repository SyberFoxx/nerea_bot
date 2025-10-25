const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, 'xpSystem.db');

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Connect to SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to XP database:', err.message);
    return;
  }
  console.log('Connected to XP database');
  initializeDatabase();
});

// Initialize database with required tables
function initializeDatabase() {
  db.serialize(() => {
    // Users table to store XP and level
    db.run(`CREATE TABLE IF NOT EXISTS user_xp (
      user_id TEXT NOT NULL,
      guild_id TEXT NOT NULL,
      xp INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      last_message_time INTEGER,
      PRIMARY KEY (user_id, guild_id)
    )`);

    // Guild settings (customizable XP per message, cooldown, etc.)
    db.run(`CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      xp_per_message INTEGER DEFAULT 15,
      xp_cooldown INTEGER DEFAULT 60000, // 1 minute in milliseconds
      level_up_message TEXT DEFAULT '¡{user} ha subido al nivel {level}! 🎉',
      level_up_channel_id TEXT
    )`);

    // Level roles (roles to assign at certain levels)
    db.run(`CREATE TABLE IF NOT EXISTS level_roles (
      guild_id TEXT,
      level INTEGER,
      role_id TEXT,
      PRIMARY KEY (guild_id, level)
    )`);
  });
}

// Calculate required XP for a level
function getRequiredXP(level) {
  return 5 * (level ** 2) + 50 * level + 100; // Quadratic formula for XP scaling
}

// Add XP to a user
function addXP(userId, guildId, xpToAdd = 0) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Start transaction
      db.run('BEGIN TRANSACTION');

      // Get current user data
      db.get(
        'SELECT * FROM user_xp WHERE user_id = ? AND guild_id = ?',
        [userId, guildId],
        (err, row) => {
          if (err) {
            db.run('ROLLBACK');
            return reject(err);
          }

          const now = Date.now();
          const cooldown = 60000; // 1 minute cooldown
          
          // If user exists and it's too soon since last message, don't add XP
          if (row && (now - (row.last_message_time || 0) < cooldown)) {
            db.run('ROLLBACK');
            return resolve({ xp: row.xp, level: row.level, leveledUp: false });
          }

          // Calculate new XP and level
          const currentXP = row ? row.xp : 0;
          const currentLevel = row ? row.level : 1;
          const newXP = currentXP + xpToAdd;
          const xpForNextLevel = getRequiredXP(currentLevel);
          
          let newLevel = currentLevel;
          let leveledUp = false;

          // Check for level up
          if (newXP >= xpForNextLevel) {
            newLevel = currentLevel + 1;
            leveledUp = true;
            // You could add additional logic here for multiple level-ups
          }

          // Update or insert user data
          db.run(
            `INSERT INTO user_xp (user_id, guild_id, xp, level, last_message_time)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(user_id, guild_id) 
             DO UPDATE SET xp = excluded.xp, level = excluded.level, last_message_time = excluded.last_message_time`,
            [userId, guildId, newXP, newLevel, now],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                return reject(err);
              }
              db.run('COMMIT');
              resolve({ xp: newXP, level: newLevel, leveledUp });
            }
          );
        }
      );
    });
  });
}

// Get user's XP and level
function getUserXP(userId, guildId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM user_xp WHERE user_id = ? AND guild_id = ?',
      [userId, guildId],
      (err, row) => {
        if (err) return reject(err);
        
        if (!row) {
          // If user doesn't exist, return default values
          return resolve({
            xp: 0,
            level: 1,
            xpForNextLevel: getRequiredXP(1)
          });
        }
        
        resolve({
          xp: row.xp,
          level: row.level,
          xpForNextLevel: getRequiredXP(row.level)
        });
      }
    );
  });
}

// Get leaderboard for a guild
function getLeaderboard(guildId, limit = 10) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT user_id, xp, level FROM user_xp WHERE guild_id = ? ORDER BY xp DESC LIMIT ?',
      [guildId, limit],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

// Set level role reward
function setLevelRole(guildId, level, roleId) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO level_roles (guild_id, level, role_id)
       VALUES (?, ?, ?)
       ON CONFLICT(guild_id, level) 
       DO UPDATE SET role_id = excluded.role_id`,
      [guildId, level, roleId],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

// Get level role for a specific level
function getLevelRole(guildId, level) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?',
      [guildId, level],
      (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.role_id : null);
      }
    );
  });
}

// Get all level roles for a guild
function getAllLevelRoles(guildId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT level, role_id FROM level_roles WHERE guild_id = ? ORDER BY level ASC',
      [guildId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      }
    );
  });
}

// Remove a level role
function removeLevelRole(guildId, level) {
  return new Promise((resolve, reject) => {
    db.run(
      'DELETE FROM level_roles WHERE guild_id = ? AND level = ?',
      [guildId, level],
      function(err) {
        if (err) return reject(err);
        resolve(this.changes > 0);
      }
    );
  });
}

// Set guild settings
function setGuildSettings(guildId, settings) {
  return new Promise((resolve, reject) => {
    const { xp_per_message, xp_cooldown, level_up_message, level_up_channel_id } = settings;
    
    db.run(
      `INSERT INTO guild_settings (guild_id, xp_per_message, xp_cooldown, level_up_message, level_up_channel_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(guild_id) 
       DO UPDATE SET 
         xp_per_message = excluded.xp_per_message,
         xp_cooldown = excluded.xp_cooldown,
         level_up_message = excluded.level_up_message,
         level_up_channel_id = excluded.level_up_channel_id`,
      [guildId, xp_per_message, xp_cooldown, level_up_message, level_up_channel_id],
      (err) => {
        if (err) return reject(err);
        resolve();
      }
    );
  });
}

// Get guild settings
function getGuildSettings(guildId) {
  return new Promise((resolve, reject) => {
    db.get(
      'SELECT * FROM guild_settings WHERE guild_id = ?',
      [guildId],
      (err, row) => {
        if (err) return reject(err);
        
        // Default settings
        const defaultSettings = {
          guild_id: guildId,
          xp_per_message: 15,
          xp_cooldown: 60000, // 1 minute
          level_up_message: '¡{user} ha subido al nivel {level}! 🎉',
          level_up_channel_id: null
        };
        
        resolve(row || defaultSettings);
      }
    );
  });
}

// Handle message event (to be called from messageCreate event)
async function handleMessage(message) {
  if (message.author.bot) return;
  if (!message.guild) return;
  
  try {
    const settings = await getGuildSettings(message.guild.id);
    const { xp_per_message } = settings;
    
    const { leveledUp, level } = await addXP(message.author.id, message.guild.id, xp_per_message);
    
    if (leveledUp && settings.level_up_channel_id) {
      const channel = message.guild.channels.cache.get(settings.level_up_channel_id) || message.channel;
      const levelUpMessage = settings.level_up_message
        .replace('{user}', `<@${message.author.id}>`)
        .replace('{level}', level);
      
      channel.send(levelUpMessage).catch(console.error);
      
      // Check for level roles
      const roleId = await getLevelRole(message.guild.id, level);
      if (roleId) {
        const member = message.member;
        const role = message.guild.roles.cache.get(roleId);
        
        if (role && !member.roles.cache.has(roleId)) {
          member.roles.add(role).catch(console.error);
        }
      }
    }
  } catch (error) {
    console.error('Error in XP system:', error);
  }
}

// Export all functions
module.exports = {
  db,
  getRequiredXP,
  addXP,
  getUserXP,
  getLeaderboard,
  setLevelRole,
  getLevelRole,
  getAllLevelRoles,
  removeLevelRole,
  setGuildSettings,
  getGuildSettings,
  handleMessage
};
