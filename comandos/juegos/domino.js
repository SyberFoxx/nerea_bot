const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const DominoGame = require('../../sistemas/domino/gameLogic');
const DominoDisplay = require('../../sistemas/domino/dominoUtils');

// Mapa para almacenar partidas temporales y temporizadores
const activeGames = new Map();
const gameTimeouts = new Map();

module.exports = {
  nombre: 'domino',
  alias: ['domi'],
  descripcion: 'Juega al dominó con amigos',
  categoria: 'juegos',
  permisos: [],

  async ejecutar(message, args) {
    const subcommand = args[0]?.toLowerCase();
    
    if (!subcommand) {
      return message.reply('❌ Uso correcto: `!domino [crear|unirse|iniciar|estado|jugar]`');
    }

    try {
      if (subcommand === 'crear') {
        try {
          const gameId = await DominoGame.createGame(message.channel.id, message.author.id);
          
          // Crear fila de botones
          const row = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(`domino_join_${gameId}`)
                .setLabel('Unirse a la partida')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(false)
            );
            
          // Obtener jugadores actuales
          const players = await DominoGame.getPlayers(gameId);
          
          // Si ya hay al menos 2 jugadores, agregar botón de iniciar
          if (players.length >= 2) {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`domino_start_${gameId}`)
                .setLabel('Iniciar partida')
                .setStyle(ButtonStyle.Success)
            );
          }

          const embed = this.createGameEmbed(gameId, message.author.id, 1);
          
          const sentMessage = await message.channel.send({
            content: `🎲 **¡Nueva partida de dominó creada por ${message.author}!**`,
            embeds: [embed],
            components: [row]
          });
          
          activeGames.set(gameId, {
            messageId: sentMessage.id,
            creatorId: message.author.id,
            channelId: message.channel.id
          });
          
        } catch (error) {
          console.error('Error en comando dominó:', error);
          return message.reply(`❌ Ocurrió un error al crear la partida: ${error.message}`);
        }

      } else if (subcommand === 'unirse') {
        const gameId = args[1];
        if (!gameId) {
          return message.reply('❌ Por favor proporciona un ID de partida. Ejemplo: `!domino unirse ABC123`');
        }
        
        const playerCount = await DominoGame.addPlayer(gameId, message.author.id);
        
        message.reply({
          embeds: [this.createGameEmbed(gameId, message.author.id, playerCount)]
        });

      } else if (subcommand === 'iniciar') {
        const gameId = args[1];
        if (!gameId) {
          return message.reply('❌ Por favor proporciona un ID de partida. Ejemplo: `!domino iniciar ABC123`');
        }
        
        await DominoGame.startGame(gameId);
        
        // Actualizar el mensaje de la partida
        const gameData = activeGames.get(gameId);
        if (gameData) {
          const channel = message.guild.channels.cache.get(gameData.channelId);
          if (channel) {
            const gameMessage = await channel.messages.fetch(gameData.messageId);
            if (gameMessage) {
              await gameMessage.edit({
                content: `🎲 **¡La partida de dominó ha comenzado!**`,
                components: [] // Eliminar el botón de unirse
              });
            }
          }
        }
        
        message.reply(`✅ ¡La partida ${gameId} ha comenzado!`);

      } else if (subcommand === 'estado') {
        const gameId = args[1];
        if (!gameId) {
          return message.reply('❌ Por favor proporciona un ID de partida. Ejemplo: `!domino estado ABC123`');
        }
        
        const status = await DominoGame.getGameStatus(gameId);
        const playerTiles = await DominoGame.getPlayerTiles(gameId, message.author.id);
        
        const embed = DominoDisplay.createBoardEmbed(
          gameId, 
          status, 
          status.players[status.currentPlayer]?.id,
          playerTiles
        );
        
        message.reply({ embeds: [embed] });
        
      } else if (subcommand === 'jugar') {
        const gameId = args[1];
        const tileIndex = parseInt(args[2]) - 1; // Convertir a índice 0-based
        const side = args[3]?.toLowerCase() || 'right';
        
        if (!gameId || isNaN(tileIndex)) {
          return message.reply('❌ Uso correcto: `!domino jugar [id] [número-ficha] [izquierda/derecha]`');
        }
        
        // Obtener las fichas del jugador
        const playerTiles = await DominoGame.getPlayerTiles(gameId, message.author.id);
        
        if (tileIndex < 0 || tileIndex >= playerTiles.length) {
          return message.reply('❌ Número de ficha inválido. Usa `!domino estado [id]` para ver tus fichas.');
        }
        
        const tileId = playerTiles[tileIndex].rowid;
        await DominoGame.playTile(gameId, message.author.id, tileId, side);
        
        // Obtener el estado actualizado
        const status = await DominoGame.getGameStatus(gameId);
        const updatedTiles = await DominoGame.getPlayerTiles(gameId, message.author.id);
        
        // Crear embed de confirmación
        const embed = DominoDisplay.createBoardEmbed(
          gameId, 
          status, 
          status.players[status.currentPlayer]?.id,
          updatedTiles
        );
        
        message.reply({
          content: `✅ ¡Has jugado tu ficha correctamente!`,
          embeds: [embed]
        });
      }
    } catch (error) {
      await interaction.reply({
        content: `❌ Error: ${error.message}`,
        ephemeral: true
      });
    }
  },

  createGameEmbed(gameId, creatorId, playerCount) {
    return new EmbedBuilder()
      .setTitle('🎲 Partida de Dominó')
      .setDescription(
        `**ID de la partida:** \`${gameId}\`\n` +
        `Creada por: <@${creatorId}>\n` +
        `Usa el comando \`/domino unirse id:${gameId}\` para unirte.`
      )
      .addFields(
        { name: 'Jugadores', value: `${playerCount}/4`, inline: true },
        { name: 'Estado', value: '🟡 Esperando jugadores...', inline: true }
      )
      .setColor('#2ecc71')
      .setTimestamp();
  },

  // Método auxiliar para el estado del juego
  getStatusText(status) {
    return DominoDisplay.getStatusText(status);
  },
  
  // Método auxiliar para el color del estado
  getStatusColor(status) {
    const colorMap = {
      'waiting': 0xf39c12, // Amarillo
      'in_progress': 0x2ecc71, // Verde
      'finished': 0xe74c3c // Rojo
    };
    return colorMap[status] || 0x3498db; // Azul por defecto
  }
};