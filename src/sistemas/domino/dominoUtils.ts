import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { DominoGame, DominoGameData, DominoPlayer, DominoTile, BoardTile } from './gameLogic';

// Emojis de fichas de dominó (doble fila de puntos)
const DOTS = ['⚪','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];

export class DominoDisplay {

  static formatTile(tile: DominoTile, index?: number): string {
    const label = index !== undefined ? `${index + 1}.` : '';
    return `${label}\`[${tile.left}|${tile.right}]\``;
  }

  static formatBoard(board: BoardTile[], leftEnd: number, rightEnd: number): string {
    if (board.length === 0) return '*Tablero vacío — juega la primera ficha*';
    // Mostrar solo los extremos si el tablero es largo
    if (board.length <= 6) {
      return board.map(t => `\`[${t.left}|${t.right}]\``).join('—');
    }
    const left3  = board.slice(0, 3).map(t => `\`[${t.left}|${t.right}]\``).join('—');
    const right3 = board.slice(-3).map(t => `\`[${t.left}|${t.right}]\``).join('—');
    return `${left3} — *(${board.length - 6} más)* — ${right3}`;
  }

  static formatHand(tiles: DominoTile[], leftEnd: number, rightEnd: number): string {
    if (!tiles.length) return '*Sin fichas*';
    return tiles.map((t, i) => {
      const playable = DominoGame.canPlay(t, leftEnd, rightEnd);
      const mark = playable ? '✅' : '❌';
      return `${mark} ${i + 1}. \`[${t.left}|${t.right}]\``;
    }).join('  ');
  }

  static buildGameEmbed(
    game: DominoGameData,
    players: DominoPlayer[],
    viewerUserId?: string,
    extraMessage?: string
  ): EmbedBuilder {
    const board    = DominoGame.parseBoard(game.board);
    const isActive = game.status === 'in_progress';
    const current  = isActive ? players[game.current_pos] : null;

    const colorMap: Record<string, number> = {
      waiting:     0x3498db,
      in_progress: 0x2ecc71,
      finished:    0xe74c3c,
    };

    const embed = new EmbedBuilder()
      .setColor(colorMap[game.status] ?? 0x95a5a6)
      .setTitle('🁣 Dominó')
      .setTimestamp();

    // Estado y turno
    const statusText: Record<string, string> = {
      waiting:     '🟡 Esperando jugadores',
      in_progress: '🟢 En curso',
      finished:    '🔴 Terminada',
    };
    embed.addFields({ name: 'Estado', value: statusText[game.status] ?? game.status, inline: true });

    if (current) {
      embed.addFields({ name: 'Turno', value: current.is_bot ? `🤖 ${current.username}` : `<@${current.user_id}>`, inline: true });
    }

    // Tablero
    embed.addFields({
      name: `🎴 Tablero (${board.length} fichas) — Extremos: \`${game.left_end === -1 ? '?' : game.left_end}\` ↔ \`${game.right_end === -1 ? '?' : game.right_end}\``,
      value: this.formatBoard(board, game.left_end, game.right_end),
      inline: false,
    });

    // Jugadores y conteo de fichas
    const playerList = players.map(p => {
      const isCurrent = current?.user_id === p.user_id;
      const name = p.is_bot ? `🤖 ${p.username}` : `<@${p.user_id}>`;
      return `${isCurrent ? '▶️ ' : ''}${name} — **${p.tiles.length}** fichas`;
    }).join('\n');
    embed.addFields({ name: '👥 Jugadores', value: playerList || 'Ninguno', inline: false });

    // Mano del viewer (solo si está en la partida y la partida está activa)
    if (viewerUserId && isActive) {
      const viewer = players.find(p => p.user_id === viewerUserId);
      if (viewer && !viewer.is_bot) {
        embed.addFields({
          name: `🃏 Tus fichas (${viewer.tiles.length})`,
          value: this.formatHand(viewer.tiles, game.left_end, game.right_end) || '*Sin fichas*',
          inline: false,
        });
      }
    }

    if (extraMessage) embed.addFields({ name: '📢', value: extraMessage, inline: false });

    embed.setFooter({ text: `ID: ${game.game_id}` });
    return embed;
  }

  static buildWaitingButtons(gameId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`dom_join_${gameId}`).setLabel('Unirse').setEmoji('🙋').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`dom_start_${gameId}`).setLabel('Iniciar').setEmoji('▶️').setStyle(ButtonStyle.Success),
    );
  }

  static buildGameButtons(gameId: string, isMyTurn: boolean, canPass: boolean): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`dom_play_${gameId}`).setLabel('Jugar ficha').setEmoji('🎴').setStyle(ButtonStyle.Primary).setDisabled(!isMyTurn),
      new ButtonBuilder().setCustomId(`dom_pass_${gameId}`).setLabel('Pasar').setEmoji('⏭️').setStyle(ButtonStyle.Secondary).setDisabled(!isMyTurn || !canPass),
      new ButtonBuilder().setCustomId(`dom_hand_${gameId}`).setLabel('Ver mis fichas').setEmoji('🃏').setStyle(ButtonStyle.Secondary),
    );
  }
}

export default DominoDisplay;
