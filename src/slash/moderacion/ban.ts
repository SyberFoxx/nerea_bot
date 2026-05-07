import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { SlashComando } from '../../types';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Banea a un usuario del servidor')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName('usuario').setDescription('Usuario a banear').setRequired(true))
    .addStringOption(opt => opt.setName('razon').setDescription('Razón del baneo').setRequired(false))
    .addIntegerOption(opt => opt.setName('dias').setDescription('Días de mensajes a borrar (0-7)').setRequired(false).setMinValue(0).setMaxValue(7)),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const target = interaction.options.getUser('usuario', true);
    const razon  = interaction.options.getString('razon') ?? 'Sin razón especificada';
    const dias   = interaction.options.getInteger('dias') ?? 0;
    const member = interaction.guild?.members.cache.get(target.id);

    if (!member) return interaction.reply({ content: '❌ No se encontró al usuario en el servidor.', ephemeral: true });
    if (!member.bannable) return interaction.reply({ content: '❌ No puedo banear a este usuario (rol superior al mío).', ephemeral: true });
    if (target.id === interaction.user.id) return interaction.reply({ content: '❌ No puedes banearte a ti mismo.', ephemeral: true });

    try {
      await member.ban({ reason: `${razon} (por ${interaction.user.tag})`, deleteMessageSeconds: dias * 86400 });
      await interaction.reply({
        embeds: [{
          title: '🔨 Usuario Baneado',
          color: 0xe74c3c,
          thumbnail: { url: target.displayAvatarURL() },
          fields: [
            { name: '👤 Usuario', value: `${target.tag} (${target.id})`, inline: true },
            { name: '👮 Moderador', value: interaction.user.tag, inline: true },
            { name: '📝 Razón', value: razon, inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      });
    } catch (error: any) {
      await interaction.reply({ content: `❌ Error al banear: ${error.message}`, ephemeral: true });
    }
  },
};

export default comando;
