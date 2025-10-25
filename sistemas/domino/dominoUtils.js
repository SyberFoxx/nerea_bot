const { EmbedBuilder } = require('discord.js');

class DominoDisplay {
  static getTileEmoji(left, right) {
    // Mapeo de números a emojis de dominó
    const dots = [
      '0️⃣', '1️⃣', '2️⃣', '3️⃣', 
      '4️⃣', '5️⃣', '6️⃣'
    ];
    
    return `[${dots[left]}│${dots[right]}]`;
  }

  static renderHand(tiles) {
    return tiles
      .map(tile => this.getTileEmoji(tile.left_value, tile.right_value))
      .join(' ');
  }

  static createBoardEmbed(gameId, status, currentPlayerId, playerTiles = []) {
    const embed = new EmbedBuilder()
      .setTitle(`🎴 Partida de Dominó - ${gameId}`)
      .setColor('#2ecc71')
      .setThumbnail('https://i.imgur.com/8Km9tLL.png')
      .setFooter({ 
        text: 'Usa /domino jugar [ficha] para jugar',
        iconURL: 'https://i.imgur.com/wSTFkRM.png' 
      });

    // Estado del juego
    embed.addFields({
      name: 'Estado',
      value: this.getStatusText(status.status),
      inline: true
    });

    // Turno actual
    if (status.status === 'in_progress') {
      embed.addFields({
        name: 'Turno',
        value: `<@${currentPlayerId}>`,
        inline: true
      });
    }

    // Mostrar fichas del jugador si están disponibles
    if (playerTiles && playerTiles.length > 0) {
      const tilesDisplay = this.renderHand(playerTiles);
      embed.addFields({
        name: 'Tus fichas',
        value: tilesDisplay || 'No tienes fichas',
      });

      // Añadir números para referencia
      const tileNumbers = playerTiles
        .map((_, i) => `\`${i + 1}\``)
        .join('   ');
      
      embed.addFields({
        name: 'Posición',
        value: tileNumbers,
        inline: false
      });
    }

    return embed;
  }

  static getStatusText(status) {
    const statusMap = {
      'waiting': '🟡 Esperando jugadores',
      'in_progress': '🟢 En curso',
      'finished': '🔴 Terminada'
    };
    return statusMap[status] || status;
  }
}

module.exports = DominoDisplay;
