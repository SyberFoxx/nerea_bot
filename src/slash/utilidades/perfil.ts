import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder } from 'discord.js';
import { SlashComando } from '../../types';
import { generateProfileCard } from '../../canvas/imageUtils';

const xpSystem = require('../../sistemas/xpSystem');

// Colores de acento por rol más alto
function getAccentColor(member: any): string {
  const topRole = member.roles.cache
    .filter((r: any) => r.color !== 0)
    .sort((a: any, b: any) => b.position - a.position)
    .first();
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
    const member = interaction.guild?.members.cache.get(target.id);
    if (!member) return interaction.reply({ content: '❌ No se encontró al usuario.', ephemeral: true });

    await interaction.deferReply();

    try {
      // Datos de XP
      let level = 1, xp = 0, xpNeeded = 100, rank = 1;
      try {
        const xpData = await xpSystem.getUserXP(target.id, interaction.guild!.id);
        level    = xpData.level;
        xp       = xpData.xp;
        xpNeeded = xpData.xpForNextLevel;

        // Calcular rank
        const leaderboard = await xpSystem.getLeaderboard(interaction.guild!.id, 100);
        const pos = leaderboard.findIndex((r: any) => r.user_id === target.id);
        rank = pos >= 0 ? pos + 1 : leaderboard.length + 1;
      } catch { /* XP no disponible */ }

      const fechaUnion = member.joinedAt?.toLocaleDateString('es-ES', {
        day: 'numeric', month: 'short', year: 'numeric',
      }) ?? 'Desconocida';

      const roles = member.roles.cache
        .filter((r: any) => r.name !== '@everyone')
        .sort((a: any, b: any) => b.position - a.position)
        .map((r: any) => r.name);

      const accentColor = getAccentColor(member);

      const buffer = await generateProfileCard({
        username:    target.username,
        avatarUrl:   target.displayAvatarURL({ size: 256, extension: 'png' }),
        level, xp, xpNeeded, rank,
        accentColor,
        joinedAt: fechaUnion,
        roles,
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'perfil.png' });

      await interaction.editReply({
        content: ``,
        files: [attachment],
        embeds: [{
          color: parseInt(accentColor.replace('#', ''), 16),
          footer: { text: `ID: ${target.id}` },
          image: { url: 'attachment://perfil.png' },
        }],
      });
    } catch (error: any) {
      console.error('Error generando perfil:', error);
      await interaction.editReply('❌ Error al generar la tarjeta de perfil.');
    }
  },
};

export default comando;
