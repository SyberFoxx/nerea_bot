import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashComando } from '../../types';
import { buildSugerenciaModal } from '../../modals/index';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('sugerencia')
    .setDescription('Envía una sugerencia al servidor'),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    await interaction.showModal(buildSugerenciaModal());
  },
};

export default comando;
