import { Events, ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';
import { DominoGame } from '../sistemas/domino/gameLogic';
import { DominoDisplay } from '../sistemas/domino/dominoUtils';
import { BlackjackGame, GameData, GamePlayer, GameResult } from '../sistemas/blackjack/gameLogic';
import { slashCommands } from '../slash/index';
import { handleModalSubmit, buildBetModal } from '../modals/index';

// Previene que dos interacciones procesen la misma partida simultáneamente
const processing = new Set<string>();

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction: any) {
    // ── Slash Commands ───────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      const comando = slashCommands.get(interaction.commandName);
      if (!comando) return;
      try {
        await comando.ejecutar(interaction as ChatInputCommandInteraction);
      } catch (error: any) {
        console.error(`Error en /${interaction.commandName}:`, error);
        const msg = '❌ Ocurrió un error al ejecutar este comando.';
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
        else await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
      return;
    }

    // ── Modal Submissions ────────────────────────────────────────────────
    if (interaction.isModalSubmit()) {
      try {
        await handleModalSubmit(interaction as ModalSubmitInteraction);
      } catch (error: any) {
        console.error('Error en modal submit:', error);
        const msg = `❌ ${error.message}`;
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
        else await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
      }
      return;
    }

    if (!interaction.isButton() && !interaction.isStringSelectMenu()) return;
    const { customId } = interaction;
    if (customId.startsWith('bj_'))                                    { await handleBlackjack(interaction); return; }
    if (customId.startsWith('dom_') || customId.startsWith('domino_')) { await handleDomino(interaction);    return; }
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
//  BLACKJACK
// ═══════════════════════════════════════════════════════════════════════════════

async function updateBJMessage(interaction: any, game: GameData, players: GamePlayer[], content: string, results?: GameResult[]): Promise<void> {
  const embed     = BlackjackGame.buildEmbed(game, players, results);
  const nextHuman = players.find(p => p.status === 'playing' && !p.is_bot);
  const rows      = BlackjackGame.buildButtons(game, players, nextHuman?.user_id);
  await interaction.editReply({ content, embeds: [embed], components: rows });
}

async function advanceBJGame(interaction: any, gameId: string): Promise<GameResult[] | null> {
  let players = await BlackjackGame.getPlayers(gameId);
  let game    = await BlackjackGame.getGame(gameId);
  if (!game) return null;

  while (true) {
    const bot = players.find(p => p.is_bot && p.status === 'playing');
    if (!bot) break;
    await updateBJMessage(interaction, game!, players, `🤖 **${bot.username}** está pensando...`);
    await new Promise(r => setTimeout(r, 1000));
    await BlackjackGame.playBotTurn(gameId, bot.user_id);
    players = await BlackjackGame.getPlayers(gameId);
    game    = await BlackjackGame.getGame(gameId);
    if (!game) return null;
    await updateBJMessage(interaction, game, players, `🤖 **${bot.username}** jugó su turno.`);
    await new Promise(r => setTimeout(r, 800));
  }

  if (players.some(p => p.status === 'playing')) return null;

  await updateBJMessage(interaction, game!, players, '🏦 **Turno del dealer...**');
  await new Promise(r => setTimeout(r, 800));
  const results = await BlackjackGame.dealerPlay(gameId);
  game    = await BlackjackGame.getGame(gameId);
  players = await BlackjackGame.getPlayers(gameId);
  return results;
}

async function handleBlackjack(interaction: any): Promise<void> {
  const { customId, user } = interaction;
  const parts  = customId.split('_');
  const action = parts[1];
  const gameId = parts.slice(2).join('_');

  if (['hit','stand','double','surrender','start'].includes(action)) {
    if (processing.has(gameId))
      return interaction.reply({ content: '⏳ Espera a que termine la acción anterior.', ephemeral: true });
    processing.add(gameId);
  }

  try {
    if (action === 'join') {
      if (await BlackjackGame.getPlayer(gameId, user.id))
        return interaction.reply({ content: '❌ Ya estás en esta partida.', ephemeral: true });
      const game = await BlackjackGame.getGame(gameId);
      if (!game || game.status !== 'waiting')
        return interaction.reply({ content: '❌ La partida ya comenzó o no existe.', ephemeral: true });
      const players = await BlackjackGame.getPlayers(gameId);
      if (players.filter(p => !p.is_bot).length >= 4)
        return interaction.reply({ content: '❌ La partida está llena.', ephemeral: true });
      await BlackjackGame.addPlayer(gameId, user.id, false, user.username);
      const ug = await BlackjackGame.getGame(gameId);
      const up = await BlackjackGame.getPlayers(gameId);
      const embed = BlackjackGame.buildEmbed(ug!, up);
      embed.setDescription(`🎰 **Partida de Blackjack**\n\n${up.filter(p => !p.is_bot).map(p => `👤 ${p.username} — Apuesta: **$${p.current_bet}**`).join('\n')}`);
      await interaction.update({ embeds: [embed], components: BlackjackGame.buildButtons(ug!, up) });
      await interaction.followUp({ content: `✅ **${user.username}** se unió.`, ephemeral: true });
      return;
    }

    if (action === 'bet') {
      const player = await BlackjackGame.getPlayer(gameId, user.id);
      if (!player) return interaction.reply({ content: '❌ No estás en esta partida.', ephemeral: true });
      await interaction.showModal(buildBetModal(gameId, player.balance));
      return;
    }

    if (action === 'start') {
      const game = await BlackjackGame.getGame(gameId);
      if (!game) return interaction.reply({ content: '❌ Partida no encontrada.', ephemeral: true });
      if (game.creator_id !== user.id) return interaction.reply({ content: '❌ Solo el creador puede iniciar.', ephemeral: true });
      await interaction.deferUpdate();
      await BlackjackGame.startGame(gameId);
      const ug = await BlackjackGame.getGame(gameId);
      const up = await BlackjackGame.getPlayers(gameId);
      const results = await advanceBJGame(interaction, gameId);
      if (results) {
        const fg = await BlackjackGame.getGame(gameId);
        const fp = await BlackjackGame.getPlayers(gameId);
        await updateBJMessage(interaction, fg!, fp, '🏁 **¡Partida terminada!**', results);
      } else {
        const cp = up.find(p => p.status === 'playing' && !p.is_bot);
        await updateBJMessage(interaction, ug!, up, cp ? `🎲 Turno de <@${cp.user_id}>` : '🎲 **¡La partida comenzó!**');
      }
      return;
    }

    // Acciones de juego
    const player = await BlackjackGame.getPlayer(gameId, user.id);
    if (!player) return interaction.reply({ content: '❌ No estás en esta partida.', ephemeral: true });
    if (player.status !== 'playing') return interaction.reply({ content: '❌ Ya terminaste tu turno.', ephemeral: true });
    const game = await BlackjackGame.getGame(gameId);
    if (!game || game.status !== 'in_progress') return interaction.reply({ content: '❌ La partida no está en progreso.', ephemeral: true });
    const allP   = await BlackjackGame.getPlayers(gameId);
    const first  = allP.find(p => p.status === 'playing' && !p.is_bot);
    if (first?.user_id !== user.id) return interaction.reply({ content: '❌ Aún no es tu turno.', ephemeral: true });

    await interaction.deferUpdate();

    if (action === 'hit')       await BlackjackGame.hit(gameId, user.id);
    else if (action === 'stand')    await BlackjackGame.stand(gameId, user.id);
    else if (action === 'double')   await BlackjackGame.doubleDown(gameId, user.id);
    else if (action === 'surrender') await BlackjackGame.surrender(gameId, user.id);

    let cg = await BlackjackGame.getGame(gameId);
    let cp = await BlackjackGame.getPlayers(gameId);
    const self = cp.find(p => p.user_id === user.id);
    const statusMsg: Record<string, string> = {
      busted: `💥 <@${user.id}> se pasó de 21.`, blackjack: `🃏 <@${user.id}> tiene BLACKJACK!`,
      stood: `✋ <@${user.id}> se plantó.`, doubled: `⚡ <@${user.id}> dobló su apuesta.`,
      surrendered: `🏳️ <@${user.id}> se rindió.`,
    };
    await updateBJMessage(interaction, cg!, cp, statusMsg[self?.status ?? ''] ?? `🃏 <@${user.id}> pidió carta.`);
    await new Promise(r => setTimeout(r, 600));

    const results = await advanceBJGame(interaction, gameId);
    if (results) {
      const fg = await BlackjackGame.getGame(gameId);
      const fp = await BlackjackGame.getPlayers(gameId);
      await updateBJMessage(interaction, fg!, fp, '🏁 **¡Partida terminada!**', results);
    } else {
      cg = await BlackjackGame.getGame(gameId);
      cp = await BlackjackGame.getPlayers(gameId);
      const next = cp.find(p => p.status === 'playing' && !p.is_bot);
      if (next) await updateBJMessage(interaction, cg!, cp, `🎲 Turno de <@${next.user_id}>`);
    }

  } catch (error: any) {
    console.error('Error en interacción blackjack:', error);
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp({ content: `❌ ${error.message}`, ephemeral: true });
      else await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    } catch { /* ignorar */ }
  } finally {
    processing.delete(gameId);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  DOMINÓ
// ═══════════════════════════════════════════════════════════════════════════════
//  DOMINÓ
// ═══════════════════════════════════════════════════════════════════════════════

/** Helper: construye embed + componentes actualizados para el estado actual */
async function buildDominoReply(gameId: string, viewerUserId: string, extraMsg?: string) {
  const game    = await DominoGame.getGame(gameId);
  const players = await DominoGame.getPlayers(gameId);
  const current = await DominoGame.getCurrentPlayer(gameId);
  const viewer  = players.find(p => p.user_id === viewerUserId);
  const isMyTurn = current?.user_id === viewerUserId;
  const canPass  = isMyTurn ? !(await DominoGame.canCurrentPlayerPlay(gameId)) : false;

  const playableTiles = isMyTurn && viewer
    ? DominoDisplay.getPlayableTiles(viewer.tiles, game!.left_end, game!.right_end)
    : [];

  const embed      = DominoDisplay.buildGameEmbed(game!, players, viewerUserId, extraMsg);
  const components = game!.status === 'finished'
    ? []
    : DominoDisplay.buildGameComponents(gameId, isMyTurn, canPass, playableTiles);

  const content = game!.status === 'finished'
    ? '🏁 **¡Partida terminada!**'
    : current?.is_bot
      ? `🤖 **${current.username}** está pensando...`
      : isMyTurn
        ? `🎴 **¡Es tu turno!** <@${viewerUserId}>`
        : `🎴 Turno de <@${current?.user_id}>`;

  return { embed, components, content };
}

async function handleDomino(interaction: any): Promise<void> {
  const { customId, user } = interaction;

  // Normalizar prefijo legacy
  const normalized = customId.replace(/^domino_/, 'dom_');
  const parts  = normalized.split('_');
  const action = parts[1];
  const gameId = parts.slice(2).join('_');

  // Anti-spam para acciones que modifican estado
  if (['start', 'pass', 'select'].includes(action)) {
    if (processing.has(`dom_${gameId}`))
      return interaction.reply({ content: '⏳ Espera a que termine la acción anterior.', ephemeral: true });
    processing.add(`dom_${gameId}`);
  }

  try {
    // ── Unirse ────────────────────────────────────────────────────────────
    if (action === 'join') {
      const game = await DominoGame.getGame(gameId);
      if (!game || game.status !== 'waiting')
        return interaction.reply({ content: '❌ La partida ya comenzó o no existe.', ephemeral: true });
      const players = await DominoGame.getPlayers(gameId);
      if (players.some(p => p.user_id === user.id))
        return interaction.reply({ content: '❌ Ya estás en esta partida.', ephemeral: true });
      if (players.length >= 4)
        return interaction.reply({ content: '❌ La partida está llena.', ephemeral: true });

      await DominoGame.addPlayer(gameId, user.id, user.username);
      const ug = await DominoGame.getGame(gameId);
      const up = await DominoGame.getPlayers(gameId);
      const embed = DominoDisplay.buildGameEmbed(ug!, up);
      embed.setDescription(`✅ **${user.username}** se unió. (${up.length}/4 jugadores)`);
      await interaction.update({ embeds: [embed], components: [DominoDisplay.buildWaitingButtons(gameId)] });
      await interaction.followUp({ content: '✅ Te uniste a la partida.', ephemeral: true });
      return;
    }

    // ── Iniciar ───────────────────────────────────────────────────────────
    if (action === 'start') {
      const game = await DominoGame.getGame(gameId);
      if (!game) return interaction.reply({ content: '❌ Partida no encontrada.', ephemeral: true });
      if (game.creator_id !== user.id)
        return interaction.reply({ content: '❌ Solo el creador puede iniciar.', ephemeral: true });

      await interaction.deferUpdate();
      await DominoGame.startGame(gameId);

      const { embed, components, content } = await buildDominoReply(gameId, user.id);
      await interaction.editReply({ content, embeds: [embed], components });

      const current = await DominoGame.getCurrentPlayer(gameId);
      if (current?.is_bot) {
        await new Promise(r => setTimeout(r, 1500));
        await playDominoBotChain(gameId, current.user_id, interaction, user.id);
      }
      return;
    }

    // ── Ver fichas (ephemeral) ────────────────────────────────────────────
    if (action === 'hand') {
      const game   = await DominoGame.getGame(gameId);
      const player = await DominoGame.getPlayer(gameId, user.id);
      if (!player) return interaction.reply({ content: '❌ No estás en esta partida.', ephemeral: true });

      const handText = DominoDisplay.formatHand(player.tiles, game?.left_end ?? -1, game?.right_end ?? -1);
      const current  = await DominoGame.getCurrentPlayer(gameId);
      const isMyTurn = current?.user_id === user.id;

      return interaction.reply({
        embeds: [{
          title: `🃏 Tus fichas (${player.tiles.length})`,
          description: handText || '*Sin fichas*',
          color: isMyTurn ? 0x2ecc71 : 0x95a5a6,
          fields: [
            { name: '✅ Jugable', value: '← → indica el lado válido', inline: true },
            { name: '↔ Ambos lados', value: 'Puedes elegir al jugar', inline: true },
          ],
          footer: { text: isMyTurn ? '¡Es tu turno! Usa el menú desplegable para jugar.' : 'Espera tu turno.' },
        }],
        ephemeral: true,
      });
    }

    // ── Selección de ficha (select menu) ──────────────────────────────────
    if (action === 'select' && parts[2] === 'tile') {
      if (!interaction.isStringSelectMenu()) return;

      const game = await DominoGame.getGame(gameId);
      if (!game || game.status !== 'in_progress')
        return interaction.reply({ content: '❌ La partida no está en progreso.', ephemeral: true });

      const current = await DominoGame.getCurrentPlayer(gameId);
      if (current?.user_id !== user.id)
        return interaction.reply({ content: '❌ No es tu turno.', ephemeral: true });

      const [indexStr, preferredSide] = interaction.values[0].split(':');
      const tileIndex = parseInt(indexStr);
      const player    = await DominoGame.getPlayer(gameId, user.id);
      if (!player) return interaction.reply({ content: '❌ No estás en esta partida.', ephemeral: true });

      const tile  = player.tiles[tileIndex];
      const sides = DominoGame.getValidSides(tile, game.left_end, game.right_end);

      // Si la ficha puede ir en ambos lados → mostrar segundo select para elegir lado
      if (sides.length === 2) {
        await interaction.reply({
          content: `🎴 Elegiste \`${DominoDisplay.tileText(tile)}\` — ¿En qué extremo la colocas?`,
          components: [DominoDisplay.buildSideSelectMenu(gameId, tileIndex, tile, game.left_end, game.right_end)],
          ephemeral: true,
        });
        return;
      }

      // Solo un lado válido → jugar directamente
      await interaction.deferUpdate();
      const side = sides[0];
      const { game: ug, winner } = await DominoGame.playTile(gameId, user.id, tileIndex, side);
      const up = await DominoGame.getPlayers(gameId);

      if (winner) {
        const embed = DominoDisplay.buildGameEmbed(ug, up, user.id,
          `🏆 **¡${winner.is_bot ? winner.username : `<@${winner.user_id}>`} ganó la partida!**`);
        await interaction.editReply({ content: '🏁 **¡Partida terminada!**', embeds: [embed], components: [] });
        return;
      }

      const { embed, components, content } = await buildDominoReply(gameId, user.id,
        `✅ <@${user.id}> jugó \`${DominoDisplay.tileText(tile)}\` al ${side === 'left' ? 'lado izquierdo ←' : 'lado derecho →'}`);
      await interaction.editReply({ content, embeds: [embed], components });

      const next = await DominoGame.getCurrentPlayer(gameId);
      if (next?.is_bot) {
        await new Promise(r => setTimeout(r, 1500));
        await playDominoBotChain(gameId, next.user_id, interaction, user.id);
      }
      return;
    }

    // ── Selección de lado (segundo select menu) ───────────────────────────
    if (action === 'select' && parts[2] === 'side') {
      if (!interaction.isStringSelectMenu()) return;

      const game = await DominoGame.getGame(gameId);
      if (!game || game.status !== 'in_progress')
        return interaction.reply({ content: '❌ La partida no está en progreso.', ephemeral: true });

      const current = await DominoGame.getCurrentPlayer(gameId);
      if (current?.user_id !== user.id)
        return interaction.reply({ content: '❌ No es tu turno.', ephemeral: true });

      const [indexStr, side] = interaction.values[0].split(':') as [string, 'left'|'right'];
      const tileIndex = parseInt(indexStr);
      const player    = await DominoGame.getPlayer(gameId, user.id);
      if (!player) return interaction.reply({ content: '❌ No estás en esta partida.', ephemeral: true });

      const tile = player.tiles[tileIndex];

      // Actualizar el mensaje ephemeral del select de lado
      await interaction.update({ content: `⏳ Jugando \`${DominoDisplay.tileText(tile)}\`...`, components: [] });

      const { game: ug, winner } = await DominoGame.playTile(gameId, user.id, tileIndex, side);
      const up = await DominoGame.getPlayers(gameId);

      // Actualizar el mensaje principal del juego
      if (winner) {
        const embed = DominoDisplay.buildGameEmbed(ug, up, user.id,
          `🏆 **¡${winner.is_bot ? winner.username : `<@${winner.user_id}>`} ganó la partida!**`);
        await interaction.followUp({ content: '🏁 **¡Partida terminada!**', embeds: [embed], components: [] });
        return;
      }

      const { embed, components, content } = await buildDominoReply(gameId, user.id,
        `✅ <@${user.id}> jugó \`${DominoDisplay.tileText(tile)}\` al ${side === 'left' ? 'lado izquierdo ←' : 'lado derecho →'}`);
      await interaction.followUp({ content, embeds: [embed], components });

      const next = await DominoGame.getCurrentPlayer(gameId);
      if (next?.is_bot) {
        await new Promise(r => setTimeout(r, 1500));
        await playDominoBotChain(gameId, next.user_id, interaction, user.id);
      }
      return;
    }

    // ── Pasar turno ───────────────────────────────────────────────────────
    if (action === 'pass') {
      const game = await DominoGame.getGame(gameId);
      if (!game || game.status !== 'in_progress')
        return interaction.reply({ content: '❌ La partida no está en progreso.', ephemeral: true });
      const current = await DominoGame.getCurrentPlayer(gameId);
      if (current?.user_id !== user.id)
        return interaction.reply({ content: '❌ No es tu turno.', ephemeral: true });

      await interaction.deferUpdate();
      const { blocked } = await DominoGame.passTurn(gameId, user.id);
      const ug = await DominoGame.getGame(gameId);
      const up = await DominoGame.getPlayers(gameId);

      if (blocked) {
        const { winner, scores } = await DominoGame.getWinnerByPoints(gameId);
        const scoreText = scores.map(s =>
          `${s.player.is_bot ? s.player.username : `<@${s.player.user_id}>`}: **${s.points}** pts`
        ).join('\n');
        const embed = DominoDisplay.buildGameEmbed(ug!, up, user.id,
          `🔒 **¡Juego bloqueado!**\n🏆 Gana **${winner.is_bot ? winner.username : `<@${winner.user_id}>`}**\n\n${scoreText}`);
        await interaction.editReply({ content: '🔒 **¡Juego bloqueado!**', embeds: [embed], components: [] });
        return;
      }

      const { embed, components, content } = await buildDominoReply(gameId, user.id,
        `⏭️ <@${user.id}> pasó su turno.`);
      await interaction.editReply({ content, embeds: [embed], components });

      const next = await DominoGame.getCurrentPlayer(gameId);
      if (next?.is_bot) {
        await new Promise(r => setTimeout(r, 1500));
        await playDominoBotChain(gameId, next.user_id, interaction, user.id);
      }
      return;
    }

  } catch (error: any) {
    console.error('Error en interacción dominó:', error);
    try {
      if (interaction.replied || interaction.deferred) await interaction.followUp({ content: `❌ ${error.message}`, ephemeral: true });
      else await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    } catch { /* ignorar */ }
  } finally {
    processing.delete(`dom_${gameId}`);
  }
}

async function playDominoBotChain(gameId: string, _botId: string, interaction: any, viewerUserId: string): Promise<void> {
  try {
    while (true) {
      const game    = await DominoGame.getGame(gameId);
      const current = await DominoGame.getCurrentPlayer(gameId);
      if (!game || game.status !== 'in_progress' || !current?.is_bot) break;

      const result = await DominoGame.playBotTurn(gameId, current.user_id);
      const ug     = await DominoGame.getGame(gameId);
      const up     = await DominoGame.getPlayers(gameId);

      if (ug?.status === 'finished') {
        const { winner, scores } = await DominoGame.getWinnerByPoints(gameId);
        const botPlayer  = up.find(p => p.user_id === current.user_id)!;
        const winnerName = botPlayer.tiles.length === 0
          ? `🤖 ${botPlayer.username}`
          : (winner.is_bot ? `🤖 ${winner.username}` : `<@${winner.user_id}>`);
        const embed = DominoDisplay.buildGameEmbed(ug, up, viewerUserId, `🏆 **¡${winnerName} ganó!**`);
        await interaction.editReply({ content: '🏁 **¡Partida terminada!**', embeds: [embed], components: [] });
        return;
      }

      const actionText = result.action === 'pass'
        ? `🤖 **${current.username}** no pudo jugar y pasó.`
        : `🤖 **${current.username}** jugó \`${DominoDisplay.tileText(result.tile!)}\``;

      const { embed, components, content } = await buildDominoReply(gameId, viewerUserId, actionText);
      await interaction.editReply({ content, embeds: [embed], components });

      if (!( await DominoGame.getCurrentPlayer(gameId))?.is_bot) break;
      await new Promise(r => setTimeout(r, 1200));
    }
  } catch (error) {
    console.error('Error en turno del bot (dominó):', error);
  }
}
