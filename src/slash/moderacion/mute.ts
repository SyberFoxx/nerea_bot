import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashComando } from '../../types';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Silencia a un usuario temporalmente')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a silenciar').setRequired(true))
    .addIntegerOption(opt => opt.setName('minutos').setDescription('Duración en minutos (1-40320)').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(opt => opt.setName('razon').setDescription('Razón').setRequired(false)),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const target  = interaction.options.getUser('usuario', true);
    const minutos = interaction.options.getInteger('minutos', true);
    const razon   = interaction.options.getString('razon') ?? 'Sin razón especificada';
    const member  = interaction.guild?.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: '❌ No se encontró al usuario.', ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: '❌ No puedo silenciar a este usuario.', ephemeral: true });

    try {
      await member.timeout(minutos * 60_000, `${razon} (por ${interaction.user.tag})`);

      const hasta = Math.floor((Date.now() + minutos * 60_000) / 1000);
      await interaction.reply({
        embeds: [{
          title: '🔇 Usuario Silenciado',
          color: 0xf39c12,
          thumbnail: { url: target.displayAvatarURL() },
          fields: [
            { name: '👤 Usuario', value: target.tag, inline: true },
            { name: '👮 Moderador', value: interaction.user.tag, inline: true },
            { name: '⏱️ Duración', value: `${minutos} minuto(s)`, inline: true },
            { name: '🕐 Hasta', value: `<t:${hasta}:R>`, inline: true },
            { name: '📝 Razón', value: razon, inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      });
    } catch (error: any) {
      await interaction.reply({ content: `❌ Error: ${error.message}`, ephemeral: true });
    }
  },
};

export default comando;
