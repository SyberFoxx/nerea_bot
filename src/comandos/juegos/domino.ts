import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { Comando } from '../../types';
import { DominoGame } from '../../sistemas/domino/gameLogic';
import { DominoDisplay } from '../../sistemas/domino/dominoUtils';

const activeGames = new Map<string, { messageId: string; creatorId: string; channelId: string }>();

const comando: Comando = {
  nombre: 'domino',
  alias: ['domi'],
  descripcion: 'Juega al dominó con amigos',
  categoria: 'juegos',
  ejecutar: async (message, args) => {
    const sub = args[0]?.toLowerCase();
    const ch = message.channel as any;

    if (!sub) return message.reply('❌ Uso: `!domino [crear|unirse|iniciar|estado|jugar]`');

    try {
      switch (sub) {
        case 'crear': {
          const gameId = await DominoGame.createGame(message.channel.id, message.author.id);
          const players = await DominoGame.getPlayers(gameId);
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`domino_join_${gameId}`).setLabel('Unirse').setStyle(ButtonStyle.Primary)
          );
          if (players.length >= 2) {
            (row as any).addComponents(new ButtonBuilder().setCustomId(`domino_start_${gameId}`).setLabel('Iniciar').setStyle(ButtonStyle.Success));
          }
          const embed = new EmbedBuilder().setTitle('🎲 Partida de Dominó')
            .setDescription(`**ID:** \`${gameId}\`\nCreada por: <@${message.author.id}>`)
            .addFields({ name: 'Jugadores', value: `${players.length}/4`, inline: true }, { name: 'Estado', value: '🟡 Esperando...', inline: true })
            .setColor('#2ecc71').setTimestamp();
          const sent = await ch.send({ content: `🎲 **¡Nueva partida de dominó!**`, embeds: [embed], components: [row] });
          activeGames.set(gameId, { messageId: sent.id, creatorId: message.author.id, channelId: message.channel.id });
          break;
        }
        case 'unirse': {
          const gameId = args[1];
          if (!gameId) return message.reply('❌ Especifica el ID. Ej: `!domino unirse ABC123`');
          const count = await DominoGame.addPlayer(gameId, message.author.id);
          const embed = new EmbedBuilder().setTitle('🎲 Partida de Dominó')
            .setDescription(`**ID:** \`${gameId}\`\n<@${message.author.id}> se unió.`)
            .addFields({ name: 'Jugadores', value: `${count}/4`, inline: true })
            .setColor('#2ecc71').setTimestamp();
          message.reply({ embeds: [embed] });
          break;
        }
        case 'iniciar': {
          const gameId = args[1];
          if (!gameId) return message.reply('❌ Especifica el ID.');
          await DominoGame.startGame(gameId);
          const data = activeGames.get(gameId);
          if (data) {
            const canal = message.guild?.channels.cache.get(data.channelId) as any;
            if (canal) {
              const msg = await canal.messages.fetch(data.messageId).catch(() => null);
              if (msg) await msg.edit({ content: '🎲 **¡La partida comenzó!**', components: [] });
            }
          }
          message.reply(`✅ ¡La partida ${gameId} ha comenzado!`);
          break;
        }
        case 'estado': {
          const gameId = args[1];
          if (!gameId) return message.reply('❌ Especifica el ID.');
          const status = await DominoGame.getGameStatus(gameId);
          const tiles = await DominoGame.getPlayerTiles(gameId, message.author.id);
          const embed = DominoDisplay.createBoardEmbed(gameId, status, status.players[status.currentPlayer]?.id, tiles);
          message.reply({ embeds: [embed] });
          break;
        }
        case 'jugar': {
          const gameId = args[1];
          const tileIndex = parseInt(args[2]) - 1;
          const side = args[3]?.toLowerCase() ?? 'right';
          if (!gameId || isNaN(tileIndex)) return message.reply('❌ Uso: `!domino jugar [id] [nº-ficha] [izquierda/derecha]`');
          const tiles = await DominoGame.getPlayerTiles(gameId, message.author.id);
          if (tileIndex < 0 || tileIndex >= tiles.length) return message.reply('❌ Número de ficha inválido.');
          await DominoGame.playTile(gameId, message.author.id, tiles[tileIndex].rowid, side);
          const status = await DominoGame.getGameStatus(gameId);
          const updated = await DominoGame.getPlayerTiles(gameId, message.author.id);
          const embed = DominoDisplay.createBoardEmbed(gameId, status, status.players[status.currentPlayer]?.id, updated);
          message.reply({ content: '✅ ¡Ficha jugada!', embeds: [embed] });
          break;
        }
        default:
          message.reply('❌ Subcomando no reconocido. Usa: `crear`, `unirse`, `iniciar`, `estado`, `jugar`.');
      }
    } catch (error: any) {
      console.error('Error en dominó:', error);
      message.reply(`❌ Error: ${error.message}`);
    }
  },
};

export default comando;
