import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SlashComando } from '../../types';
import { generateProfileCard } from '../../canvas/imageUtils';
import { getEquipped } from '../../sistemas/cosmetics';
import { getColorHex } from '../../canvas/frameStyles';

const xpSystem = require('../../sistemas/xpSystem');

function getAccentColor(member: any): string {
  const topRole = member?.roles?.cache
    ?.filter((r: any) => r.color !== 0)
    ?.sort((a: any, b: any) => b.position - a.position)
    ?.first();
  return topRole ? `#${topRole.color.toString(16).padStart(6, '0')}` : '#3498db';
}

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Muestra la tarjeta de perfil de un usuario')
    .addUserOption(opt =>
      opt.setName('usuario').setDescription('Usuario a consultar (opcional)').setRequired(false)
    ),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getUser('usuario') ?? interaction.user;
    const member = interaction.guild?.members.cache.get(target.id)
      ?? await interaction.guild?.members.fetch(target.id).catch(() => null);

    if (!member) return interaction.reply({ content: '❌ No se encontró al usuario en este servidor.', ephemeral: true });

    await interaction.deferReply();

    // ── Datos de XP y rank ─────────────────────────────────────────────────
    let level = 1, xp = 0, xpNeeded = 155, rank = 1;
    try {
      const xpData  = await xpSystem.getUserXP(target.id, interaction.guild!.id);
      level    = xpData.level;
      xp       = xpData.xp;
      xpNeeded = xpData.xpForNextLevel;

      const leaderboard = await xpSystem.getLeaderboard(interaction.guild!.id, 200);
      const pos = leaderboard.findIndex((r: any) => r.user_id === target.id);
      rank = pos >= 0 ? pos + 1 : leaderboard.length + 1;
    } catch { /* XP no disponible, usar defaults */ }

    // ── Datos del miembro ──────────────────────────────────────────────────
    const fechaUnion = member.joinedAt?.toLocaleDateString('es-ES', {
      day: 'numeric', month: 'short', year: 'numeric',
    }) ?? 'Desconocida';

    const roles = member.roles.cache
      .filter((r: any) => r.name !== '@everyone')
      .sort((a: any, b: any) => b.position - a.position)
      .map((r: any) => r.name)
      .slice(0, 8);

    const accentColor = getAccentColor(member);

    // ── Cosméticos equipados ───────────────────────────────────────────────
    let equippedFrame: string | null = null;
    let equippedTitle: string | null = null;
    let equippedColor: string | null = null;
    try {
      const cosmetics = await getEquipped(target.id, interaction.guild!.id);
      equippedFrame = cosmetics.equipped_frame;
      equippedTitle = cosmetics.equipped_title;
      equippedColor = cosmetics.equipped_color;
    } catch { /* usar defaults */ }

    // Si tiene color equipado, usarlo como accentColor
    const finalAccent = equippedColor
      ? (getColorHex(equippedColor) ?? accentColor)
      : accentColor;

    try {
      const buffer = await generateProfileCard({
        username:    target.username,
        avatarUrl:   target.displayAvatarURL({ size: 256, extension: 'png', forceStatic: true }),
        level, xp, xpNeeded, rank,
        accentColor:    finalAccent,
        joinedAt:       fechaUnion,
        roles,
        equippedFrame,
        equippedTitle,
        equippedColor,
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'perfil.png' });

      await interaction.editReply({
        files: [attachment],
        embeds: [{
          color: parseInt(accentColor.replace('#', ''), 16),
          image: { url: 'attachment://perfil.png' },
          footer: { text: `ID: ${target.id} • ${interaction.guild!.name}` },
        }],
      });
    } catch (error: any) {
      console.error('Error generando tarjeta de perfil:', error);
      // Fallback a embed de texto
      const pct = Math.min(Math.floor((xp / xpNeeded) * 100), 100);
      const bar = `${'█'.repeat(Math.floor(pct / 10))}${'░'.repeat(10 - Math.floor(pct / 10))}`;
      await interaction.editReply({
        embeds: [{
          author: { name: target.username, icon_url: target.displayAvatarURL() },
          color: parseInt(accentColor.replace('#', ''), 16),
          thumbnail: { url: target.displayAvatarURL({ size: 256 }) },
          fields: [
            { name: '🏆 Nivel', value: String(level), inline: true },
            { name: '🏅 Rank', value: `#${rank}`, inline: true },
            { name: '⭐ XP', value: `${xp.toLocaleString()} / ${xpNeeded.toLocaleString()}`, inline: true },
            { name: '📊 Progreso', value: `\`[${bar}]\` ${pct}%`, inline: false },
            { name: '📅 Miembro desde', value: fechaUnion, inline: true },
            { name: '🎭 Roles', value: roles.slice(0, 5).join(', ') || 'Ninguno', inline: false },
          ],
          footer: { text: `ID: ${target.id}` },
          timestamp: new Date().toISOString(),
        }],
      });
    }
  },
};

export default comando;
