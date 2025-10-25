const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { db, dbRun, dbAll, dbGet } = require('./db');

class BlackjackGame {
  static CARD_VALUES = {
    'A': 11, '2': 2, '3': 3, '4': 4, '5': 5,
    '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
    'J': 10, 'Q': 10, 'K': 10
  };

  static SUITS = ['♠', '♥', '♦', '♣'];
  static RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  // Create a new game
  static async createGame(channelId, creatorId) {
    const gameId = `blackjack_${Date.now()}`;
    const deck = this.generateDeck();
    
    await dbRun(
      'INSERT INTO games (game_id, channel_id, status, deck) VALUES (?, ?, ?, ?)',
      [gameId, channelId, 'waiting', JSON.stringify(deck)]
    );

    await this.addPlayer(gameId, creatorId);
    
    return gameId;
  }

  // Add player to game
  static async addPlayer(gameId, userId, isBot = false) {
    // Check if game exists and is waiting for players
    const game = await this.getGame(gameId);
    if (!game) {
      throw new Error('No se encontró la partida');
    }
    
    if (game.status !== 'waiting') {
      throw new Error('La partida ya ha comenzado');
    }
    
    // For bots, use a special user_id with 'bot-' prefix
    const playerId = isBot ? `bot-${userId}` : userId;
    const username = isBot ? `BOT-${userId}` : null; // Set bot username
    
    // Check if player is already in the game
    const existingPlayer = await this.getPlayer(gameId, playerId);
    if (existingPlayer) {
      throw new Error('Ya estás en esta partida');
    }
    
    await dbRun(
      'INSERT INTO players (user_id, game_id, username, balance, current_bet, hand, status, is_bot) VALUES (?, ?, ?, 1000, 0, ?, ?, ?)',
      [playerId, gameId, username, JSON.stringify([]), 'waiting', isBot ? 1 : 0]
    );

    return this.getPlayers(gameId);
  }
  
  // Bot makes a decision (hit or stand)
  static async botMakeDecision(gameId, botId) {
    const game = await this.getGame(gameId);
    const player = await this.getPlayer(gameId, botId);
    const handValue = this.calculateHandValue(JSON.parse(player.hand || '[]'));
    
    // Simple bot strategy: hit on 16 or less, stand on 17 or more
    if (handValue <= 16) {
      return 'hit';
    } else {
      return 'stand';
    }
  }

  // Start the game
  static async startGame(gameId) {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('No se encontró la partida');
    if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');
    
    // Get current players
    let players = await this.getPlayers(gameId);
    
    // If no players, try to add a bot
    if (players.length === 0) {
      throw new Error('No hay jugadores en la partida');
    }
    
    // If only one human player, add a bot if not already present
    const humanPlayers = players.filter(p => !p.is_bot);
    if (humanPlayers.length === 1 && !players.some(p => p.is_bot)) {
      await this.addPlayer(gameId, '1', true);
      players = await this.getPlayers(gameId);
    }
    
    // Set usernames for players that don't have one
    for (const player of players) {
      if (!player.username) {
        if (player.is_bot) {
          player.username = `BOT-${player.user_id.replace('bot-', '')}`;
        } else {
          // For human players, we'll set the username when we have access to the Discord user object
          // This will be handled in the command handler
          player.username = `Jugador ${player.position + 1}`;
        }
      }
    }
    
    // Initialize game state
    const deck = this.generateDeck();
    const dealerHand = [];
    
    // First, clear all player hands and set status
    for (const player of players) {
      await dbRun(
        'UPDATE players SET hand = ?, status = ? WHERE user_id = ? AND game_id = ?',
        [JSON.stringify([]), 'waiting', player.user_id, gameId]
      );
    }
    
    // Deal initial cards
    for (let i = 0; i < 2; i++) {
      // Deal to players
      for (const player of players) {
        const card = deck.pop();
        const currentPlayer = await this.getPlayer(gameId, player.user_id);
        let hand = [];
        
        // Initialize hand - ensure it's always a valid array
        if (currentPlayer.hand) {
          try {
            if (typeof currentPlayer.hand === 'string') {
              hand = JSON.parse(currentPlayer.hand);
            } else if (Array.isArray(currentPlayer.hand)) {
              hand = [...currentPlayer.hand];
            }
          } catch (e) {
            console.error('Error parsing hand:', e);
            hand = [];
          }
        }
        
        if (card) {
          hand.push(card);
        }
        
        await dbRun(
          'UPDATE players SET hand = ?, status = ? WHERE user_id = ? AND game_id = ?',
          [JSON.stringify(hand), 'playing', player.user_id, gameId]
        );
      }
      
      // Deal to dealer
      if (i === 0) {
        // First card is face down
        dealerHand.push('??');
      } else if (deck.length > 0) {
        dealerHand.push(deck.pop());
      }
    }
    
    // Update game status and all game data in a single transaction
    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun(
        'UPDATE games SET status = ?, deck = ?, dealer_hand = ? WHERE game_id = ?',
        ['in_progress', JSON.stringify(deck), JSON.stringify(dealerHand), gameId]
      );
      await dbRun('COMMIT');
    } catch (error) {
      await dbRun('ROLLBACK');
      console.error('Error updating game state:', error);
      throw new Error('No se pudo actualizar el estado del juego');
    }
    
    // Get updated game state
    const updatedGame = await this.getGame(gameId);
    const updatedPlayers = await this.getPlayers(gameId);
    
    if (!updatedPlayers || updatedPlayers.length === 0) {
      throw new Error('No hay jugadores en la partida después de iniciar');
    }
    
    return {
      ...updatedGame,
      players: updatedPlayers,
      current_player: updatedPlayers[0]
    };
  }

  // Player hits (takes another card)
  static async hit(gameId, userId) {
    const game = await this.getGame(gameId);
    if (!game || game.status !== 'in_progress') {
      throw new Error('La partida no está en progreso');
    }
    
    const player = await this.getPlayer(gameId, userId);
    if (!player || player.status !== 'playing') {
      throw new Error('No es tu turno o acción inválida');
    }
    
    // Get the deck
    let deck = [];
    try {
      deck = game.deck ? JSON.parse(game.deck) : this.generateDeck();
    } catch (e) {
      console.error('Error parsing deck:', e);
      deck = this.generateDeck();
    }
    
    // Draw a card
    if (deck.length === 0) {
      deck = this.generateDeck(); // Reshuffle if deck is empty
    }
    const card = deck.pop();
    
    // Update player's hand
    const currentHand = player.hand || [];
    const newHand = [...currentHand, card];
    
    // Calculate hand value
    const handValue = this.calculateHandValue(newHand);
    let status = 'playing';
    
    // Check for bust or blackjack
    if (handValue > 21) {
      status = 'busted';
    } else if (handValue === 21) {
      status = newHand.length === 2 ? 'blackjack' : 'stood';
    }
    
    // Update player's hand and status in database
    await dbRun(
      'UPDATE players SET hand = ?, status = ? WHERE user_id = ? AND game_id = ?',
      [JSON.stringify(newHand), status, userId, gameId]
    );
    
    // Update deck in database
    await dbRun(
      'UPDATE games SET deck = ? WHERE game_id = ?',
      [JSON.stringify(deck), gameId]
    );
    
    // Log the hit action
    await dbRun(
      'INSERT INTO player_actions (game_id, user_id, action) VALUES (?, ?, ?)',
      [gameId, userId, 'hit']
    );
    
    // If player busted or got blackjack, move to next player
    if (status === 'busted' || status === 'blackjack' || status === 'stood') {
      return this.nextPlayer(gameId);
    }
    
    // Return updated game state if player is still playing
    return this.getGame(gameId);
  }

  // Player stands (ends their turn)
  static async stand(gameId, userId) {
    const player = await this.getPlayer(gameId, userId);
    if (!player || player.status !== 'playing') throw new Error('Not your turn or invalid action');
    
    await dbRun(
      'UPDATE players SET status = ? WHERE user_id = ? AND game_id = ?',
      ['stood', userId, gameId]
    );
    
    // Log action
    await dbRun(
      'INSERT INTO player_actions (game_id, user_id, action) VALUES (?, ?, ?)',
      [gameId, userId, 'stand']
    );
    
    // Move to next player
    await this.nextPlayer(gameId);
    
    return { success: true };
  }

  // Helper method to move to next player
  static async nextPlayer(gameId) {
    const players = await this.getPlayers(gameId);
    const game = await this.getGame(gameId);
    
    // Find the current player index if not set
    let currentIndex = game.current_player_index || 0;
    let nextIndex = currentIndex + 1;
    
    // If we've gone through all players, it's the dealer's turn
    if (nextIndex >= players.length) {
      // Dealer's turn
      return await this.dealerPlay(gameId);
    }
    
    // Find next player who is still playing
    let nextPlayer = players[nextIndex];
    while (nextIndex < players.length && 
          (nextPlayer.status !== 'playing' || nextPlayer.status === 'busted' || nextPlayer.status === 'stood' || nextPlayer.status === 'blackjack')) {
      nextIndex++;
      nextPlayer = players[nextIndex];
    }
    
    if (nextPlayer && nextIndex < players.length) {
      // Update current player
      await dbRun(
        'UPDATE games SET current_player_index = ? WHERE game_id = ?',
        [nextIndex, gameId]
      );
      
      // If it's a bot's turn, make a decision
      if (nextPlayer.is_bot) {
        // Small delay to make it feel more natural
        await new Promise(resolve => setTimeout(resolve, 1500));
        return this.botMakeDecision(gameId, nextPlayer.user_id);
      }
      
      return nextPlayer;
    } else {
      // No more players, dealer's turn
      return await this.dealerPlay(gameId);
    }
  }

  // Dealer's turn to play
  static async dealerPlay(gameId) {
    // Update game status to dealer's turn
    await dbRun(
      'UPDATE games SET status = ? WHERE game_id = ?',
      ['dealer_turn', gameId]
    );
    
    // Small delay to make it feel more natural
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    let game = await this.getGame(gameId);
    let deck = game.deck ? JSON.parse(game.deck) : this.generateDeck();
    let dealerHand = [];
    
    try {
      dealerHand = game.dealer_hand ? JSON.parse(game.dealer_hand) : [];
    } catch (e) {
      console.error('Error parsing dealer hand:', e);
      dealerHand = [];
    }
    
    // Reveal dealer's first card if it was hidden
    if (dealerHand[0] === '??' && dealerHand.length > 1) {
      // Get a new card to replace the hidden one
      if (deck.length === 0) {
        deck = this.generateDeck();
      }
      dealerHand[0] = deck.pop();
    }
    
    // Dealer hits on 16, stands on 17
    while (this.calculateHandValue(dealerHand) < 17) {
      if (deck.length === 0) {
        deck = this.generateDeck();
      }
      const card = deck.pop();
      dealerHand.push(card);
      
      // Update the game state after each card is drawn
      await dbRun(
        'UPDATE games SET deck = ?, dealer_hand = ? WHERE game_id = ?',
        [JSON.stringify(deck), JSON.stringify(dealerHand), gameId]
      );
      
      // Small delay between dealer's actions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Update game state to finished
    await dbRun(
      'UPDATE games SET status = ?, deck = ?, dealer_hand = ? WHERE game_id = ?',
      ['finished', JSON.stringify(deck), JSON.stringify(dealerHand), gameId]
    );
    
    // Calculate and return results
    return await this.calculateResults(gameId, dealerHand);
  }

  // Calculate hand value
  static calculateHandValue(cards) {
    let value = 0;
    let aces = 0;
    
    for (const card of cards) {
      const rank = card.split(' ')[0];
      if (rank === 'A') aces++;
      value += this.CARD_VALUES[rank];
    }
    
    // Handle aces (can be 1 or 11)
    while (value > 21 && aces > 0) {
      value -= 10;
      aces--;
    }
    
    return value;
  }

  // Calculate game results
  static async calculateResults(gameId, dealerHand) {
    const dealerValue = this.calculateHandValue(dealerHand);
    const players = await this.getPlayers(gameId);
    const results = [];
    
    for (const player of players) {
      const hand = player.hand ? JSON.parse(player.hand) : [];
      const playerValue = this.calculateHandValue(hand);
      let result = 'lose';
      let winnings = 0;
      
      if (player.status === 'blackjack') {
        // Blackjack pays 3:2
        result = 'blackjack';
        winnings = Math.floor(player.current_bet * 2.5);
      } else if (player.status === 'busted') {
        result = 'bust';
        winnings = 0;
      } else if (dealerValue > 21) {
        // Dealer busts, player wins
        result = 'win';
        winnings = player.current_bet * 2;
      } else if (playerValue > dealerValue) {
        // Player beats dealer
        result = 'win';
        winnings = player.current_bet * 2;
      } else if (playerValue === dealerValue) {
        // Push
        result = 'push';
        winnings = player.current_bet;
      }
      
      // Update player balance
      const newBalance = (player.balance || 1000) - player.current_bet + winnings;
      await dbRun(
        'UPDATE players SET balance = ?, current_bet = 0 WHERE user_id = ? AND game_id = ?',
        [newBalance, player.user_id, gameId]
      );
      
      results.push({
        userId: player.user_id,
        hand,
        handValue: playerValue,
        result,
        winnings: winnings - player.current_bet,
        newBalance
      });
    }
    
    return {
      dealerHand,
      dealerValue,
      results
    };
  }

  // Generate a new shuffled deck
  static generateDeck() {
    const deck = [];
    for (const suit of this.SUITS) {
      for (const rank of this.RANKS) {
        deck.push(`${rank} ${suit}`);
      }
    }
    
    // Shuffle the deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
  }

  // Helper method to get game by ID
  static async getGame(gameId) {
    return dbGet('SELECT * FROM games WHERE game_id = ?', [gameId]);
  }

  // Helper method to safely parse player hand data
  static parseHand(handData) {
    if (!handData) return [];
    try {
      if (typeof handData === 'string') {
        // If it's a string, try to parse it as JSON
        const parsed = JSON.parse(handData);
        return Array.isArray(parsed) ? parsed : [];
      } else if (Array.isArray(handData)) {
        // If it's already an array, return a copy
        return [...handData];
      }
    } catch (e) {
      console.error('Error parsing hand data:', e);
    }
    return [];
  }

  // Helper method to get all players in a game
  static async getPlayers(gameId) {
    try {
      const players = await dbAll(
        'SELECT * FROM players WHERE game_id = ? ORDER BY position',
        [gameId]
      );

      return players.map((p, index) => ({
        ...p,
        username: p.username || (p.is_bot ? `BOT-${p.user_id.replace('bot-', '')}` : `Jugador ${index + 1}`),
        balance: p.balance || 1000,
        current_bet: p.current_bet || 0,
        hand: this.parseHand(p.hand),
        status: p.status || 'waiting',
        position: index
      }));
    } catch (error) {
      console.error('Error getting players:', error);
      return [];
    }
  }

  // Helper method to get a specific player
  static async getPlayer(gameId, userId) {
    try {
      const player = await dbGet(
        'SELECT * FROM players WHERE game_id = ? AND user_id = ?',
        [gameId, userId]
      );
      
      if (!player) return null;
      
      return {
        ...player,
        balance: player.balance || 1000,
        current_bet: player.current_bet || 0,
        hand: this.parseHand(player.hand),
        status: player.status || 'waiting'
      };
    } catch (error) {
      console.error('Error getting player:', error);
      return null;
    }
  }

  // Create game embed
  static createGameEmbed(game, players, currentPlayerId = null) {
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle('🎰 Blackjack')
      .setDescription('¡Bienvenido a la mesa de Blackjack!');
    
    // Add dealer info
    let dealerHand = [];
    try {
      if (game.dealer_hand) {
        if (typeof game.dealer_hand === 'string') {
          dealerHand = JSON.parse(game.dealer_hand);
        } else if (Array.isArray(game.dealer_hand)) {
          dealerHand = [...game.dealer_hand];
        }
      }
    } catch (e) {
      console.error('Error parsing dealer hand:', e);
      dealerHand = [];
    }
    
    const dealerValue = this.calculateHandValue(dealerHand);
    const isDealerTurn = game.status === 'dealer_turn' || game.status === 'finished';
    
    embed.addFields({
      name: '💼 Dealer' + (isDealerTurn ? ` (${dealerValue})` : ''),
      value: this.formatHand(dealerHand, !isDealerTurn && game.status === 'in_progress')
    });
    
    // Add players
    for (const player of players) {
      const handValue = this.calculateHandValue(player.hand || []);
      const isCurrent = currentPlayerId === player.user_id;
      
      const statusEmoji = {
        'waiting': '⏳',
        'playing': '🎲',
        'stood': '✋',
        'busted': '💥',
        'blackjack': '🃏'
      }[player.status] || '❓';
      
      const statusText = {
        'waiting': 'Esperando...',
        'playing': isCurrent ? '¡Tu turno!' : 'Pensando...',
        'stood': 'Se plantó',
        'busted': 'Se pasó',
        'blackjack': '¡Blackjack!'
      }[player.status] || player.status;
      
      embed.addFields({
        name: `${isCurrent ? '➡️ ' : ''}👤 ${player.username || `Jugador ${player.position + 1}`} ${statusEmoji}`,
        value: [
          `Mano: ${this.formatHand(player.hand || [])}`,
          `Valor: ${handValue}`,
          `Apuesta: $${player.current_bet || 0}`,
          `Saldo: $${player.balance || 1000}`,
          `Estado: ${statusText}`
        ].join('\n'),
        inline: true
      });
    }
    
    // Add game status
    embed.addFields({
      name: 'Estado del Juego',
      value: {
        'waiting': '🔄 Esperando jugadores...',
        'in_progress': '🎲 Partida en curso',
        'finished': '🏁 Partida terminada'
      }[game.status] || game.status
    });
    
    return embed;
  }

  // Create game action buttons
  static createGameButtons(game, currentPlayerId = null) {
    const row = new ActionRowBuilder();
    const players = game.players || [];
    
    if (game.status === 'waiting') {
      // Show join and start buttons in waiting state
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`blackjack_join_${game.game_id}`)
          .setLabel('Unirse a la partida')
          .setStyle(ButtonStyle.Primary)
      );
      
      if (players.length > 0) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`blackjack_start_${game.game_id}`)
            .setLabel('Iniciar partida')
            .setStyle(ButtonStyle.Success)
        );
      }
      
      return row;
    }
    
    if (game.status === 'in_progress' || game.status === 'dealer_turn') {
      // Find the current active player (status 'playing')
      const activePlayer = players.find(p => p.status === 'playing');
      
      // Check if it's the current user's turn
      const isCurrentPlayer = activePlayer && activePlayer.user_id === currentPlayerId;
      
      if (isCurrentPlayer) {
        // Player's turn - show hit/stand buttons
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`blackjack_hit_${game.game_id}`)
            .setLabel('Pedir carta')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`blackjack_stand_${game.game_id}`)
            .setLabel('Plantarse')
            .setStyle(ButtonStyle.Secondary)
        );
      } else if (activePlayer) {
        // Show who's turn it is
        const label = activePlayer.is_bot ? 'Turno de la bota...' : `Turno de <@${activePlayer.user_id}>`;
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('blackjack_waiting')
            .setLabel(label)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      } else if (game.status === 'dealer_turn') {
        // Dealer's turn
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('blackjack_dealer_turn')
            .setLabel('Turno del crupier...')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      } else {
        // No active players, but game is still in progress (shouldn't happen)
        row.addComponents(
          new ButtonBuilder()
            .setCustomId('blackjack_processing')
            .setLabel('Procesando...')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );
      }
      
      return row;
    }
    
    // Game is finished or in an unknown state
    row.addComponents(
      new ButtonBuilder()
        .setCustomId('blackjack_game_ended')
        .setLabel(game.status === 'finished' ? 'Partida terminada' : 'Esperando...')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    
    return row;
  }

  // Format hand for display
  static formatHand(cards, hideFirstCard = false) {
    if (!cards || cards.length === 0) return 'Ninguna carta';
    
    if (hideFirstCard) {
      return `[???] ${cards.slice(1).map(card => `[${card}]`).join(' ')}`;
    }
    
    return cards.map(card => `[${card}]`).join(' ');
  }
}

// Export the BlackjackGame class
module.exports = BlackjackGame;
