import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Comando } from '../../types';
import { BlackjackGame } from '../../sistemas/blackjack/gameLogic';
import { dbRun } from '../../sistemas/blackjack/db';

const comando: Comando = {
  nombre: 'blackjack',
  alias: ['bj', 'veintiuno'],
  descripcion: 'Juega una partida de Blackjack',
  categoria: 'juegos',
  ejecutar: async (message, args) => {
    const sub = args[0]?.toLowerCase();
    const userId = message.author.id;
    const channelId = message.channel.id;
    const gameId = args[1];
    const ch = message.channel as any;

    if (!sub) return ch.send('❌ Uso: `!blackjack crear` | `!blackjack unirse [id]` | `!blackjack iniciar [id]` | `!blackjack apostar [id] [cantidad]`');

    try {
      switch (sub) {
        case 'crear': {
          const id = await BlackjackGame.createGame(channelId, userId);
          const embed = new EmbedBuilder().setColor('#0099ff').setTitle('🎰 Nueva Partida de Blackjack')
            .addFields(
              { name: 'ID', value: `\`${id}\`` },
              { name: 'Creador', value: `<@${userId}>` },
              { name: 'Estado', value: '🔄 Esperando jugadores...' },
              { name: 'Unirse', value: `\`!blackjack unirse ${id}\`` }
            ).setTimestamp();
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`blackjack_join_${id}`).setLabel('Unirse').setStyle(ButtonStyle.Primary)
          );
          const msg = await ch.send({ content: `🎰 <@${userId}> creó una partida de Blackjack.`, embeds: [embed], components: [row] });
          await dbRun('UPDATE games SET message_id = ? WHERE game_id = ?', [msg.id, id]);
          break;
        }
        case 'unirse': {
          if (!gameId) return ch.send('❌ Especifica el ID. Ej: `!blackjack unirse 12345`');
          const game = await BlackjackGame.getGame(gameId);
          const players = await BlackjackGame.getPlayers(gameId);
          if (players.some((p: any) => p.user_id === userId))
            return ch.send(`ℹ️ Ya estás en esta partida. Usa \`!blackjack iniciar ${gameId}\` para comenzar.`);
          await BlackjackGame.addPlayer(gameId, userId);
          const updated = await BlackjackGame.getPlayers(gameId);
          if (updated.length === 1) { await BlackjackGame.addPlayer(gameId, 'bot-1', true); await ch.send('🤖 Se unió un bot.'); }
          await ch.send(`✅ <@${userId}> se unió (${updated.length}/4 jugadores)`);
          break;
        }
        case 'iniciar': {
          if (!gameId) return ch.send('❌ Especifica el ID. Ej: `!blackjack iniciar 12345`');
          const game = await BlackjackGame.getGame(gameId);
          if (!game) return ch.send('❌ Partida no encontrada.');
          const players = await BlackjackGame.getPlayers(gameId);
          if (!players.find((p: any) => p.user_id === userId)) return ch.send('❌ Debes estar en la partida para iniciarla.');
          await BlackjackGame.startGame(gameId);
          const updatedGame = await BlackjackGame.getGame(gameId);
          const updatedPlayers = await BlackjackGame.getPlayers(gameId);
          const embed = BlackjackGame.createGameEmbed(updatedGame, updatedPlayers, userId);
          const row = BlackjackGame.createGameButtons(updatedGame, userId);
          await ch.send({ content: `🎰 **¡La partida comenzó!** Turno de <@${userId}>`, embeds: [embed], components: [row] });
          break;
        }
        case 'apostar': {
          const amount = parseInt(args[2]);
          if (!gameId || isNaN(amount)) return ch.send('❌ Uso: `!blackjack apostar [id] [cantidad]`');
          const player = await BlackjackGame.getPlayer(gameId, userId);
          if (!player) return ch.send('❌ No estás en esta partida.');
          if (player.balance < amount) return ch.send('❌ Saldo insuficiente.');
          if (amount <= 0) return ch.send('❌ La apuesta debe ser mayor a 0.');
          await dbRun('UPDATE players SET current_bet = ? WHERE user_id = ? AND game_id = ?', [amount, userId, gameId]);
          await ch.send(`✅ <@${userId}> apostó $${amount}.`);
          break;
        }
        default:
          await ch.send('❌ Subcomando no reconocido.');
      }
    } catch (error: any) {
      console.error('Error en blackjack:', error);
      await ch.send(`❌ Error: ${error.message}`);
    }
  },
};

export default comando;
