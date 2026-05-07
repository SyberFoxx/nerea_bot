import { dbRun, dbAll, dbGet } from './db';

// ─── Tipos ─────────────────────────────────────────────────────────────────────
export interface DominoTile { left: number; right: number; }
export interface BoardTile  { left: number; right: number; flipped: boolean; }

export interface DominoPlayer {
  game_id:  string;
  user_id:  string;
  username: string;
  position: number;
  is_bot:   boolean;
  tiles:    DominoTile[];
}

export interface DominoGameData {
  game_id:     string;
  channel_id:  string;
  creator_id:  string;
  status:      'waiting' | 'in_progress' | 'finished';
  current_pos: number;   // índice en la lista de jugadores
  board:       string;   // JSON de BoardTile[]
  left_end:    number;   // valor en el extremo izquierdo del tablero (-1 = vacío)
  right_end:   number;   // valor en el extremo derecho del tablero
  pass_count:  number;   // cuántos pases consecutivos (para detectar bloqueo)
}

// ─── Clase principal ───────────────────────────────────────────────────────────
export class DominoGame {

  // ── Utilidades ────────────────────────────────────────────────────────────

  static generateTiles(): DominoTile[] {
    const tiles: DominoTile[] = [];
    for (let i = 0; i <= 6; i++)
      for (let j = i; j <= 6; j++)
        tiles.push({ left: i, right: j });
    // Fisher-Yates
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    return tiles;
  }

  static parseTiles(data: any): DominoTile[] {
    if (!data) return [];
    try {
      const p = typeof data === 'string' ? JSON.parse(data) : data;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }

  static parseBoard(data: any): BoardTile[] {
    if (!data) return [];
    try {
      const p = typeof data === 'string' ? JSON.parse(data) : data;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }

  /** Verifica si una ficha puede jugarse en algún extremo del tablero */
  static canPlay(tile: DominoTile, leftEnd: number, rightEnd: number): boolean {
    if (leftEnd === -1) return true; // tablero vacío
    return tile.left === leftEnd || tile.right === leftEnd ||
           tile.left === rightEnd || tile.right === rightEnd;
  }

  /** Devuelve los extremos válidos donde puede jugarse una ficha */
  static getValidSides(tile: DominoTile, leftEnd: number, rightEnd: number): ('left'|'right')[] {
    if (leftEnd === -1) return ['right']; // primera ficha, solo right
    const sides: ('left'|'right')[] = [];
    if (tile.left === leftEnd || tile.right === leftEnd)  sides.push('left');
    if (tile.left === rightEnd || tile.right === rightEnd) sides.push('right');
    return sides;
  }

  // ── DB helpers ────────────────────────────────────────────────────────────

  static async getGame(gameId: string): Promise<DominoGameData | null> {
    return dbGet('SELECT * FROM domino_games WHERE game_id = ?', [gameId]);
  }

  static async getPlayers(gameId: string): Promise<DominoPlayer[]> {
    const rows = await dbAll('SELECT * FROM domino_players WHERE game_id = ? ORDER BY position', [gameId]);
    return rows.map(r => ({
      game_id:  r.game_id,
      user_id:  r.user_id,
      username: r.username ?? (r.is_bot ? '🤖 BOT' : `Jugador ${r.position + 1}`),
      position: r.position,
      is_bot:   Boolean(r.is_bot),
      tiles:    this.parseTiles(r.tiles),
    }));
  }

  static async getPlayer(gameId: string, userId: string): Promise<DominoPlayer | null> {
    const r = await dbGet('SELECT * FROM domino_players WHERE game_id = ? AND user_id = ?', [gameId, userId]);
    if (!r) return null;
    return {
      game_id:  r.game_id, user_id: r.user_id,
      username: r.username ?? (r.is_bot ? '🤖 BOT' : `Jugador ${r.position + 1}`),
      position: r.position, is_bot: Boolean(r.is_bot),
      tiles:    this.parseTiles(r.tiles),
    };
  }

  static async getCurrentPlayer(gameId: string): Promise<DominoPlayer | null> {
    const game = await this.getGame(gameId);
    if (!game) return null;
    const players = await this.getPlayers(gameId);
    return players[game.current_pos] ?? null;
  }

  // ── Flujo del juego ───────────────────────────────────────────────────────

  static async createGame(channelId: string, creatorId: string, creatorUsername: string): Promise<string> {
    const gameId = `dom_${Date.now()}`;
    await dbRun(
      'INSERT INTO domino_games (game_id, channel_id, creator_id, status, board, left_end, right_end, pass_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [gameId, channelId, creatorId, 'waiting', '[]', -1, -1, 0]
    );
    await this.addPlayer(gameId, creatorId, creatorUsername);
    return gameId;
  }

  static async addPlayer(gameId: string, userId: string, username: string, isBot = false): Promise<DominoPlayer[]> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Partida no encontrada');
    if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');
    const players = await this.getPlayers(gameId);
    if (players.length >= 4) throw new Error('La partida está llena (máx. 4 jugadores)');
    if (players.some(p => p.user_id === userId)) throw new Error('Ya estás en esta partida');
    await dbRun(
      'INSERT INTO domino_players (game_id, user_id, username, position, is_bot, tiles) VALUES (?, ?, ?, ?, ?, ?)',
      [gameId, userId, username, players.length, isBot ? 1 : 0, '[]']
    );
    return this.getPlayers(gameId);
  }

  static async startGame(gameId: string): Promise<DominoGameData> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Partida no encontrada');
    if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');

    let players = await this.getPlayers(gameId);
    if (players.length < 2) throw new Error('Se necesitan al menos 2 jugadores');

    // Añadir bot si solo hay 1 jugador humano
    if (players.filter(p => !p.is_bot).length === 1 && !players.some(p => p.is_bot)) {
      await this.addPlayer(gameId, `bot-${Date.now()}`, '🤖 BOT', true);
      players = await this.getPlayers(gameId);
    }

    // Repartir fichas (7 por jugador, máx 4 jugadores = 28 fichas exactas)
    const allTiles = this.generateTiles();
    const tilesPerPlayer = players.length <= 2 ? 7 : players.length === 3 ? 6 : 5;

    for (const p of players) {
      const hand = allTiles.splice(0, tilesPerPlayer);
      await dbRun('UPDATE domino_players SET tiles = ? WHERE game_id = ? AND user_id = ?',
        [JSON.stringify(hand), gameId, p.user_id]);
    }

    // El jugador con el doble más alto empieza
    const startPos = await this.findStartingPlayer(gameId);

    await dbRun(
      'UPDATE domino_games SET status = ?, current_pos = ?, board = ?, left_end = ?, right_end = ?, pass_count = ? WHERE game_id = ?',
      ['in_progress', startPos, '[]', -1, -1, 0, gameId]
    );

    return (await this.getGame(gameId))!;
  }

  /** Encuentra quién tiene el doble más alto para empezar */
  static async findStartingPlayer(gameId: string): Promise<number> {
    const players = await this.getPlayers(gameId);
    let bestPos = 0, bestDouble = -1;
    for (const p of players) {
      for (const t of p.tiles) {
        if (t.left === t.right && t.left > bestDouble) {
          bestDouble = t.left;
          bestPos = p.position;
        }
      }
    }
    return bestPos;
  }

  /**
   * Juega una ficha en el tablero.
   * side: 'left' | 'right'
   * Devuelve el estado actualizado del juego.
   */
  static async playTile(
    gameId: string,
    userId: string,
    tileIndex: number,
    side: 'left' | 'right'
  ): Promise<{ game: DominoGameData; winner: DominoPlayer | null }> {
    const game = await this.getGame(gameId);
    if (!game || game.status !== 'in_progress') throw new Error('La partida no está en progreso');

    const players  = await this.getPlayers(gameId);
    const current  = players[game.current_pos];
    if (!current || current.user_id !== userId) throw new Error('No es tu turno');

    const player = await this.getPlayer(gameId, userId);
    if (!player) throw new Error('Jugador no encontrado');

    if (tileIndex < 0 || tileIndex >= player.tiles.length)
      throw new Error(`Índice de ficha inválido. Tienes ${player.tiles.length} fichas (1-${player.tiles.length})`);

    const tile = player.tiles[tileIndex];

    // Validar que la ficha se pueda jugar
    const validSides = this.getValidSides(tile, game.left_end, game.right_end);
    if (!validSides.includes(side)) {
      // Si solo hay un lado válido, usarlo automáticamente
      if (validSides.length === 1) {
        side = validSides[0];
      } else {
        throw new Error(`Esta ficha no puede jugarse en ese lado. Lados válidos: ${validSides.join(', ')}`);
      }
    }

    // Actualizar tablero
    const board = this.parseBoard(game.board);
    let newLeft  = game.left_end;
    let newRight = game.right_end;

    if (board.length === 0) {
      // Primera ficha
      board.push({ left: tile.left, right: tile.right, flipped: false });
      newLeft  = tile.left;
      newRight = tile.right;
    } else if (side === 'right') {
      // Conectar al extremo derecho
      const flipped = tile.left !== newRight;
      const placed  = flipped ? { left: tile.right, right: tile.left, flipped: true } : { left: tile.left, right: tile.right, flipped: false };
      board.push(placed);
      newRight = placed.right;
    } else {
      // Conectar al extremo izquierdo
      const flipped = tile.right !== newLeft;
      const placed  = flipped ? { left: tile.right, right: tile.left, flipped: true } : { left: tile.left, right: tile.right, flipped: false };
      board.unshift(placed);
      newLeft = placed.left;
    }

    // Quitar ficha de la mano del jugador
    const newHand = player.tiles.filter((_, i) => i !== tileIndex);
    await dbRun('UPDATE domino_players SET tiles = ? WHERE game_id = ? AND user_id = ?',
      [JSON.stringify(newHand), gameId, userId]);

    // Actualizar tablero en DB
    await dbRun(
      'UPDATE domino_games SET board = ?, left_end = ?, right_end = ?, pass_count = ? WHERE game_id = ?',
      [JSON.stringify(board), newLeft, newRight, 0, gameId]
    );

    // Verificar si ganó (sin fichas)
    if (newHand.length === 0) {
      await dbRun('UPDATE domino_games SET status = ? WHERE game_id = ?', ['finished', gameId]);
      const winner = await this.getPlayer(gameId, userId);
      return { game: (await this.getGame(gameId))!, winner };
    }

    // Avanzar turno
    await this.advanceTurn(gameId);
    return { game: (await this.getGame(gameId))!, winner: null };
  }

  /** Pasar turno (cuando no hay fichas jugables) */
  static async passTurn(gameId: string, userId: string): Promise<{ blocked: boolean }> {
    const game = await this.getGame(gameId);
    if (!game || game.status !== 'in_progress') throw new Error('La partida no está en progreso');

    const players = await this.getPlayers(gameId);
    const current = players[game.current_pos];
    if (!current || current.user_id !== userId) throw new Error('No es tu turno');

    const player = await this.getPlayer(gameId, userId);
    if (!player) throw new Error('Jugador no encontrado');

    // Verificar que realmente no puede jugar
    const canPlayAny = player.tiles.some(t => this.canPlay(t, game.left_end, game.right_end));
    if (canPlayAny) throw new Error('Tienes fichas que puedes jugar. No puedes pasar.');

    const newPassCount = game.pass_count + 1;

    // Si todos pasaron consecutivamente → juego bloqueado → ganador por puntos
    if (newPassCount >= players.length) {
      await dbRun('UPDATE domino_games SET status = ? WHERE game_id = ?', ['finished', gameId]);
      return { blocked: true };
    }

    await dbRun('UPDATE domino_games SET pass_count = ? WHERE game_id = ?', [newPassCount, gameId]);
    await this.advanceTurn(gameId);
    return { blocked: false };
  }

  /** Avanza al siguiente jugador */
  static async advanceTurn(gameId: string): Promise<void> {
    const game    = await this.getGame(gameId);
    const players = await this.getPlayers(gameId);
    if (!game || !players.length) return;
    const next = (game.current_pos + 1) % players.length;
    await dbRun('UPDATE domino_games SET current_pos = ? WHERE game_id = ?', [next, gameId]);
  }

  /** Calcula el ganador por puntos cuando el juego está bloqueado */
  static async getWinnerByPoints(gameId: string): Promise<{ winner: DominoPlayer; scores: { player: DominoPlayer; points: number }[] }> {
    const players = await this.getPlayers(gameId);
    const scores  = players.map(p => ({
      player: p,
      points: p.tiles.reduce((sum, t) => sum + t.left + t.right, 0),
    }));
    scores.sort((a, b) => a.points - b.points);
    return { winner: scores[0].player, scores };
  }

  /** Verifica si el jugador actual puede jugar alguna ficha */
  static async canCurrentPlayerPlay(gameId: string): Promise<boolean> {
    const game   = await this.getGame(gameId);
    if (!game) return false;
    const player = await this.getCurrentPlayer(gameId);
    if (!player) return false;
    return player.tiles.some(t => this.canPlay(t, game.left_end, game.right_end));
  }

  // ── Bot ───────────────────────────────────────────────────────────────────

  /**
   * Juega el turno del bot.
   * Estrategia: jugar la ficha con mayor valor de puntos que sea válida.
   * Si no puede jugar, pasa.
   * Devuelve la acción tomada.
   */
  static async playBotTurn(gameId: string, botId: string): Promise<{ action: 'play' | 'pass'; tile?: DominoTile; side?: 'left' | 'right' }> {
    const game   = await this.getGame(gameId);
    const player = await this.getPlayer(gameId, botId);
    if (!game || !player) throw new Error('Bot o partida no encontrada');

    // Buscar fichas jugables ordenadas por valor (mayor primero)
    const playable: { tile: DominoTile; index: number; side: 'left' | 'right'; value: number }[] = [];

    for (let i = 0; i < player.tiles.length; i++) {
      const tile  = player.tiles[i];
      const sides = this.getValidSides(tile, game.left_end, game.right_end);
      if (sides.length > 0) {
        playable.push({
          tile, index: i,
          side: sides[0],
          value: tile.left + tile.right,
        });
      }
    }

    if (playable.length === 0) {
      // No puede jugar → pasar
      await this.passTurn(gameId, botId);
      return { action: 'pass' };
    }

    // Ordenar: primero dobles, luego por valor descendente
    playable.sort((a, b) => {
      const aDouble = a.tile.left === a.tile.right ? 1 : 0;
      const bDouble = b.tile.left === b.tile.right ? 1 : 0;
      if (aDouble !== bDouble) return bDouble - aDouble;
      return b.value - a.value;
    });

    const best = playable[0];
    await this.playTile(gameId, botId, best.index, best.side);
    return { action: 'play', tile: best.tile, side: best.side };
  }
}

export default DominoGame;
