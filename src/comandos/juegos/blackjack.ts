import { Comando } from '../../types';
import { BlackjackGame } from '../../sistemas/blackjack/gameLogic';
import { dbRun } from '../../sistemas/blackjack/db';

const comando: Comando = {
  nombre: 'blackjack',
  alias: ['bj', 'veintiuno'],
  descripcion: 'Juega una partida de Blackjack con apuestas, doble y rendición',
  uso: '!blackjack crear | !blackjack unirse [id] | !blackjack apostar [id] [cantidad] | !blackjack iniciar [id]',
  categoria: 'juegos',
  ejecutar: async (message, args) => {
    const sub = args[0]?.toLowerCase();
    const userId = message.author.id;
    const ch = message.channel as any;

    if (!sub) {
      return ch.send(
        '🎰 **Blackjack** — Comandos disponibles:\n' +
        '`!blackjack solo` — **Juega solo contra un bot** ⭐\n' +
        '`!blackjack crear` — Crea una nueva partida\n' +
        '`!blackjack unirse [id]` — Únete a una partida\n' +
        '`!blackjack apostar [id] [cantidad]` — Establece tu apuesta\n' +
        '`!blackjack iniciar [id]` — Inicia la partida\n\n' +
        '*Una vez iniciada, usa los botones para Pedir carta, Plantarse, Doblar o Rendirte.*'
      );
    }

    try {
      switch (sub) {

        // ── Solo (vs bot) ──────────────────────────────────────────────────
        case 'solo': {
          const gameId = await BlackjackGame.createGame(message.channel.id, userId);
          await dbRun('UPDATE players SET username = ? WHERE user_id = ? AND game_id = ?', [message.author.username, userId, gameId]);

          // Iniciar directamente (startGame añade el bot automáticamente)
          await BlackjackGame.startGame(gameId);

          const game    = await BlackjackGame.getGame(gameId);
          const players = await BlackjackGame.getPlayers(gameId);
          const current = players.find(p => p.status === 'playing' && !p.is_bot);

          const embed = BlackjackGame.buildEmbed(game!, players);
          embed.setDescription('🎰 **Tú vs 🤖 BOT**\n\nUsa los botones para jugar.');
          const rows = BlackjackGame.buildButtons(game!, players, current?.user_id);

          const msg = await ch.send({
            content: current ? `🎲 **¡La partida comenzó!** Es tu turno <@${userId}>` : '🎲 **¡La partida comenzó!**',
            embeds: [embed],
            components: rows,
          });
          await dbRun('UPDATE games SET message_id = ? WHERE game_id = ?', [msg.id, gameId]);
          break;
        }

        // ── Crear partida ──────────────────────────────────────────────────
        case 'crear': {
          const username = message.author.username;
          const gameId = await BlackjackGame.createGame(message.channel.id, userId);

          // Guardar username del creador
          await dbRun('UPDATE players SET username = ? WHERE user_id = ? AND game_id = ?', [username, userId, gameId]);

          const game = await BlackjackGame.getGame(gameId);
          const players = await BlackjackGame.getPlayers(gameId);
          const embed = BlackjackGame.buildEmbed(game!, players);
          embed.setDescription(`🎰 **¡Nueva partida creada por ${message.author}!**\n\nApuesta mínima: **$100**\nUsa los botones para unirte y apostar antes de iniciar.`);

          const rows = BlackjackGame.buildButtons(game!, players);
          const msg = await ch.send({ embeds: [embed], components: rows });
          await dbRun('UPDATE games SET message_id = ? WHERE game_id = ?', [msg.id, gameId]);
          break;
        }

        // ── Unirse ─────────────────────────────────────────────────────────
        case 'unirse': {
          const gameId = args[1];
          if (!gameId) return ch.send('❌ Especifica el ID. Ej: `!blackjack unirse bj_123456`');

          const existing = await BlackjackGame.getPlayer(gameId, userId);
          if (existing) return ch.send('ℹ️ Ya estás en esta partida.');

          await BlackjackGame.addPlayer(gameId, userId, false, message.author.username);
          const game = await BlackjackGame.getGame(gameId);
          const players = await BlackjackGame.getPlayers(gameId);

          // Actualizar mensaje original si existe
          if (game?.message_id) {
            try {
              const original = await ch.messages.fetch(game.message_id);
              const embed = BlackjackGame.buildEmbed(game, players);
              embed.setDescription(`🎰 **Partida de Blackjack**\n\n${players.filter((p: any) => !p.is_bot).map((p: any) => `👤 ${p.username} — Apuesta: $${p.current_bet}`).join('\n')}`);
              await original.edit({ embeds: [embed], components: BlackjackGame.buildButtons(game, players) });
            } catch { /* mensaje ya no existe */ }
          }

          await ch.send(`✅ **${message.author.username}** se unió a la partida \`${gameId}\` (${players.filter((p: any) => !p.is_bot).length}/4 jugadores)`);
          break;
        }

        // ── Apostar ────────────────────────────────────────────────────────
        case 'apostar': {
          const gameId = args[1];
          const amount = parseInt(args[2]);
          if (!gameId || isNaN(amount)) return ch.send('❌ Uso: `!blackjack apostar [id] [cantidad]`');

          await BlackjackGame.placeBet(gameId, userId, amount);

          const game = await BlackjackGame.getGame(gameId);
          const players = await BlackjackGame.getPlayers(gameId);

          if (game?.message_id) {
            try {
              const original = await ch.messages.fetch(game.message_id);
              const embed = BlackjackGame.buildEmbed(game, players);
              embed.setDescription(`🎰 **Partida de Blackjack**\n\n${players.filter((p: any) => !p.is_bot).map((p: any) => `👤 ${p.username} — Apuesta: **$${p.current_bet}**`).join('\n')}`);
              await original.edit({ embeds: [embed], components: BlackjackGame.buildButtons(game, players) });
            } catch { /* ignorar */ }
          }

          await ch.send(`💰 **${message.author.username}** apostó **$${amount}** en la partida \`${gameId}\``);
          break;
        }

        // ── Iniciar ────────────────────────────────────────────────────────
        case 'iniciar': {
          const gameId = args[1];
          if (!gameId) return ch.send('❌ Especifica el ID. Ej: `!blackjack iniciar bj_123456`');

          const gameCheck = await BlackjackGame.getGame(gameId);
          if (!gameCheck) return ch.send('❌ Partida no encontrada.');
          if (gameCheck.creator_id !== userId) return ch.send('❌ Solo el creador puede iniciar la partida.');

          const playersCheck = await BlackjackGame.getPlayers(gameId);
          if (!playersCheck.find((p: any) => p.user_id === userId)) return ch.send('❌ Debes estar en la partida.');

          await BlackjackGame.startGame(gameId);

          const game = await BlackjackGame.getGame(gameId);
          const players = await BlackjackGame.getPlayers(gameId);
          const currentPlayer = players.find((p: any) => p.status === 'playing' && !p.is_bot);

          const embed = BlackjackGame.buildEmbed(game!, players);
          const rows = BlackjackGame.buildButtons(game!, players, currentPlayer?.user_id);

          const msg = await ch.send({
            content: currentPlayer ? `🎲 **¡La partida comenzó!** Turno de <@${currentPlayer.user_id}>` : '🎲 **¡La partida comenzó!**',
            embeds: [embed],
            components: rows,
          });

          // Actualizar message_id al mensaje de juego activo
          await dbRun('UPDATE games SET message_id = ? WHERE game_id = ?', [msg.id, gameId]);
          break;
        }

        default:
          ch.send('❌ Subcomando no reconocido. Usa `!blackjack` para ver los comandos disponibles.');
      }
    } catch (error: any) {
      console.error('Error en blackjack:', error);
      ch.send(`❌ ${error.message}`);
    }
  },
};

export default comando;
