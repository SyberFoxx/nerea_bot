import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SlashComando } from '../../types';
import { generateRankCard } from '../../canvas/imageUtils';

const xpSystem = require('../../sistemas/xpSystem');

function getAccentColor(member: any): string {
  const topRole = member?.roles?.cache
    ?.filter((r: any) => r.color !== 0)
    ?.sort((a: any, b: any) => b.position - a.position)
    ?.first();
  return topRole ? `#${topRole.color.toString(16).padStart(6, '0')}` : '#2ecc71';
}

function textBar(pct: number): string {
  const f = Math.floor(pct / 10);
  return `[${'█'.repeat(f)}${'░'.repeat(10 - f)}]`;
}

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('nivel')
    .setDescription('Sistema de niveles y XP')
    .addSubcommand(sub =>
      sub.setName('ver').setDescription('Ver tu tarjeta de nivel o la de otro usuario')
        .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a consultar').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('tabla').setDescription('Top 10 del servidor por XP')
    ),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const sub = interaction.options.getSubcommand();
    await interaction.deferReply();

    // ── Ver nivel ──────────────────────────────────────────────────────────
    if (sub === 'ver') {
      const target = interaction.options.getUser('usuario') ?? interaction.user;
      const member = interaction.guild?.members.cache.get(target.id)
        ?? await interaction.guild?.members.fetch(target.id).catch(() => null);

      const { xp, level, xpForNextLevel } = await xpSystem.getUserXP(target.id, interaction.guild!.id);

      const leaderboard = await xpSystem.getLeaderboard(interaction.guild!.id, 200);
      const pos  = leaderboard.findIndex((r: any) => r.user_id === target.id);
      const rank = pos >= 0 ? pos + 1 : leaderboard.length + 1;

      const accentColor = getAccentColor(member);

      try {
        const buffer = await generateRankCard({
          username:    target.username,
          avatarUrl:   target.displayAvatarURL({ size: 256, extension: 'png', forceStatic: true }),
          level, xp, xpNeeded: xpForNextLevel, rank, accentColor,
        });

        const attachment = new AttachmentBuilder(buffer, { name: 'nivel.png' });
        await interaction.editReply({
          files: [attachment],
          embeds: [{
            color: parseInt(accentColor.replace('#', ''), 16),
            image: { url: 'attachment://nivel.png' },
            footer: { text: `${interaction.guild!.name} • Usa /nivel tabla para ver el ranking` },
          }],
        });
      } catch (error) {
        // Fallback a embed de texto
        const pct = Math.min(Math.floor((xp / xpForNextLevel) * 100), 100);
        await interaction.editReply({
          embeds: [{
            author: { name: `Nivel de ${target.username}`, icon_url: target.displayAvatarURL() },
            color: parseInt(accentColor.replace('#', ''), 16),
            thumbnail: { url: target.displayAvatarURL({ size: 128 }) },
            fields: [
              { name: '🏆 Nivel', value: String(level), inline: true },
              { name: '⭐ XP', value: `${xp.toLocaleString()} / ${xpForNextLevel.toLocaleString()}`, inline: true },
              { name: '🏅 Rank', value: `#${rank}`, inline: true },
              { name: '📊 Progreso', value: `\`${textBar(pct)}\` **${pct}%**`, inline: false },
            ],
            timestamp: new Date().toISOString(),
          }],
        });
      }
      return;
    }

    // ── Tabla de clasificación ─────────────────────────────────────────────
    if (sub === 'tabla') {
      const leaderboard = await xpSystem.getLeaderboard(interaction.guild!.id, 10);
      if (!leaderboard.length) return interaction.editReply('No hay datos de nivel aún. ¡Empieza a chatear para ganar XP!');

      const lines: string[] = [];
      for (let i = 0; i < leaderboard.length; i++) {
        const row  = leaderboard[i];
        const user = await interaction.client.users.fetch(row.user_id).catch(() => ({ username: 'Desconocido' }));
        const xpNext = xpSystem.getRequiredXP(row.level);
        const pct    = Math.min(Math.floor((row.xp / xpNext) * 100), 100);
        const medal  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `\`${i + 1}.\``;
        lines.push(
          `${medal} **${(user as any).username}** — Nivel **${row.level}** · ${row.xp.toLocaleString()} XP\n` +
          `　\`${textBar(pct)}\` ${pct}%`
        );
      }

      await interaction.editReply({
        embeds: [{
          title: '🏆 Tabla de Clasificación',
          description: lines.join('\n\n'),
          color: 0xf1c40f,
          thumbnail: { url: interaction.guild!.iconURL({ size: 128 }) ?? '' },
          footer: { text: `${interaction.guild!.name} • Top 10 por XP total` },
          timestamp: new Date().toISOString(),
        }],
      });
    }
  },
};

export default comando;
