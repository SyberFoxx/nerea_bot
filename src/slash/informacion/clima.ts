import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import { SlashComando } from '../../types';

interface WeatherResponse {
  current: { temp_c: number; feelslike_c: number; humidity: number; wind_kph: number; condition: { text: string; icon: string } };
  location: { name: string; country: string; localtime: string };
}

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('clima')
    .setDescription('Consulta el clima de cualquier ciudad')
    .addStringOption(opt =>
      opt.setName('ciudad').setDescription('Nombre de la ciudad').setRequired(true)
    ),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const ciudad = interaction.options.getString('ciudad', true);
    const apiKey = process.env.WEATHERAPI_KEY;

    if (!apiKey) {
      return interaction.reply({ content: '❌ No está configurada la API key del clima.', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      const res = await axios.get<WeatherResponse>(
        `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(ciudad)}&lang=es`
      );
      const { current, location } = res.data;

      await interaction.editReply({
        embeds: [{
          title: `🌤️ Clima en ${location.name}, ${location.country}`,
          color: 0x3498db,
          fields: [
            { name: '🌡️ Temperatura', value: `**${current.temp_c}°C**`, inline: true },
            { name: '🤔 Sensación', value: `${current.feelslike_c}°C`, inline: true },
            { name: '💧 Humedad', value: `${current.humidity}%`, inline: true },
            { name: '💨 Viento', value: `${current.wind_kph} km/h`, inline: true },
            { name: '☁️ Condición', value: current.condition.text, inline: true },
          ],
          thumbnail: { url: `https:${current.condition.icon}` },
          footer: { text: `Hora local: ${location.localtime}` },
          timestamp: new Date().toISOString(),
        }],
      });
    } catch {
      await interaction.editReply('❌ No se pudo obtener el clima para esa ciudad. Verifica el nombre.');
    }
  },
};

export default comando;
