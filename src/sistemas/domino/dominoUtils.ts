import { EmbedBuilder } from 'discord.js';

interface Tile { left_value: number; right_value: number; }

const DOTS = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

export class DominoDisplay {
  static getTileEmoji(left: number, right: number): string {
    return `[${DOTS[left]}│${DOTS[right]}]`;
  }

  static renderHand(tiles: Tile[]): string {
    return tiles.map(t => this.getTileEmoji(t.left_value, t.right_value)).join(' ');
  }

  static getStatusText(status: string): string {
    return { waiting: '🟡 Esperando jugadores', in_progress: '🟢 En curso', finished: '🔴 Terminada' }[status] ?? status;
  }

  static createBoardEmbed(gameId: string, status: any, currentPlayerId: string, playerTiles: Tile[] = []): EmbedBuilder {
    const embed = new EmbedBuilder()
      .setTitle(`🎴 Partida de Dominó — ${gameId}`)
      .setColor('#2ecc71')
      .setFooter({ text: 'Usa !domino jugar [ficha] para jugar' });

    embed.addFields({ name: 'Estado', value: this.getStatusText(status.status), inline: true });
    if (status.status === 'in_progress') embed.addFields({ name: 'Turno', value: `<@${currentPlayerId}>`, inline: true });

    if (playerTiles.length > 0) {
      embed.addFields(
        { name: 'Tus fichas', value: this.renderHand(playerTiles) || 'Sin fichas' },
        { name: 'Posición', value: playerTiles.map((_, i) => `\`${i + 1}\``).join('   '), inline: false }
      );
    }

    return embed;
  }
}

export default DominoDisplay;
