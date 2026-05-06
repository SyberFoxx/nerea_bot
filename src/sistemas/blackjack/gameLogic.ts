import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { dbRun, dbAll, dbGet } from './db';

const CARD_VALUES: Record<string, number> = {
  A: 11, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 10, Q: 10, K: 10,
};
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export class BlackjackGame {
  static generateDeck(): string[] {
    const deck: string[] = [];
    for (const suit of SUITS) for (const rank of RANKS) deck.push(`${rank} ${suit}`);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  static calculateHandValue(cards: string[]): number {
    let value = 0, aces = 0;
    for (const card of cards) {
      const rank = card.split(' ')[0];
      if (rank === 'A') aces++;
      value += CARD_VALUES[rank] ?? 0;
    }
    while (value > 21 && aces > 0) { value -= 10; aces--; }
    return value;
  }

  static parseHand(handData: any): string[] {
    if (!handData) return [];
    try {
      if (typeof handData === 'string') { const p = JSON.parse(handData); return Array.isArray(p) ? p : []; }
      if (Array.isArray(handData)) return [...handData];
    } catch { /* ignorar */ }
    return [];
  }

  static formatHand(cards: string[], hideFirst = false): string {
    if (!cards?.length) return 'Ninguna carta';
    if (hideFirst) return `[???] ${cards.slice(1).map(c => `[${c}]`).join(' ')}`;
    return cards.map(c => `[${c}]`).join(' ');
  }

  static async getGame(gameId: string): Promise<any> {
    return dbGet('SELECT * FROM games WHERE game_id = ?', [gameId]);
  }

  static async getPlayers(gameId: string): Promise<any[]> {
    try {
      const players = await dbAll('SELECT * FROM players WHERE game_id = ? ORDER BY position', [gameId]);
      return players.map((p, i) => ({
        ...p,
        username: p.username ?? (p.is_bot ? `BOT-${p.user_id.replace('bot-', '')}` : `Jugador ${i + 1}`),
        balance: p.balance ?? 1000,
        current_bet: p.current_bet ?? 0,
        hand: this.parseHand(p.hand),
        status: p.status ?? 'waiting',
        position: i,
      }));
    } catch { return []; }
  }

  static async getPlayer(gameId: string, userId: string): Promise<any | null> {
    try {
      const p = await dbGet('SELECT * FROM players WHERE game_id = ? AND user_id = ?', [gameId, userId]);
      if (!p) return null;
      return { ...p, balance: p.balance ?? 1000, current_bet: p.current_bet ?? 0, hand: this.parseHand(p.hand), status: p.status ?? 'waiting' };
    } catch { return null; }
  }

  static async createGame(channelId: string, creatorId: string): Promise<string> {
    const gameId = `blackjack_${Date.now()}`;
    await dbRun('INSERT INTO games (game_id, channel_id, status, deck) VALUES (?, ?, ?, ?)',
      [gameId, channelId, 'waiting', JSON.stringify(this.generateDeck())]);
    await this.addPlayer(gameId, creatorId);
    return gameId;
  }

  static async addPlayer(gameId: string, userId: string, isBot = false): Promise<any[]> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('No se encontró la partida');
    if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');
    const playerId = isBot ? `bot-${userId}` : userId;
    const existing = await this.getPlayer(gameId, playerId);
    if (existing) throw new Error('Ya estás en esta partida');
    await dbRun('INSERT INTO players (user_id, game_id, username, balance, current_bet, hand, status, is_bot) VALUES (?, ?, ?, 1000, 0, ?, ?, ?)',
      [playerId, gameId, isBot ? `BOT-${userId}` : null, JSON.stringify([]), 'waiting', isBot ? 1 : 0]);
    return this.getPlayers(gameId);
  }

  static async startGame(gameId: string): Promise<any> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('No se encontró la partida');
    if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');
    let players = await this.getPlayers(gameId);
    if (!players.length) throw new Error('No hay jugadores');
    if (players.filter(p => !p.is_bot).length === 1 && !players.some(p => p.is_bot)) {
      await this.addPlayer(gameId, '1', true);
      players = await this.getPlayers(gameId);
    }
    const deck = this.generateDeck();
    const dealerHand: string[] = [];
    for (const p of players) await dbRun('UPDATE players SET hand = ?, status = ? WHERE user_id = ? AND game_id = ?', [JSON.stringify([]), 'waiting', p.user_id, gameId]);
    for (let i = 0; i < 2; i++) {
      for (const p of players) {
        const card = deck.pop()!;
        const cur = await this.getPlayer(gameId, p.user_id);
        const hand = [...(cur?.hand ?? []), card];
        await dbRun('UPDATE players SET hand = ?, status = ? WHERE user_id = ? AND game_id = ?', [JSON.stringify(hand), 'playing', p.user_id, gameId]);
      }
      dealerHand.push(i === 0 ? '??' : deck.pop()!);
    }
    await dbRun('BEGIN TRANSACTION');
    try {
      await dbRun('UPDATE games SET status = ?, deck = ?, dealer_hand = ? WHERE game_id = ?', ['in_progress', JSON.stringify(deck), JSON.stringify(dealerHand), gameId]);
      await dbRun('COMMIT');
    } catch (e) { await dbRun('ROLLBACK'); throw e; }
    const updatedPlayers = await this.getPlayers(gameId);
    return { ...await this.getGame(gameId), players: updatedPlayers, current_player: updatedPlayers[0] };
  }

  static async hit(gameId: string, userId: string): Promise<any> {
    const game = await this.getGame(gameId);
    if (!game || game.status !== 'in_progress') throw new Error('La partida no está en progreso');
    const player = await this.getPlayer(gameId, userId);
    if (!player || player.status !== 'playing') throw new Error('No es tu turno');
    let deck = game.deck ? JSON.parse(game.deck) : this.generateDeck();
    if (!deck.length) deck = this.generateDeck();
    const card = deck.pop();
    const newHand = [...(player.hand ?? []), card];
    const val = this.calculateHandValue(newHand);
    const status = val > 21 ? 'busted' : val === 21 ? (newHand.length === 2 ? 'blackjack' : 'stood') : 'playing';
    await dbRun('UPDATE players SET hand = ?, status = ? WHERE user_id = ? AND game_id = ?', [JSON.stringify(newHand), status, userId, gameId]);
    await dbRun('UPDATE games SET deck = ? WHERE game_id = ?', [JSON.stringify(deck), gameId]);
    await dbRun('INSERT INTO player_actions (game_id, user_id, action) VALUES (?, ?, ?)', [gameId, userId, 'hit']);
    if (status !== 'playing') return this.nextPlayer(gameId);
    return this.getGame(gameId);
  }

  static async stand(gameId: string, userId: string): Promise<any> {
    const player = await this.getPlayer(gameId, userId);
    if (!player || player.status !== 'playing') throw new Error('No es tu turno');
    await dbRun('UPDATE players SET status = ? WHERE user_id = ? AND game_id = ?', ['stood', userId, gameId]);
    await dbRun('INSERT INTO player_actions (game_id, user_id, action) VALUES (?, ?, ?)', [gameId, userId, 'stand']);
    await this.nextPlayer(gameId);
    return { success: true };
  }

  static async nextPlayer(gameId: string): Promise<any> {
    const players = await this.getPlayers(gameId);
    const game = await this.getGame(gameId);
    let nextIndex = (game.current_player_index ?? 0) + 1;
    if (nextIndex >= players.length) return this.dealerPlay(gameId);
    let next = players[nextIndex];
    while (nextIndex < players.length && next?.status !== 'playing') { nextIndex++; next = players[nextIndex]; }
    if (next && nextIndex < players.length) {
      await dbRun('UPDATE games SET current_player_index = ? WHERE game_id = ?', [nextIndex, gameId]);
      if (next.is_bot) { await new Promise(r => setTimeout(r, 1500)); return this.botMakeDecision(gameId, next.user_id); }
      return next;
    }
    return this.dealerPlay(gameId);
  }

  static async botMakeDecision(gameId: string, botId: string): Promise<string> {
    const player = await this.getPlayer(gameId, botId);
    return this.calculateHandValue(player?.hand ?? []) <= 16 ? 'hit' : 'stand';
  }

  static async dealerPlay(gameId: string): Promise<any> {
    await dbRun('UPDATE games SET status = ? WHERE game_id = ?', ['dealer_turn', gameId]);
    await new Promise(r => setTimeout(r, 1000));
    let game = await this.getGame(gameId);
    let deck = game.deck ? JSON.parse(game.deck) : this.generateDeck();
    let dealerHand: string[] = [];
    try { dealerHand = game.dealer_hand ? JSON.parse(game.dealer_hand) : []; } catch { dealerHand = []; }
    if (dealerHand[0] === '??') { if (!deck.length) deck = this.generateDeck(); dealerHand[0] = deck.pop()!; }
    while (this.calculateHandValue(dealerHand) < 17) {
      if (!deck.length) deck = this.generateDeck();
      dealerHand.push(deck.pop()!);
      await dbRun('UPDATE games SET deck = ?, dealer_hand = ? WHERE game_id = ?', [JSON.stringify(deck), JSON.stringify(dealerHand), gameId]);
      await new Promise(r => setTimeout(r, 1000));
    }
    await dbRun('UPDATE games SET status = ?, deck = ?, dealer_hand = ? WHERE game_id = ?', ['finished', JSON.stringify(deck), JSON.stringify(dealerHand), gameId]);
    return this.calculateResults(gameId, dealerHand);
  }

  static async calculateResults(gameId: string, dealerHand: string[]): Promise<any> {
    const dealerValue = this.calculateHandValue(dealerHand);
    const players = await this.getPlayers(gameId);
    const results = [];
    for (const player of players) {
      const pVal = this.calculateHandValue(player.hand ?? []);
      let result = 'lose', winnings = 0;
      if (player.status === 'blackjack') { result = 'blackjack'; winnings = Math.floor(player.current_bet * 2.5); }
      else if (player.status === 'busted') { result = 'bust'; winnings = 0; }
      else if (dealerValue > 21) { result = 'win'; winnings = player.current_bet * 2; }
      else if (pVal > dealerValue) { result = 'win'; winnings = player.current_bet * 2; }
      else if (pVal === dealerValue) { result = 'push'; winnings = player.current_bet; }
      const newBalance = (player.balance ?? 1000) - player.current_bet + winnings;
      await dbRun('UPDATE players SET balance = ?, current_bet = 0 WHERE user_id = ? AND game_id = ?', [newBalance, player.user_id, gameId]);
      results.push({ userId: player.user_id, hand: player.hand, handValue: pVal, result, winnings: winnings - player.current_bet, newBalance });
    }
    return { dealerHand, dealerValue, results };
  }

  static createGameEmbed(game: any, players: any[], currentPlayerId: string | null = null): EmbedBuilder {
    const embed = new EmbedBuilder().setColor('#0099ff').setTitle('🎰 Blackjack').setDescription('¡Bienvenido a la mesa de Blackjack!');
    let dealerHand: string[] = [];
    try { dealerHand = game.dealer_hand ? JSON.parse(game.dealer_hand) : []; } catch { dealerHand = []; }
    const isDealerTurn = game.status === 'dealer_turn' || game.status === 'finished';
    embed.addFields({ name: `💼 Dealer${isDealerTurn ? ` (${this.calculateHandValue(dealerHand)})` : ''}`, value: this.formatHand(dealerHand, !isDealerTurn && game.status === 'in_progress') });
    for (const p of players) {
      const val = this.calculateHandValue(p.hand ?? []);
      const isCurrent = currentPlayerId === p.user_id;
      const statusEmoji: Record<string, string> = { waiting: '⏳', playing: '🎲', stood: '✋', busted: '💥', blackjack: '🃏' };
      const statusText: Record<string, string> = { waiting: 'Esperando...', playing: isCurrent ? '¡Tu turno!' : 'Pensando...', stood: 'Se plantó', busted: 'Se pasó', blackjack: '¡Blackjack!' };
      embed.addFields({ name: `${isCurrent ? '➡️ ' : ''}👤 ${p.username ?? `Jugador ${p.position + 1}`} ${statusEmoji[p.status] ?? '❓'}`, value: `Mano: ${this.formatHand(p.hand ?? [])}\nValor: ${val}\nApuesta: $${p.current_bet ?? 0}\nSaldo: $${p.balance ?? 1000}\nEstado: ${statusText[p.status] ?? p.status}`, inline: true });
    }
    embed.addFields({ name: 'Estado', value: { waiting: '🔄 Esperando...', in_progress: '🎲 En curso', finished: '🏁 Terminada' }[game.status as string] ?? game.status });
    return embed;
  }

  static createGameButtons(game: any, currentPlayerId: string | null = null): ActionRowBuilder<ButtonBuilder> {
    const row = new ActionRowBuilder<ButtonBuilder>();
    const players: any[] = game.players ?? [];
    if (game.status === 'waiting') {
      row.addComponents(new ButtonBuilder().setCustomId(`blackjack_join_${game.game_id}`).setLabel('Unirse').setStyle(ButtonStyle.Primary));
      if (players.length > 0) row.addComponents(new ButtonBuilder().setCustomId(`blackjack_start_${game.game_id}`).setLabel('Iniciar').setStyle(ButtonStyle.Success));
      return row;
    }
    if (game.status === 'in_progress' || game.status === 'dealer_turn') {
      const active = players.find(p => p.status === 'playing');
      if (active?.user_id === currentPlayerId) {
        row.addComponents(
          new ButtonBuilder().setCustomId(`blackjack_hit_${game.game_id}`).setLabel('Pedir carta').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`blackjack_stand_${game.game_id}`).setLabel('Plantarse').setStyle(ButtonStyle.Secondary)
        );
      } else {
        row.addComponents(new ButtonBuilder().setCustomId('blackjack_waiting').setLabel(active ? `Turno de ${active.is_bot ? 'la bota' : `<@${active.user_id}>`}` : 'Procesando...').setStyle(ButtonStyle.Secondary).setDisabled(true));
      }
      return row;
    }
    row.addComponents(new ButtonBuilder().setCustomId('blackjack_ended').setLabel('Partida terminada').setStyle(ButtonStyle.Secondary).setDisabled(true));
    return row;
  }
}

export default BlackjackGame;
