import { EmbedBuilder } from 'discord.js';
import { Comando } from '../../types';

// Importar xpSystem del JS original mientras no se migre
const xpSystem = require('../../sistemas/xpSystem');

function createProgressBar(percentage: number): string {
  const p = Math.min(Math.max(percentage, 0), 100);
  const filled = Math.floor(p / 10);
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}]`;
}

export function setupXPEvents(client: any): void {
  client.on('messageCreate', async (message: any) => {
    if (message.author.bot || !message.guild) return;
    try { await xpSystem.handleMessage(message); } catch (e) { console.error('XP error:', e); }
  });
}

const comando: Comando = {
  nombre: 'nivel',
  alias: ['level', 'xp', 'rank'],
  descripcion: 'Muestra tu nivel y experiencia en el servidor',
  categoria: 'utilidades',
  ejecutar: async (message, args) => {
    const subcomando = args[0]?.toLowerCase();
    const targetUser = message.mentions.users.first() ?? message.author;

    try {
      if (!subcomando || subcomando === 'ver') {
        const { xp, level, xpForNextLevel } = await xpSystem.getUserXP(targetUser.id, message.guild!.id);
        const progress = Math.min(Math.floor((xp / xpForNextLevel) * 100), 100);

        const embed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setAuthor({ name: `Nivel de ${targetUser.username}`, iconURL: targetUser.displayAvatarURL() })
          .addFields(
            { name: 'Nivel', value: String(level), inline: true },
            { name: 'XP', value: `${xp}/${xpForNextLevel}`, inline: true },
            { name: 'Progreso', value: `${createProgressBar(progress)} ${progress}%`, inline: false }
          )
          .setTimestamp();

        return (message.channel as any).send({ embeds: [embed] });

      } else if (subcomando === 'tabla') {
        const leaderboard = await xpSystem.getLeaderboard(message.guild!.id, 10);
        if (!leaderboard.length) return (message.channel as any).send('No hay datos de nivel aún.');

        const lines: string[] = [];
        for (let i = 0; i < leaderboard.length; i++) {
          const row = leaderboard[i];
          const user = await message.client.users.fetch(row.user_id).catch(() => ({ username: 'Desconocido' }));
          const xpNext = xpSystem.getRequiredXP(row.level);
          const prog = Math.min(Math.floor((row.xp / xpNext) * 100), 100);
          lines.push(`**${i + 1}.** ${(user as any).username} — Nivel ${row.level} (${row.xp}/${xpNext} XP) \`${createProgressBar(prog)}\``);
        }

        const embed = new EmbedBuilder()
          .setTitle('🏆 Tabla de Clasificación')
          .setColor('#f1c40f')
          .addFields({ name: 'Top 10', value: lines.join('\n') })
          .setTimestamp();

        return (message.channel as any).send({ embeds: [embed] });

      } else {
        return message.reply('Uso: `!nivel` | `!nivel tabla` | `!nivel config` (admin)');
      }
    } catch (error) {
      console.error('Error en comando nivel:', error);
      message.reply('❌ Ocurrió un error al procesar el comando.');
    }
  },
};

export default comando;
