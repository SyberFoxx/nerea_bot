import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashComando } from '../../types';
import { buildReporteModal } from '../../modals/index';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('reporte')
    .setDescription('Reporta a un usuario a los moderadores'),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    await interaction.showModal(buildReporteModal());
  },
};

export default comando;
