import { Comando } from '../../types';
import { DominoGame } from '../../sistemas/domino/gameLogic';
import { DominoDisplay } from '../../sistemas/domino/dominoUtils';
import { dbRun } from '../../sistemas/domino/db';

// ─── Helper: construye embed + componentes para el estado actual ──────────────
async function buildReply(gameId: string, viewerUserId: string, extraMsg?: string) {
  const game    = await DominoGame.getGame(gameId);
  const players = await DominoGame.getPlayers(gameId);
  const current = await DominoGame.getCurrentPlayer(gameId);
  const viewer  = players.find(p => p.user_id === viewerUserId);
  const isMyTurn = current?.user_id === viewerUserId;
  const canPass  = isMyTurn ? !(await DominoGame.canCurrentPlayerPlay(gameId)) : false;
  const playable = isMyTurn && viewer
    ? DominoDisplay.getPlayableTiles(viewer.tiles, game!.left_end, game!.right_end)
    : [];

  const embed      = DominoDisplay.buildGameEmbed(game!, players, viewerUserId, extraMsg);
  const components = game!.status === 'finished'
    ? []
    : DominoDisplay.buildGameComponents(gameId, isMyTurn, canPass, playable);

  const content = game!.status === 'finished'
    ? '🏁 **¡Partida terminada!**'
    : current?.is_bot
      ? `🤖 **${current.username}** está pensando...`
      : isMyTurn
        ? `🎴 **¡Es tu turno!** <@${viewerUserId}>`
        : `🎴 Turno de <@${current?.user_id}>`;

  return { embed, components, content };
}

// ─── Juega el turno del bot y actualiza el mensaje ────────────────────────────
async function playBotAndUpdate(gameId: string, botId: string, message: any, viewerUserId: string): Promise<void> {
  try {
    while (true) {
      const game    = await DominoGame.getGame(gameId);
      const current = await DominoGame.getCurrentPlayer(gameId);
      if (!game || game.status !== 'in_progress' || !current?.is_bot || current.user_id !== botId) break;

      const result  = await DominoGame.playBotTurn(gameId, botId);
      const updGame = await DominoGame.getGame(gameId);
      const players = await DominoGame.getPlayers(gameId);

      if (updGame?.status === 'finished') {
        const { winner } = await DominoGame.getWinnerByPoints(gameId);
        const botPlayer  = players.find(p => p.user_id === botId)!;
        const winnerName = botPlayer.tiles.length === 0
          ? `🤖 ${botPlayer.username}`
          : (winner.is_bot ? `🤖 ${winner.username}` : `<@${winner.user_id}>`);
        const embed = DominoDisplay.buildGameEmbed(updGame, players, viewerUserId, `🏆 **¡${winnerName} ganó!**`);
        await message.edit({ content: '🏁 **¡Partida terminada!**', embeds: [embed], components: [] });
        return;
      }

      const actionText = result.action === 'pass'
        ? `🤖 **${current.username}** no pudo jugar y pasó.`
        : `🤖 **${current.username}** jugó \`${DominoDisplay.tileText(result.tile!)}\``;

      const { embed, components, content } = await buildReply(gameId, viewerUserId, actionText);
      await message.edit({ content, embeds: [embed], components });

      if (!(await DominoGame.getCurrentPlayer(gameId))?.is_bot) break;
      await new Promise(r => setTimeout(r, 1200));
    }
  } catch (error) {
    console.error('Error en turno del bot (dominó):', error);
  }
}

// ─── Comando ──────────────────────────────────────────────────────────────────
const comando: Comando = {
  nombre: 'domino',
  alias: ['domi'],
  descripcion: 'Juega al dominó (hasta 4 jugadores o contra un bot)',
  uso: '!domino solo | !domino crear | !domino unirse [id] | !domino iniciar [id] | !domino jugar [id] [nº] [lado] | !domino pasar [id] | !domino estado [id]',
  categoria: 'juegos',
  ejecutar: async (message, args) => {
    const sub    = args[0]?.toLowerCase();
    const userId = message.author.id;
    const ch     = message.channel as any;

    if (!sub) {
      return ch.send(
        '🁣 **Dominó** — Comandos:\n' +
        '`!domino solo` — **Juega solo contra un bot** ⭐\n' +
        '`!domino crear` — Crea una partida multijugador\n' +
        '`!domino unirse [id]` — Únete a una partida\n' +
        '`!domino iniciar [id]` — Inicia la partida\n' +
        '`!domino jugar [id] [nº-ficha] [izquierda|derecha]` — Juega una ficha\n' +
        '`!domino pasar [id]` — Pasa tu turno (si no puedes jugar)\n' +
        '`!domino estado [id]` — Ver el estado actual\n\n' +
        '*También puedes usar los botones y el menú desplegable del mensaje.*'
      );
    }

    try {
      switch (sub) {

        // ── Solo (vs bot) ──────────────────────────────────────────────────
        case 'solo': {
          const gameId = await DominoGame.createGame(message.channel.id, userId, message.author.username);
          await DominoGame.addPlayer(gameId, `bot-${Date.now()}`, '🤖 BOT', true);
          await DominoGame.startGame(gameId);

          const current = await DominoGame.getCurrentPlayer(gameId);
          const { embed, components, content } = await buildReply(gameId, userId);

          const msg = await ch.send({
            content: current?.is_bot ? `🤖 **BOT** empieza (tiene el doble más alto).` : content,
            embeds: [embed], components,
          });

          await dbRun('ALTER TABLE domino_games ADD COLUMN message_id TEXT').catch(() => {});
          await dbRun('UPDATE domino_games SET message_id = ? WHERE game_id = ?', [msg.id, gameId]).catch(() => {});

          if (current?.is_bot) {
            await new Promise(r => setTimeout(r, 1500));
            await playBotAndUpdate(gameId, current.user_id, msg, userId);
          }
          break;
        }

        // ── Crear ──────────────────────────────────────────────────────────
        case 'crear': {
          const gameId  = await DominoGame.createGame(message.channel.id, userId, message.author.username);
          const game    = await DominoGame.getGame(gameId);
          const players = await DominoGame.getPlayers(gameId);
          const embed   = DominoDisplay.buildGameEmbed(game!, players);
          embed.setDescription(`🁣 **¡Nueva partida creada por ${message.author}!**\n\nUsa los botones para unirte. El creador puede iniciar cuando haya al menos 2 jugadores.\n*Si inicias solo, se añade un bot automáticamente.*`);
          const msg = await ch.send({ embeds: [embed], components: [DominoDisplay.buildWaitingButtons(gameId)] });
          await dbRun('ALTER TABLE domino_games ADD COLUMN message_id TEXT').catch(() => {});
          await dbRun('UPDATE domino_games SET message_id = ? WHERE game_id = ?', [msg.id, gameId]).catch(() => {});
          break;
        }

        // ── Unirse ─────────────────────────────────────────────────────────
        case 'unirse': {
          const gameId = args[1];
          if (!gameId) return ch.send('❌ Especifica el ID. Ej: `!domino unirse dom_123456`');
          await DominoGame.addPlayer(gameId, userId, message.author.username);
          const game    = await DominoGame.getGame(gameId);
          const players = await DominoGame.getPlayers(gameId);
          const embed   = DominoDisplay.buildGameEmbed(game!, players);
          embed.setDescription(`✅ **${message.author.username}** se unió. (${players.length}/4 jugadores)`);
          ch.send({ embeds: [embed], components: [DominoDisplay.buildWaitingButtons(gameId)] });
          break;
        }

        // ── Iniciar ────────────────────────────────────────────────────────
        case 'iniciar': {
          const gameId = args[1];
          if (!gameId) return ch.send('❌ Especifica el ID.');
          const gameCheck = await DominoGame.getGame(gameId);
          if (!gameCheck) return ch.send('❌ Partida no encontrada.');
          if (gameCheck.creator_id !== userId) return ch.send('❌ Solo el creador puede iniciar.');

          await DominoGame.startGame(gameId);
          const current = await DominoGame.getCurrentPlayer(gameId);
          const { embed, components, content } = await buildReply(gameId, userId);

          const msg = await ch.send({
            content: current?.is_bot ? `🤖 **${current.username}** empieza (tiene el doble más alto).` : content,
            embeds: [embed], components,
          });

          await dbRun('ALTER TABLE domino_games ADD COLUMN message_id TEXT').catch(() => {});
          await dbRun('UPDATE domino_games SET message_id = ? WHERE game_id = ?', [msg.id, gameId]).catch(() => {});

          if (current?.is_bot) {
            await new Promise(r => setTimeout(r, 1500));
            await playBotAndUpdate(gameId, current.user_id, msg, userId);
          }
          break;
        }

        // ── Jugar ficha ────────────────────────────────────────────────────
        case 'jugar': {
          const gameId    = args[1];
          const tileIndex = parseInt(args[2]) - 1;
          const side      = (args[3]?.toLowerCase() === 'izquierda' || args[3]?.toLowerCase() === 'left') ? 'left' as const : 'right' as const;

          if (!gameId || isNaN(tileIndex))
            return ch.send('❌ Uso: `!domino jugar [id] [nº-ficha] [izquierda|derecha]`');

          const game = await DominoGame.getGame(gameId);
          if (!game || game.status !== 'in_progress') return ch.send('❌ La partida no está en progreso.');
          const current = await DominoGame.getCurrentPlayer(gameId);
          if (current?.user_id !== userId) return ch.send('❌ No es tu turno.');

          const { game: updatedGame, winner } = await DominoGame.playTile(gameId, userId, tileIndex, side);
          const players = await DominoGame.getPlayers(gameId);

          if (winner) {
            const embed = DominoDisplay.buildGameEmbed(updatedGame, players, userId,
              `🏆 **¡${winner.is_bot ? winner.username : `<@${winner.user_id}>`} ganó!**`);
            return ch.send({ embeds: [embed], components: [] });
          }

          const nextPlayer = await DominoGame.getCurrentPlayer(gameId);
          const { embed, components, content } = await buildReply(gameId, userId);
          const msg = await ch.send({
            content: nextPlayer?.is_bot ? `🤖 **${nextPlayer.username}** está pensando...` : content,
            embeds: [embed], components,
          });

          if (nextPlayer?.is_bot) {
            await new Promise(r => setTimeout(r, 1500));
            await playBotAndUpdate(gameId, nextPlayer.user_id, msg, userId);
          }
          break;
        }

        // ── Pasar turno ────────────────────────────────────────────────────
        case 'pasar': {
          const gameId = args[1];
          if (!gameId) return ch.send('❌ Especifica el ID.');
          const game = await DominoGame.getGame(gameId);
          if (!game || game.status !== 'in_progress') return ch.send('❌ La partida no está en progreso.');
          const current = await DominoGame.getCurrentPlayer(gameId);
          if (current?.user_id !== userId) return ch.send('❌ No es tu turno.');

          const { blocked } = await DominoGame.passTurn(gameId, userId);
          const updatedGame = await DominoGame.getGame(gameId);
          const players     = await DominoGame.getPlayers(gameId);

          if (blocked) {
            const { winner, scores } = await DominoGame.getWinnerByPoints(gameId);
            const scoreText = scores.map(s =>
              `${s.player.is_bot ? s.player.username : `<@${s.player.user_id}>`}: **${s.points}** pts`
            ).join('\n');
            const embed = DominoDisplay.buildGameEmbed(updatedGame!, players, userId,
              `🔒 **¡Juego bloqueado!**\n🏆 Gana **${winner.is_bot ? winner.username : `<@${winner.user_id}>`}**\n\n${scoreText}`);
            return ch.send({ embeds: [embed], components: [] });
          }

          const nextPlayer = await DominoGame.getCurrentPlayer(gameId);
          const { embed, components, content } = await buildReply(gameId, userId, `⏭️ <@${userId}> pasó su turno.`);
          const msg = await ch.send({
            content: nextPlayer?.is_bot ? `🤖 **${nextPlayer.username}** está pensando...` : content,
            embeds: [embed], components,
          });

          if (nextPlayer?.is_bot) {
            await new Promise(r => setTimeout(r, 1500));
            await playBotAndUpdate(gameId, nextPlayer.user_id, msg, userId);
          }
          break;
        }

        // ── Estado ─────────────────────────────────────────────────────────
        case 'estado': {
          const gameId = args[1];
          if (!gameId) return ch.send('❌ Especifica el ID.');
          const game = await DominoGame.getGame(gameId);
          if (!game) return ch.send('❌ Partida no encontrada.');

          const { embed, components, content } = await buildReply(gameId, userId);
          const row = game.status === 'waiting' ? [DominoDisplay.buildWaitingButtons(gameId)] : components;
          ch.send({ content, embeds: [embed], components: row });
          break;
        }

        default:
          ch.send('❌ Subcomando no reconocido. Usa `!domino` para ver los comandos.');
      }
    } catch (error: any) {
      console.error('Error en dominó:', error);
      ch.send(`❌ ${error.message}`);
    }
  },
};

export default comando;
