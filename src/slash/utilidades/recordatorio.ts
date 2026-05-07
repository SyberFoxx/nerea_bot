import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashComando } from '../../types';
import { buildRecordatorioModal } from '../../modals/index';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('recordatorio')
    .setDescription('Programa un recordatorio con un formulario'),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    await interaction.showModal(buildRecordatorioModal());
  },
};

export default comando;
