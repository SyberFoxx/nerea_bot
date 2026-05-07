import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import { SlashComando } from '../../types';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('wiki')
    .setDescription('Busca un resumen en Wikipedia')
    .addStringOption(opt =>
      opt.setName('tema').setDescription('Tema a buscar').setRequired(true)
    ),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const tema = interaction.options.getString('tema', true);
    await interaction.deferReply();

    try {
      const res = await axios.get<{ extract: string; content_urls: { desktop: { page: string } }; thumbnail?: { source: string } }>(
        `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(tema)}`
      );
      const { extract, content_urls, thumbnail } = res.data;
      const resumen = extract.length > 1000 ? extract.slice(0, 1000) + '...' : extract;

      await interaction.editReply({
        embeds: [{
          title: `📖 ${tema}`,
          description: resumen,
          color: 0x95a5a6,
          url: content_urls.desktop.page,
          thumbnail: thumbnail ? { url: thumbnail.source } : undefined,
          footer: { text: 'Fuente: Wikipedia' },
        }],
      });
    } catch {
      await interaction.editReply('❌ No se encontró información sobre ese tema en Wikipedia.');
    }
  },
};

export default comando;
