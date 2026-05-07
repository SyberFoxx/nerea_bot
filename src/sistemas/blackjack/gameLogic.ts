import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { dbRun, dbAll, dbGet } from './db';

// ─── Constantes ────────────────────────────────────────────────────────────────
const CARD_VALUES: Record<string, number> = {
  A: 11, '2': 2, '3': 3, '4': 4, '5': 5,
  '6': 6, '7': 7, '8': 8, '9': 9, '10': 10,
  J: 10, Q: 10, K: 10,
};
const SUITS  = ['♠', '♥', '♦', '♣'];
const RANKS  = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUIT_EMOJI: Record<string, string> = { '♠':'♠️','♥':'♥️','♦':'♦️','♣':'♣️' };
const COLORS = { waiting:0x3498db, in_progress:0xf39c12, dealer_turn:0xe67e22, finished:0x2ecc71 };

// ─── Tipos ─────────────────────────────────────────────────────────────────────
export type PlayerStatus = 'waiting'|'playing'|'stood'|'busted'|'blackjack'|'surrendered'|'doubled';

export interface GamePlayer {
  user_id: string; game_id: string; username: string;
  balance: number; current_bet: number; hand: string[];
  status: PlayerStatus; is_bot: boolean; position: number;
}
export interface GameResult {
  userId: string; hand: string[]; handValue: number;
  result: 'blackjack'|'win'|'push'|'lose'|'bust'|'surrender';
  profit: number; newBalance: number;
}
export interface GameData {
  game_id: string; channel_id: string; status: string;
  current_player_index: number; deck: string; dealer_hand: string;
  message_id: string|null; creator_id: string;
}

// ─── Clase principal ───────────────────────────────────────────────────────────
export class BlackjackGame {

  // ── Utilidades ────────────────────────────────────────────────────────────

  static generateDeck(): string[] {
    const deck: string[] = [];
    for (const s of SUITS) for (const r of RANKS) deck.push(`${r} ${s}`);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  static calculateHandValue(cards: string[]): number {
    let value = 0, aces = 0;
    for (const card of cards) {
      if (card === '??') continue;
      const rank = card.split(' ')[0];
      if (rank === 'A') aces++;
      value += CARD_VALUES[rank] ?? 0;
    }
    while (value > 21 && aces > 0) { value -= 10; aces--; }
    return value;
  }

  static parseHand(data: any): string[] {
    if (!data) return [];
    try {
      if (typeof data === 'string') { const p = JSON.parse(data); return Array.isArray(p) ? p : []; }
      if (Array.isArray(data)) return [...data];
    } catch { /* ignorar */ }
    return [];
  }

  static formatCard(card: string): string {
    if (card === '??') return '🂠';
    const [rank, suit] = card.split(' ');
    return `\`${rank}${SUIT_EMOJI[suit] ?? suit}\``;
  }

  static formatHand(cards: string[], hideFirst = false): string {
    if (!cards?.length) return '*Sin cartas*';
    const display = hideFirst ? ['??', ...cards.slice(1)] : cards;
    return display.map(c => c === '??' ? '🂠' : this.formatCard(c)).join(' ');
  }

  // ── DB helpers ────────────────────────────────────────────────────────────

  static getGame(gameId: string): Promise<GameData | null> {
    return dbGet('SELECT * FROM games WHERE game_id = ?', [gameId]);
  }

  static async getPlayers(gameId: string): Promise<GamePlayer[]> {
    try {
      const rows = await dbAll('SELECT * FROM players WHERE game_id = ? ORDER BY position', [gameId]);
      return rows.map((p, i) => ({
        ...p,
        username: p.username ?? (p.is_bot ? '🤖 BOT' : `Jugador ${i + 1}`),
        balance: p.balance ?? 1000,
        current_bet: p.current_bet ?? 0,
        hand: this.parseHand(p.hand),
        status: (p.status ?? 'waiting') as PlayerStatus,
        position: i,
        is_bot: Boolean(p.is_bot),
      }));
    } catch { return []; }
  }

  static async getPlayer(gameId: string, userId: string): Promise<GamePlayer | null> {
    try {
      const p = await dbGet('SELECT * FROM players WHERE game_id = ? AND user_id = ?', [gameId, userId]);
      if (!p) return null;
      return { ...p, balance: p.balance ?? 1000, current_bet: p.current_bet ?? 0,
        hand: this.parseHand(p.hand), status: (p.status ?? 'waiting') as PlayerStatus,
        is_bot: Boolean(p.is_bot) };
    } catch { return null; }
  }

  // ── Flujo del juego ───────────────────────────────────────────────────────

  static async createGame(channelId: string, creatorId: string): Promise<string> {
    const gameId = `bj_${Date.now()}`;
    await dbRun(
      'INSERT INTO games (game_id, channel_id, status, deck, creator_id) VALUES (?, ?, ?, ?, ?)',
      [gameId, channelId, 'waiting', JSON.stringify(this.generateDeck()), creatorId]
    );
    await this.addPlayer(gameId, creatorId);
    return gameId;
  }

  static async addPlayer(gameId: string, userId: string, isBot = false, username?: string): Promise<GamePlayer[]> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Partida no encontrada');
    if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');
    const players = await this.getPlayers(gameId);
    if (players.filter(p => !p.is_bot).length >= 4) throw new Error('La partida está llena (máx. 4 jugadores)');
    const playerId = isBot ? `bot-${Date.now()}` : userId;
    if (await this.getPlayer(gameId, playerId)) throw new Error('Ya estás en esta partida');
    await dbRun(
      'INSERT INTO players (user_id, game_id, username, balance, current_bet, hand, status, is_bot, position) VALUES (?, ?, ?, 1000, 0, ?, ?, ?, ?)',
      [playerId, gameId, isBot ? '🤖 BOT' : (username ?? null), JSON.stringify([]), 'waiting', isBot ? 1 : 0, players.length]
    );
    return this.getPlayers(gameId);
  }

  static async placeBet(gameId: string, userId: string, amount: number): Promise<void> {
    const player = await this.getPlayer(gameId, userId);
    if (!player) throw new Error('No estás en esta partida');
    const game = await this.getGame(gameId);
    if (!game || game.status !== 'waiting') throw new Error('Solo puedes apostar antes de iniciar');
    if (amount <= 0) throw new Error('La apuesta debe ser mayor a 0');
    if (amount > player.balance) throw new Error(`Saldo insuficiente. Tienes $${player.balance}`);
    await dbRun('UPDATE players SET current_bet = ? WHERE user_id = ? AND game_id = ?', [amount, userId, gameId]);
  }

  static async startGame(gameId: string): Promise<GameData> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error('Partida no encontrada');
    if (game.status !== 'waiting') throw new Error('La partida ya ha comenzado');

    let players = await this.getPlayers(gameId);
    if (!players.length) throw new Error('No hay jugadores');

    // Añadir bot si solo hay un jugador humano
    if (players.filter(p => !p.is_bot).length === 1 && !players.some(p => p.is_bot)) {
      await this.addPlayer(gameId, 'bot', true);
      players = await this.getPlayers(gameId);
    }

    // Apuesta mínima para quien no apostó
    for (const p of players) {
      if (p.current_bet === 0)
        await dbRun('UPDATE players SET current_bet = 100 WHERE user_id = ? AND game_id = ?', [p.user_id, gameId]);
    }

    // Repartir cartas
    const deck = this.generateDeck();
    const dealerHand: string[] = [];

    for (const p of players)
      await dbRun('UPDATE players SET hand = ?, status = ? WHERE user_id = ? AND game_id = ?',
        [JSON.stringify([]), 'playing', p.user_id, gameId]);

    for (let round = 0; round < 2; round++) {
      for (const p of players) {
        const card = deck.pop()!;
        const cur = await this.getPlayer(gameId, p.user_id);
        const hand = [...(cur?.hand ?? []), card];
        await dbRun('UPDATE players SET hand = ? WHERE user_id = ? AND game_id = ?',
          [JSON.stringify(hand), p.user_id, gameId]);
      }
      dealerHand.push(round === 0 ? '??' : deck.pop()!);
    }

    // Marcar blackjacks naturales
    for (const p of players) {
      const cur = await this.getPlayer(gameId, p.user_id);
      if (cur && this.calculateHandValue(cur.hand) === 21 && cur.hand.length === 2)
        await dbRun('UPDATE players SET status = ? WHERE user_id = ? AND game_id = ?',
          ['blackjack', p.user_id, gameId]);
    }

    await dbRun(
      'UPDATE games SET status = ?, deck = ?, dealer_hand = ?, current_player_index = 0 WHERE game_id = ?',
      ['in_progress', JSON.stringify(deck), JSON.stringify(dealerHand), gameId]
    );

    return (await this.getGame(gameId))!;
  }

  /** Pedir carta. Devuelve el estado actualizado. NO llama al bot ni al dealer. */
  static async hit(gameId: string, userId: string): Promise<GamePlayer> {
    const game = await this.getGame(gameId);
    if (!game || game.status !== 'in_progress') throw new Error('La partida no está en progreso');
    const player = await this.getPlayer(gameId, userId);
    if (!player || player.status !== 'playing') throw new Error('No es tu turno o ya terminaste');

    let deck = this.parseHand(game.deck);
    if (!deck.length) deck = this.generateDeck();
    const card = deck.pop()!;
    const newHand = [...player.hand, card];
    const val = this.calculateHandValue(newHand);

    let newStatus: PlayerStatus = 'playing';
    if (val > 21) newStatus = 'busted';
    else if (val === 21) newStatus = 'stood'; // auto-stand en 21

    await dbRun('UPDATE players SET hand = ?, status = ? WHERE user_id = ? AND game_id = ?',
      [JSON.stringify(newHand), newStatus, userId, gameId]);
    await dbRun('UPDATE games SET deck = ? WHERE game_id = ?', [JSON.stringify(deck), gameId]);
    await dbRun('INSERT INTO player_actions (game_id, user_id, action) VALUES (?, ?, ?)', [gameId, userId, 'hit']);

    return (await this.getPlayer(gameId, userId))!;
  }

  /** Plantarse. NO llama al bot ni al dealer. */
  static async stand(gameId: string, userId: string): Promise<void> {
    const player = await this.getPlayer(gameId, userId);
    if (!player || player.status !== 'playing') throw new Error('No es tu turno');
    await dbRun('UPDATE players SET status = ? WHERE user_id = ? AND game_id = ?', ['stood', userId, gameId]);
    await dbRun('INSERT INTO player_actions (game_id, user_id, action) VALUES (?, ?, ?)', [gameId, userId, 'stand']);
  }

  /** Doblar. NO llama al bot ni al dealer. */
  static async doubleDown(gameId: string, userId: string): Promise<GamePlayer> {
    const game = await this.getGame(gameId);
    if (!game || game.status !== 'in_progress') throw new Error('La partida no está en progreso');
    const player = await this.getPlayer(gameId, userId);
    if (!player || player.status !== 'playing') throw new Error('No es tu turno');
    if (player.hand.length !== 2) throw new Error('Solo puedes doblar con exactamente 2 cartas');
    if (player.balance < player.current_bet * 2) throw new Error('Saldo insuficiente para doblar');

    let deck = this.parseHand(game.deck);
    if (!deck.length) deck = this.generateDeck();
    const card = deck.pop()!;
    const newHand = [...player.hand, card];
    const val = this.calculateHandValue(newHand);
    const newStatus: PlayerStatus = val > 21 ? 'busted' : 'doubled';

    await dbRun('UPDATE players SET hand = ?, status = ?, current_bet = ? WHERE user_id = ? AND game_id = ?',
      [JSON.stringify(newHand), newStatus, player.current_bet * 2, userId, gameId]);
    await dbRun('UPDATE games SET deck = ? WHERE game_id = ?', [JSON.stringify(deck), gameId]);
    await dbRun('INSERT INTO player_actions (game_id, user_id, action) VALUES (?, ?, ?)', [gameId, userId, 'double']);

    return (await this.getPlayer(gameId, userId))!;
  }

  /** Rendirse. NO llama al bot ni al dealer. */
  static async surrender(gameId: string, userId: string): Promise<void> {
    const player = await this.getPlayer(gameId, userId);
    if (!player || player.status !== 'playing') throw new Error('No es tu turno');
    if (player.hand.length !== 2) throw new Error('Solo puedes rendirte con exactamente 2 cartas');
    const refund = Math.floor(player.current_bet / 2);
    await dbRun('UPDATE players SET status = ?, balance = balance + ?, current_bet = 0 WHERE user_id = ? AND game_id = ?',
      ['surrendered', refund, userId, gameId]);
    await dbRun('INSERT INTO player_actions (game_id, user_id, action) VALUES (?, ?, ?)', [gameId, userId, 'surrender']);
  }

  /**
   * Juega el turno del bot con estrategia básica.
   * Devuelve true si el bot terminó su turno (para que el handler sepa que puede continuar).
   */
  static async playBotTurn(gameId: string, botId: string): Promise<void> {
    let player = await this.getPlayer(gameId, botId);
    while (player && player.status === 'playing') {
      const val = this.calculateHandValue(player.hand);
      if (val <= 16) {
        player = await this.hit(gameId, botId);
      } else {
        await this.stand(gameId, botId);
        break;
      }
      await new Promise(r => setTimeout(r, 600)); // pequeña pausa visual
    }
  }

  /**
   * Turno del dealer. Devuelve los resultados finales.
   * Solo debe llamarse cuando TODOS los jugadores (humanos y bots) terminaron.
   */
  static async dealerPlay(gameId: string): Promise<GameResult[]> {
    await dbRun('UPDATE games SET status = ? WHERE game_id = ?', ['dealer_turn', gameId]);

    const game = await this.getGame(gameId);
    if (!game) return [];

    let deck = this.parseHand(game.deck);
    let dealerHand = this.parseHand(game.dealer_hand);

    // Revelar carta oculta
    if (dealerHand[0] === '??') {
      if (!deck.length) deck = this.generateDeck();
      dealerHand[0] = deck.pop()!;
      await dbRun('UPDATE games SET deck = ?, dealer_hand = ? WHERE game_id = ?',
        [JSON.stringify(deck), JSON.stringify(dealerHand), gameId]);
    }

    // Dealer pide hasta 17
    while (this.calculateHandValue(dealerHand) < 17) {
      if (!deck.length) deck = this.generateDeck();
      dealerHand.push(deck.pop()!);
      await dbRun('UPDATE games SET deck = ?, dealer_hand = ? WHERE game_id = ?',
        [JSON.stringify(deck), JSON.stringify(dealerHand), gameId]);
      await new Promise(r => setTimeout(r, 700));
    }

    await dbRun('UPDATE games SET status = ?, dealer_hand = ? WHERE game_id = ?',
      ['finished', JSON.stringify(dealerHand), gameId]);

    return this.calculateResults(gameId, dealerHand);
  }

  /** Calcula y guarda resultados. Solo llamar UNA vez al terminar. */
  static async calculateResults(gameId: string, dealerHand: string[]): Promise<GameResult[]> {
    const dealerValue = this.calculateHandValue(dealerHand);
    const dealerBJ = dealerHand.filter(c => c !== '??').length === 2 && dealerValue === 21;
    const players = await this.getPlayers(gameId);
    const results: GameResult[] = [];

    for (const player of players) {
      if (player.is_bot) continue;
      const pVal = this.calculateHandValue(player.hand);
      let result: GameResult['result'] = 'lose';
      let payout = 0;

      if (player.status === 'surrendered') {
        result = 'surrender'; payout = 0; // ya se devolvió la mitad
      } else if (player.status === 'busted') {
        result = 'bust'; payout = 0;
      } else if (player.status === 'blackjack') {
        if (dealerBJ) { result = 'push'; payout = player.current_bet; }
        else { result = 'blackjack'; payout = Math.floor(player.current_bet * 2.5); }
      } else if (dealerValue > 21) {
        result = 'win'; payout = player.current_bet * 2;
      } else if (pVal > dealerValue) {
        result = 'win'; payout = player.current_bet * 2;
      } else if (pVal === dealerValue) {
        result = 'push'; payout = player.current_bet;
      }

      const profit = payout - player.current_bet;
      const newBalance = player.balance - player.current_bet + payout;
      await dbRun('UPDATE players SET balance = ?, current_bet = 0 WHERE user_id = ? AND game_id = ?',
        [newBalance, player.user_id, gameId]);
      results.push({ userId: player.user_id, hand: player.hand, handValue: pVal, result, profit, newBalance });
    }

    return results;
  }

  // ── Embed y botones ───────────────────────────────────────────────────────

  static buildEmbed(game: GameData, players: GamePlayer[], results?: GameResult[]): EmbedBuilder {
    const dealerHand = this.parseHand(game.dealer_hand);
    const isDealerVisible = game.status === 'dealer_turn' || game.status === 'finished';
    const dealerValue = this.calculateHandValue(isDealerVisible ? dealerHand : dealerHand.slice(1));
    const color = COLORS[game.status as keyof typeof COLORS] ?? COLORS.waiting;

    const embed = new EmbedBuilder().setColor(color).setTitle('🎰 Blackjack').setTimestamp();

    // Dealer
    const dVal = isDealerVisible ? dealerValue : '?';
    const dExtra = isDealerVisible
      ? (dealerValue > 21 ? ' 💥 BUST' : dealerValue === 21 && dealerHand.length === 2 ? ' 🃏 BLACKJACK' : '')
      : '';
    embed.addFields({
      name: `🏦 Dealer — ${dVal}${dExtra}`,
      value: this.formatHand(dealerHand, !isDealerVisible),
      inline: false,
    });

    // Jugadores humanos
    const humanPlayers = players.filter(p => !p.is_bot);
    for (const p of humanPlayers) {
      const val = this.calculateHandValue(p.hand);
      const statusLabel: Record<string, string> = {
        waiting: '⏳ Esperando', playing: '🎲 Jugando', stood: '✋ Plantado',
        busted: '💥 Pasado', blackjack: '🃏 BLACKJACK', surrendered: '🏳️ Rendido',
        doubled: `⚡ Doblado`,
      };

      let resultLine = '';
      if (results) {
        const r = results.find(x => x.userId === p.user_id);
        if (r) {
          const icons: Record<string, string> = {
            blackjack: '🃏 BLACKJACK', win: '✅ Ganaste', push: '🤝 Empate',
            lose: '❌ Perdiste', bust: '💥 Te pasaste', surrender: '🏳️ Rendido',
          };
          const sign = r.profit >= 0 ? '+' : '';
          resultLine = `\n${icons[r.result] ?? r.result}  ${sign}$${r.profit}  →  Saldo: **$${r.newBalance}**`;
        }
      }

      embed.addFields({
        name: `👤 ${p.username}`,
        value: `${this.formatHand(p.hand)} **(${val})**\n${statusLabel[p.status] ?? p.status} | Apuesta: **$${p.current_bet}** | Saldo: **$${p.balance}**${resultLine}`,
        inline: humanPlayers.length > 1,
      });
    }

    const statusText: Record<string, string> = {
      waiting: '🔄 Esperando jugadores',
      in_progress: '🎲 Partida en curso',
      dealer_turn: '🏦 Turno del dealer...',
      finished: '🏁 Partida terminada',
    };
    embed.setFooter({ text: statusText[game.status] ?? game.status });
    return embed;
  }

  static buildButtons(game: GameData, players: GamePlayer[], currentUserId?: string): ActionRowBuilder<ButtonBuilder>[] {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];

    if (game.status === 'waiting') {
      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`bj_join_${game.game_id}`).setLabel('Unirse').setEmoji('🙋').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`bj_bet_${game.game_id}`).setLabel('Apostar').setEmoji('💰').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`bj_start_${game.game_id}`).setLabel('Iniciar').setEmoji('▶️').setStyle(ButtonStyle.Success),
      ));
      return rows;
    }

    if (game.status === 'in_progress') {
      const currentPlayer = players.find(p => p.status === 'playing' && !p.is_bot);
      const isMyTurn = !!currentUserId && currentPlayer?.user_id === currentUserId;
      const canDouble = isMyTurn && currentPlayer!.hand.length === 2 && currentPlayer!.balance >= currentPlayer!.current_bet * 2;
      const canSurrender = isMyTurn && currentPlayer!.hand.length === 2;

      rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`bj_hit_${game.game_id}`).setLabel('Pedir carta').setEmoji('🃏').setStyle(ButtonStyle.Primary).setDisabled(!isMyTurn),
        new ButtonBuilder().setCustomId(`bj_stand_${game.game_id}`).setLabel('Plantarse').setEmoji('✋').setStyle(ButtonStyle.Secondary).setDisabled(!isMyTurn),
        new ButtonBuilder().setCustomId(`bj_double_${game.game_id}`).setLabel('Doblar').setEmoji('⚡').setStyle(ButtonStyle.Success).setDisabled(!canDouble),
        new ButtonBuilder().setCustomId(`bj_surrender_${game.game_id}`).setLabel('Rendirse').setEmoji('🏳️').setStyle(ButtonStyle.Danger).setDisabled(!canSurrender),
      ));
    }

    return rows;
  }
}

export default BlackjackGame;
