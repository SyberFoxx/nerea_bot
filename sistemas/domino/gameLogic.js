const { db, dbRun, dbAll, dbGet } = require('./db');
const { EmbedBuilder } = require('discord.js');

class DominoGame {
  static async createGame(channelId, creatorId) {
    const gameId = `domino_${Date.now()}`;
    
    await dbRun(
      'INSERT INTO games (game_id, channel_id, status, creator_id) VALUES (?, ?, ?, ?)',
      [gameId, channelId, 'waiting', creatorId]
    );
    
    // Añadir al creador como primer jugador
    await this.addPlayer(gameId, creatorId);
    
    return gameId;
  }

  static async addPlayer(gameId, userId) {
    const game = await dbGet('SELECT * FROM games WHERE game_id = ?', [gameId]);
    if (!game) throw new Error('Juego no encontrado');
    if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');

    const players = await this.getPlayers(gameId);
    if (players.length >= 4) throw new Error('El juego ya está lleno (máx. 4 jugadores)');
    if (players.some(p => p.user_id === userId)) {
      throw new Error('Ya estás en esta partida');
    }

    await dbRun(
      'INSERT INTO players (user_id, game_id, position) VALUES (?, ?, ?)',
      [userId, gameId, players.length]
    );

    return players.length + 1; // Retorna la nueva cantidad de jugadores
  }

  static async getPlayers(gameId) {
    const players = await dbAll(
      'SELECT * FROM players WHERE game_id = ? ORDER BY position',
      [gameId]
    );
    
    // Asegurar que todos los jugadores tengan la misma estructura
    return players.map(p => ({
      id: p.user_id || p.id, // Usar user_id como id principal
      user_id: p.user_id || p.id, // Mantener user_id para compatibilidad
      game_id: p.game_id,
      position: p.position,
      score: p.score || 0,
      isReady: p.is_ready || p.isReady || false
    }));
  }

  static async getPlayer(gameId, userId) {
    const player = await dbGet(
      'SELECT * FROM players WHERE game_id = ? AND user_id = ?',
      [gameId, userId]
    );
    
    if (!player) return null;
    
    // Asegurar que el jugador tenga la misma estructura
    return {
      id: player.user_id || player.id,
      user_id: player.user_id || player.id,
      game_id: player.game_id,
      position: player.position,
      score: player.score || 0,
      isReady: player.is_ready || player.isReady || false
    };
  }

  static async getGame(gameId) {
    const game = await dbGet('SELECT * FROM games WHERE game_id = ?', [gameId]);
    if (!game) throw new Error('Juego no encontrado');
    return game;
  }

  static async getGameStatus(gameId) {
    const game = await this.getGame(gameId);
    const players = await this.getPlayers(gameId);
    const playerCount = players.length;
    
    return {
      status: game.status,
      playerCount,
      maxPlayers: 4,
      currentPlayer: game.current_player,
      players: players.map(p => ({
        id: p.user_id,
        position: p.position,
        score: p.score,
        isReady: Boolean(p.is_ready)
      }))
    };
  }

  static async startGame(gameId) {
    const players = await this.getPlayers(gameId);
    if (players.length < 2) {
      throw new Error('Se necesitan al menos 2 jugadores para comenzar');
    }

    // Actualizar estado del juego
    await dbRun(
      'UPDATE games SET status = ?, current_player = 0 WHERE game_id = ?',
      ['in_progress', gameId]
    );

    // Repartir fichas a los jugadores
    await this.dealTiles(gameId, players);

    // Repartir fichas
    await this.dealTiles(gameId, players);
    
    // Iniciar el juego
    await this.nextTurn(gameId);
    
    // Obtener el estado actualizado del juego
    const game = await this.getGame(gameId);
    const gameStatus = await this.getGameStatus(gameId);
    
    // Obtener el jugador actual desde la base de datos
    const currentPlayer = await new Promise((resolve, reject) => {
      db.get(
        'SELECT user_id FROM players WHERE game_id = ? ORDER BY position ASC LIMIT 1',
        [gameId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row ? row.user_id : null);
        }
      );
    });

    if (!currentPlayer) {
      throw new Error('No se pudo determinar el jugador actual');
    }

    return {
      success: true,
      game,
      players: gameStatus.players,
      currentPlayer: currentPlayer
    };
  }

  static async dealTiles(gameId, players) {
    // Crear todas las fichas del dominó (28 fichas doble-seis)
    const tiles = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        tiles.push({ left: i, right: j });
      }
    }

    // Barajar las fichas
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    console.log('Repartiendo fichas para jugadores:', players); // Debug

    // Repartir 7 fichas a cada jugador
    for (let i = 0; i < players.length; i++) {
      const playerId = players[i].id || players[i].user_id; // Usar id o user_id como respaldo
      console.log(`Repartiendo fichas al jugador ${i}:`, playerId); // Debug
      
      for (let j = 0; j < 7; j++) {
        if (tiles.length === 0) {
          console.error('No hay suficientes fichas para repartir');
          break;
        }
        
        const tile = tiles.pop();
        await dbRun(
          'INSERT INTO tiles (game_id, user_id, left_value, right_value, position) VALUES (?, ?, ?, ?, ?)',
          [gameId, playerId, tile.left, tile.right, j]
        );
      }
    }
  }

  static async nextTurn(gameId) {
    const game = await dbGet('SELECT * FROM games WHERE game_id = ?', [gameId]);
    const players = await this.getPlayers(gameId);
    
    const nextPlayer = (game.current_player + 1) % players.length;
    
    await dbRun(
      'UPDATE games SET current_player = ? WHERE game_id = ?',
      [nextPlayer, gameId]
    );
    
    return nextPlayer;
  }

  static async getPlayerTiles(gameId, userId) {
    return dbAll(
      'SELECT * FROM tiles WHERE game_id = ? AND user_id = ? AND is_played = 0 ORDER BY position',
      [gameId, userId]
    );
  }

  static async playTile(gameId, userId, tileId, side = null) {
    // Implementar lógica para jugar una ficha
    // Esto es un esqueleto básico
    const tile = await dbGet(
      'SELECT * FROM tiles WHERE game_id = ? AND user_id = ? AND rowid = ?',
      [gameId, userId, tileId]
    );
    
    if (!tile) throw new Error('Ficha no encontrada');
    
    // Marcar la ficha como jugada
    await dbRun(
      'UPDATE tiles SET is_played = 1 WHERE rowid = ?',
      [tileId]
    );
    
    // Aquí iría la lógica para colocar la ficha en el tablero
    // y verificar si el juego ha terminado
    
    // Pasar al siguiente turno
    await this.nextTurn(gameId);
  }
}

module.exports = DominoGame;