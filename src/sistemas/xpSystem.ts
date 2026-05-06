import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(__dirname, 'xpSystem.db');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new (sqlite3.verbose().Database)(dbPath, (err) => {
  if (err) { console.error('Error connecting to XP database:', err.message); return; }
  console.log('Connected to XP database');
  initializeDatabase();
});

function initializeDatabase(): void {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS user_xp (
      user_id TEXT NOT NULL, guild_id TEXT NOT NULL,
      xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1,
      last_message_time INTEGER, PRIMARY KEY (user_id, guild_id)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY, xp_per_message INTEGER DEFAULT 15,
      xp_cooldown INTEGER DEFAULT 60000,
      level_up_message TEXT DEFAULT '¡{user} ha subido al nivel {level}! 🎉',
      level_up_channel_id TEXT
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS level_roles (
      guild_id TEXT, level INTEGER, role_id TEXT, PRIMARY KEY (guild_id, level)
    )`);
  });
}

export function getRequiredXP(level: number): number {
  return 5 * (level ** 2) + 50 * level + 100;
}

export interface XPResult { xp: number; level: number; leveledUp: boolean; }
export interface UserXP { xp: number; level: number; xpForNextLevel: number; }
export interface GuildSettings {
  guild_id: string; xp_per_message: number; xp_cooldown: number;
  level_up_message: string; level_up_channel_id: string | null;
}

export function addXP(userId: string, guildId: string, xpToAdd = 0): Promise<XPResult> {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      db.get('SELECT * FROM user_xp WHERE user_id = ? AND guild_id = ?', [userId, guildId], (err, row: any) => {
        if (err) { db.run('ROLLBACK'); return reject(err); }
        const now = Date.now();
        if (row && (now - (row.last_message_time || 0) < 60000)) {
          db.run('ROLLBACK');
          return resolve({ xp: row.xp, level: row.level, leveledUp: false });
        }
        const currentXP = row?.xp ?? 0;
        const currentLevel = row?.level ?? 1;
        const newXP = currentXP + xpToAdd;
        const leveledUp = newXP >= getRequiredXP(currentLevel);
        const newLevel = leveledUp ? currentLevel + 1 : currentLevel;
        db.run(
          `INSERT INTO user_xp (user_id, guild_id, xp, level, last_message_time) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(user_id, guild_id) DO UPDATE SET xp=excluded.xp, level=excluded.level, last_message_time=excluded.last_message_time`,
          [userId, guildId, newXP, newLevel, now],
          (err2) => {
            if (err2) { db.run('ROLLBACK'); return reject(err2); }
            db.run('COMMIT');
            resolve({ xp: newXP, level: newLevel, leveledUp });
          }
        );
      });
    });
  });
}

export function getUserXP(userId: string, guildId: string): Promise<UserXP> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM user_xp WHERE user_id = ? AND guild_id = ?', [userId, guildId], (err, row: any) => {
      if (err) return reject(err);
      if (!row) return resolve({ xp: 0, level: 1, xpForNextLevel: getRequiredXP(1) });
      resolve({ xp: row.xp, level: row.level, xpForNextLevel: getRequiredXP(row.level) });
    });
  });
}

export function getLeaderboard(guildId: string, limit = 10): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT user_id, xp, level FROM user_xp WHERE guild_id = ? ORDER BY xp DESC LIMIT ?', [guildId, limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows ?? []);
    });
  });
}

export function setLevelRole(guildId: string, level: number, roleId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)
       ON CONFLICT(guild_id, level) DO UPDATE SET role_id=excluded.role_id`,
      [guildId, level, roleId], (err) => { if (err) return reject(err); resolve(); }
    );
  });
}

export function getLevelRole(guildId: string, level: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    db.get('SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?', [guildId, level], (err, row: any) => {
      if (err) return reject(err);
      resolve(row?.role_id ?? null);
    });
  });
}

export function getAllLevelRoles(guildId: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.all('SELECT level, role_id FROM level_roles WHERE guild_id = ? ORDER BY level ASC', [guildId], (err, rows) => {
      if (err) return reject(err);
      resolve(rows ?? []);
    });
  });
}

export function removeLevelRole(guildId: string, level: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM level_roles WHERE guild_id = ? AND level = ?', [guildId, level], function (err) {
      if (err) return reject(err);
      resolve(this.changes > 0);
    });
  });
}

export function setGuildSettings(guildId: string, settings: Partial<GuildSettings>): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const current = await getGuildSettings(guildId);
    const merged = { ...current, ...settings };
    db.run(
      `INSERT INTO guild_settings (guild_id, xp_per_message, xp_cooldown, level_up_message, level_up_channel_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET xp_per_message=excluded.xp_per_message,
         xp_cooldown=excluded.xp_cooldown, level_up_message=excluded.level_up_message,
         level_up_channel_id=excluded.level_up_channel_id`,
      [guildId, merged.xp_per_message, merged.xp_cooldown, merged.level_up_message, merged.level_up_channel_id],
      (err) => { if (err) return reject(err); resolve(); }
    );
  });
}

export function getGuildSettings(guildId: string): Promise<GuildSettings> {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM guild_settings WHERE guild_id = ?', [guildId], (err, row: any) => {
      if (err) return reject(err);
      resolve(row ?? { guild_id: guildId, xp_per_message: 15, xp_cooldown: 60000, level_up_message: '¡{user} ha subido al nivel {level}! 🎉', level_up_channel_id: null });
    });
  });
}

export async function handleMessage(message: any): Promise<void> {
  if (message.author.bot || !message.guild) return;
  try {
    const settings = await getGuildSettings(message.guild.id);
    const { leveledUp, level } = await addXP(message.author.id, message.guild.id, settings.xp_per_message);
    if (leveledUp && settings.level_up_channel_id) {
      const channel = message.guild.channels.cache.get(settings.level_up_channel_id) ?? message.channel;
      const msg = settings.level_up_message.replace('{user}', `<@${message.author.id}>`).replace('{level}', String(level));
      (channel as any).send(msg).catch(console.error);
      const roleId = await getLevelRole(message.guild.id, level);
      if (roleId) {
        const role = message.guild.roles.cache.get(roleId);
        if (role && !message.member.roles.cache.has(roleId)) message.member.roles.add(role).catch(console.error);
      }
    }
  } catch (error) { console.error('Error in XP system:', error); }
}

export { db };
