import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashComando } from '../../types';
import { buildEncuestaModal } from '../../modals/index';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('encuesta')
    .setDescription('Crea una encuesta interactiva con un formulario'),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    await interaction.showModal(buildEncuestaModal());
  },
};

export default comando;
