import { db, dbRun, dbAll, dbGet } from './db';

interface Player { id: string; user_id: string; game_id: string; position: number; score: number; isReady: boolean; }

export class DominoGame {
  static async createGame(channelId: string, creatorId: string): Promise<string> {
    const gameId = `domino_${Date.now()}`;
    await dbRun('INSERT INTO games (game_id, channel_id, status, creator_id) VALUES (?, ?, ?, ?)', [gameId, channelId, 'waiting', creatorId]);
    await this.addPlayer(gameId, creatorId);
    return gameId;
  }

  static async addPlayer(gameId: string, userId: string): Promise<number> {
    const game = await dbGet('SELECT * FROM games WHERE game_id = ?', [gameId]);
    if (!game) throw new Error('Juego no encontrado');
    if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');
    const players = await this.getPlayers(gameId);
    if (players.length >= 4) throw new Error('El juego ya está lleno (máx. 4 jugadores)');
    if (players.some(p => p.user_id === userId)) throw new Error('Ya estás en esta partida');
    await dbRun('INSERT INTO players (user_id, game_id, position) VALUES (?, ?, ?)', [userId, gameId, players.length]);
    return players.length + 1;
  }

  static async getPlayers(gameId: string): Promise<Player[]> {
    const rows = await dbAll('SELECT * FROM players WHERE game_id = ? ORDER BY position', [gameId]);
    return rows.map(p => ({ id: p.user_id, user_id: p.user_id, game_id: p.game_id, position: p.position, score: p.score ?? 0, isReady: Boolean(p.is_ready) }));
  }

  static async getPlayer(gameId: string, userId: string): Promise<Player | null> {
    const p = await dbGet('SELECT * FROM players WHERE game_id = ? AND user_id = ?', [gameId, userId]);
    if (!p) return null;
    return { id: p.user_id, user_id: p.user_id, game_id: p.game_id, position: p.position, score: p.score ?? 0, isReady: Boolean(p.is_ready) };
  }

  static async getGame(gameId: string): Promise<any> {
    const game = await dbGet('SELECT * FROM games WHERE game_id = ?', [gameId]);
    if (!game) throw new Error('Juego no encontrado');
    return game;
  }

  static async getGameStatus(gameId: string): Promise<any> {
    const game = await this.getGame(gameId);
    const players = await this.getPlayers(gameId);
    return { status: game.status, playerCount: players.length, maxPlayers: 4, currentPlayer: game.current_player, players: players.map(p => ({ id: p.user_id, position: p.position, score: p.score, isReady: p.isReady })) };
  }

  static async startGame(gameId: string): Promise<any> {
    const players = await this.getPlayers(gameId);
    if (players.length < 2) throw new Error('Se necesitan al menos 2 jugadores');
    await dbRun('UPDATE games SET status = ?, current_player = 0 WHERE game_id = ?', ['in_progress', gameId]);
    await this.dealTiles(gameId, players);
    await this.nextTurn(gameId);
    const game = await this.getGame(gameId);
    const status = await this.getGameStatus(gameId);
    const currentPlayer = await new Promise<string | null>((resolve, reject) => {
      db.get('SELECT user_id FROM players WHERE game_id = ? ORDER BY position ASC LIMIT 1', [gameId], (err, row: any) => {
        if (err) reject(err); else resolve(row?.user_id ?? null);
      });
    });
    if (!currentPlayer) throw new Error('No se pudo determinar el jugador actual');
    return { success: true, game, players: status.players, currentPlayer };
  }

  static async dealTiles(gameId: string, players: Player[]): Promise<void> {
    const tiles: { left: number; right: number }[] = [];
    for (let i = 0; i <= 6; i++) for (let j = i; j <= 6; j++) tiles.push({ left: i, right: j });
    for (let i = tiles.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [tiles[i], tiles[j]] = [tiles[j], tiles[i]]; }
    for (let i = 0; i < players.length; i++) {
      const playerId = players[i].user_id;
      for (let j = 0; j < 7; j++) {
        if (!tiles.length) break;
        const tile = tiles.pop()!;
        await dbRun('INSERT INTO tiles (game_id, user_id, left_value, right_value, position) VALUES (?, ?, ?, ?, ?)', [gameId, playerId, tile.left, tile.right, j]);
      }
    }
  }

  static async nextTurn(gameId: string): Promise<number> {
    const game = await dbGet('SELECT * FROM games WHERE game_id = ?', [gameId]);
    const players = await this.getPlayers(gameId);
    const next = (game.current_player + 1) % players.length;
    await dbRun('UPDATE games SET current_player = ? WHERE game_id = ?', [next, gameId]);
    return next;
  }

  static async getPlayerTiles(gameId: string, userId: string): Promise<any[]> {
    return dbAll('SELECT * FROM tiles WHERE game_id = ? AND user_id = ? AND is_played = 0 ORDER BY position', [gameId, userId]);
  }

  static async playTile(gameId: string, userId: string, tileId: number, side: string = 'right'): Promise<void> {
    const tile = await dbGet('SELECT * FROM tiles WHERE game_id = ? AND user_id = ? AND rowid = ?', [gameId, userId, tileId]);
    if (!tile) throw new Error('Ficha no encontrada');
    await dbRun('UPDATE tiles SET is_played = 1 WHERE rowid = ?', [tileId]);
    await this.nextTurn(gameId);
  }
}

export default DominoGame;
