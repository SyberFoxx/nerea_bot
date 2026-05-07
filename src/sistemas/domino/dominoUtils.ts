import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { DominoGame, DominoGameData, DominoPlayer, DominoTile, BoardTile } from './gameLogic';

// ─── Constantes visuales ──────────────────────────────────────────────────────
const DOTS_EMOJI = ['0️⃣','1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣'];
const DOTS_BLOCK = ['⬜','🟫','🟫','🟫','🟫','🟫','🟫']; // para el tablero visual

export class DominoDisplay {

  // ── Formato de fichas ─────────────────────────────────────────────────────

  /** Ficha como texto: [3|5] */
  static tileText(tile: DominoTile): string {
    return `[${tile.left}|${tile.right}]`;
  }

  /** Ficha con emojis de puntos: 3️⃣|5️⃣ */
  static tileEmoji(tile: DominoTile): string {
    return `${DOTS_EMOJI[tile.left]}│${DOTS_EMOJI[tile.right]}`;
  }

  /** Tablero visual compacto */
  static formatBoard(board: BoardTile[], leftEnd: number, rightEnd: number): string {
    if (board.length === 0) return '*Tablero vacío — juega la primera ficha*';

    const tiles = board.map(t => `\`[${t.left}|${t.right}]\``);

    if (board.length <= 7) return tiles.join(' ─ ');

    // Tablero largo: mostrar extremos + resumen
    const left3  = tiles.slice(0, 3).join(' ─ ');
    const right3 = tiles.slice(-3).join(' ─ ');
    return `${left3} ─ **(${board.length - 6} más)** ─ ${right3}`;
  }

  /** Mano del jugador con indicador de jugabilidad */
  static formatHand(tiles: DominoTile[], leftEnd: number, rightEnd: number): string {
    if (!tiles.length) return '*Sin fichas*';
    return tiles.map((t, i) => {
      const playable = DominoGame.canPlay(t, leftEnd, rightEnd);
      const sides    = DominoGame.getValidSides(t, leftEnd, rightEnd);
      const sideHint = sides.length === 2 ? ' ↔' : sides[0] === 'left' ? ' ←' : sides[0] === 'right' ? ' →' : '';
      return `${playable ? '✅' : '❌'} **${i + 1}.** \`${this.tileText(t)}\`${playable ? sideHint : ''}`;
    }).join('\n');
  }

  // ── Embed principal ───────────────────────────────────────────────────────

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

    // Estado y turno en la misma línea
    const statusText: Record<string, string> = {
      waiting:     '🟡 Esperando jugadores',
      in_progress: '🟢 En curso',
      finished:    '🔴 Terminada',
    };
    embed.addFields({ name: 'Estado', value: statusText[game.status] ?? game.status, inline: true });

    if (current) {
      embed.addFields({
        name: 'Turno',
        value: current.is_bot ? `🤖 ${current.username}` : `<@${current.user_id}>`,
        inline: true,
      });
    }

    // Extremos del tablero
    if (game.left_end !== -1) {
      embed.addFields({
        name: 'Extremos',
        value: `\`${game.left_end}\` ◀─────▶ \`${game.right_end}\``,
        inline: true,
      });
    }

    // Tablero
    embed.addFields({
      name: `🎴 Tablero — ${board.length} ficha${board.length !== 1 ? 's' : ''}`,
      value: this.formatBoard(board, game.left_end, game.right_end),
      inline: false,
    });

    // Jugadores con conteo de fichas
    const playerList = players.map(p => {
      const isCurrent = current?.user_id === p.user_id;
      const name      = p.is_bot ? `🤖 ${p.username}` : `<@${p.user_id}>`;
      const tileBar   = '▪'.repeat(Math.min(p.tiles.length, 7)) + (p.tiles.length > 7 ? `+${p.tiles.length - 7}` : '');
      return `${isCurrent ? '▶️ ' : '　'}${name} — **${p.tiles.length}** \`${tileBar}\``;
    }).join('\n');
    embed.addFields({ name: '👥 Jugadores', value: playerList || 'Ninguno', inline: false });

    // Fichas del viewer (solo si es su turno o lo pide)
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

    if (extraMessage) {
      embed.addFields({ name: '📢', value: extraMessage, inline: false });
    }

    embed.setFooter({ text: `ID: ${game.game_id}` });
    return embed;
  }

  // ── Componentes (botones + select menus) ──────────────────────────────────

  /** Botones de la sala de espera */
  static buildWaitingButtons(gameId: string): ActionRowBuilder<ButtonBuilder> {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`dom_join_${gameId}`)
        .setLabel('Unirse')
        .setEmoji('🙋')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`dom_start_${gameId}`)
        .setLabel('Iniciar')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Success),
    );
  }

  /**
   * Componentes durante el juego.
   * Si es el turno del viewer y tiene fichas jugables → muestra select menu de fichas.
   * Si no puede jugar → solo botón Pasar.
   * Si no es su turno → botones deshabilitados + "Ver fichas".
   */
  static buildGameComponents(
    gameId: string,
    isMyTurn: boolean,
    canPass: boolean,
    playableTiles: { tile: DominoTile; index: number; sides: ('left'|'right')[] }[]
  ): ActionRowBuilder<any>[] {
    const rows: ActionRowBuilder<any>[] = [];

    if (isMyTurn && playableTiles.length > 0) {
      // Select menu con las fichas jugables
      const select = new StringSelectMenuBuilder()
        .setCustomId(`dom_select_tile_${gameId}`)
        .setPlaceholder('🎴 Elige una ficha para jugar...')
        .setMinValues(1)
        .setMaxValues(1);

      for (const { tile, index, sides } of playableTiles) {
        const sideLabel = sides.length === 2
          ? 'Ambos lados'
          : sides[0] === 'left' ? 'Lado izquierdo ←' : 'Lado derecho →';

        select.addOptions(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${this.tileText(tile)}`)
            .setDescription(`Ficha ${index + 1} — ${sideLabel}`)
            .setValue(`${index}:${sides[0]}`) // valor: "índice:lado_preferido"
            .setEmoji(DOTS_EMOJI[tile.left])
        );
      }

      rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select));
    }

    // Fila de botones de acción
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`dom_pass_${gameId}`)
        .setLabel('Pasar turno')
        .setEmoji('⏭️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!isMyTurn || !canPass),
      new ButtonBuilder()
        .setCustomId(`dom_hand_${gameId}`)
        .setLabel('Ver mis fichas')
        .setEmoji('🃏')
        .setStyle(ButtonStyle.Secondary),
    );

    // Si no es su turno, agregar botón informativo
    if (!isMyTurn) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId('dom_waiting')
          .setLabel('Esperando tu turno...')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
    }

    rows.push(actionRow);
    return rows;
  }

  /**
   * Select menu para elegir el lado cuando una ficha puede ir en ambos extremos.
   */
  static buildSideSelectMenu(gameId: string, tileIndex: number, tile: DominoTile, leftEnd: number, rightEnd: number): ActionRowBuilder<StringSelectMenuBuilder> {
    const select = new StringSelectMenuBuilder()
      .setCustomId(`dom_select_side_${gameId}`)
      .setPlaceholder('¿En qué extremo quieres colocar la ficha?')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`Izquierda ← (conecta con ${leftEnd})`)
          .setDescription(`Coloca \`${this.tileText(tile)}\` en el extremo izquierdo`)
          .setValue(`${tileIndex}:left`)
          .setEmoji('⬅️'),
        new StringSelectMenuOptionBuilder()
          .setLabel(`Derecha → (conecta con ${rightEnd})`)
          .setDescription(`Coloca \`${this.tileText(tile)}\` en el extremo derecho`)
          .setValue(`${tileIndex}:right`)
          .setEmoji('➡️'),
      );

    return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
  }

  // ── Helper para obtener fichas jugables con sus lados ─────────────────────

  static getPlayableTiles(
    tiles: DominoTile[],
    leftEnd: number,
    rightEnd: number
  ): { tile: DominoTile; index: number; sides: ('left'|'right')[] }[] {
    return tiles
      .map((tile, index) => ({
        tile,
        index,
        sides: DominoGame.getValidSides(tile, leftEnd, rightEnd),
      }))
      .filter(({ sides }) => sides.length > 0);
  }
}

export default DominoDisplay;
