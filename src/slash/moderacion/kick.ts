import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashComando } from '../../types';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Expulsa a un usuario del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a expulsar').setRequired(true))
    .addStringOption(opt => opt.setName('razon').setDescription('Razón de la expulsión').setRequired(false)),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getUser('usuario', true);
    const razon  = interaction.options.getString('razon') ?? 'Sin razón especificada';
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: '❌ No se encontró al usuario.', ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: '❌ No puedo expulsar a este usuario.', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ No puedes expulsarte a ti mismo.', ephemeral: true });

    try {
      await member.kick(`${razon} (por ${interaction.user.tag})`);
      await interaction.reply({
        embeds: [{
          title: '👢 Usuario Expulsado',
          color: 0xe67e22,
          thumbnail: { url: target.displayAvatarURL() },
          fields: [
            { name: '👤 Usuario', value: `${target.tag}`, inline: true },
            { name: '👮 Moderador', value: interaction.user.tag, inline: true },
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
