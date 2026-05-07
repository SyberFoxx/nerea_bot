import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SlashComando } from '../../types';
import { generateRankCard } from '../../canvas/imageUtils';

const xpSystem = require('../../sistemas/xpSystem');

function getAccentColor(member: any): string {
  const topRole = member?.roles.cache
    .filter((r: any) => r.color !== 0)
    .sort((a: any, b: any) => b.position - a.position)
    .first();
  return topRole ? `#${topRole.color.toString(16).padStart(6, '0')}` : '#2ecc71';
}

function bar(pct: number): string {
  const f = Math.floor(pct / 10);
  return `[${'█'.repeat(f)}${'░'.repeat(10 - f)}]`;
}

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('nivel')
    .setDescription('Sistema de niveles')
    .addSubcommand(sub =>
      sub.setName('ver').setDescription('Ver tu nivel o el de otro usuario')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('tabla').setDescription('Top 10 del servidor')
    ),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    if (sub === 'ver') {
      const target = interaction.options.getUser('usuario') ?? interaction.user;
      const member = interaction.guild?.members.cache.get(target.id);

      const { xp, level, xpForNextLevel } = await xpSystem.getUserXP(target.id, interaction.guild!.id);

      // Calcular rank
      const leaderboard = await xpSystem.getLeaderboard(interaction.guild!.id, 100);
      const pos  = leaderboard.findIndex((r: any) => r.user_id === target.id);
      const rank = pos >= 0 ? pos + 1 : leaderboard.length + 1;

      const accentColor = getAccentColor(member);

      try {
        const buffer = await generateRankCard({
          username:   target.username,
          avatarUrl:  target.displayAvatarURL({ size: 256, extension: 'png' }),
          level, xp, xpNeeded: xpForNextLevel, rank, accentColor,
        });

        const attachment = new AttachmentBuilder(buffer, { name: 'nivel.png' });
        await interaction.editReply({
          files: [attachment],
          embeds: [{
            color: parseInt(accentColor.replace('#', ''), 16),
            image: { url: 'attachment://nivel.png' },
          }],
        });
      } catch (error) {
        // Fallback a embed de texto si canvas falla
        const pct = Math.min(Math.floor((xp / xpForNextLevel) * 100), 100);
        await interaction.editReply({
          embeds: [{
            author: { name: `Nivel de ${target.username}`, icon_url: target.displayAvatarURL() },
            color: 0x2ecc71,
            fields: [
              { name: '🏆 Nivel', value: String(level), inline: true },
              { name: '⭐ XP', value: `${xp} / ${xpForNextLevel}`, inline: true },
              { name: '🏅 Rank', value: `#${rank}`, inline: true },
              { name: '📊 Progreso', value: `\`${bar(pct)}\` **${pct}%**`, inline: false },
            ],
            thumbnail: { url: target.displayAvatarURL({ size: 128 }) },
          }],
        });
      }
      return;
    }

    if (sub === 'tabla') {
      const leaderboard = await xpSystem.getLeaderboard(interaction.guild!.id, 10);
      if (!leaderboard.length) return interaction.editReply('No hay datos de nivel aún.');

      const lines: string[] = [];
      for (let i = 0; i < leaderboard.length; i++) {
        const row  = leaderboard[i];
        const user = await interaction.client.users.fetch(row.user_id).catch(() => ({ username: 'Desconocido' }));
        const pct  = Math.min(Math.floor((row.xp / xpSystem.getRequiredXP(row.level)) * 100), 100);
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
        lines.push(`${medal} ${(user as any).username} — Nivel **${row.level}** (${row.xp.toLocaleString()} XP) \`${bar(pct)}\``);
      }

      await interaction.editReply({
        embeds: [{
          title: '🏆 Tabla de Clasificación',
          description: lines.join('\n'),
          color: 0xf1c40f,
          thumbnail: { url: interaction.guild!.iconURL() ?? '' },
          footer: { text: `Servidor: ${interaction.guild!.name}` },
          timestamp: new Date().toISOString(),
        }],
      });
    }
  },
};

export default comando;
