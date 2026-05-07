import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, TextChannel } from 'discord.js';
import { SlashComando } from '../../types';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('limpiar')
    .setDescription('Elimina mensajes del canal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad de mensajes (1-100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(opt => opt.setName('usuario').setDescription('Filtrar por usuario (opcional)').setRequired(false)),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const cantidad = interaction.options.getInteger('cantidad', true);
    const target   = interaction.options.getUser('usuario');
    const channel  = interaction.channel as TextChannel;

    await interaction.deferReply({ ephemeral: true });

    try {
      let mensajes = await channel.messages.fetch({ limit: 100 });

      if (target) mensajes = mensajes.filter(m => m.author.id === target.id);
      const aEliminar = mensajes.first(cantidad);

      if (!aEliminar.length) {
        return interaction.editReply('❌ No se encontraron mensajes para eliminar.');
      }

      const eliminados = await channel.bulkDelete(aEliminar, true);

      await interaction.editReply({
        embeds: [{
          title: '🗑️ Mensajes eliminados',
          color: 0x2ecc71,
          fields: [
            { name: '📊 Eliminados', value: String(eliminados.size), inline: true },
            { name: '👤 Filtro', value: target ? target.tag : 'Todos', inline: true },
            { name: '👮 Moderador', value: interaction.user.tag, inline: true },
          ],
          footer: { text: 'Este mensaje se borrará en 5 segundos' },
          timestamp: new Date().toISOString(),
        }],
      });

      setTimeout(() => interaction.deleteReply().catch(() => {}), 5000);
    } catch (error: any) {
      await interaction.editReply(`❌ Error: ${error.message}`);
    }
  },
};

export default comando;
