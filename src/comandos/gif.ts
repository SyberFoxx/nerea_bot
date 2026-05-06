import { Comando } from '../types';
import axios from 'axios';

interface GiphyResponse {
  data: Array<{
    images: {
      original: {
        url: string;
      };
    };
  }>;
}

const comando: Comando = {
  nombre: 'gif',
  descripcion: 'Busca un GIF en Giphy',
  uso: '!gif <término>',
  ejecutar: async (message, args) => {
    try {
      const searchTerm = args.join(' ');
      if (!searchTerm) {
        return message.reply('¡Por favor proporciona una palabra para buscar un GIF!');
      }

      const apiKey = process.env.GIPHY_API_KEY;
      if (!apiKey) {
        console.error('GIPHY_API_KEY no encontrada en las variables de entorno');
        return message.reply('Error: No se ha configurado la API key de Giphy.');
      }

      console.log(`Buscando GIF para: "${searchTerm}"`);
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(searchTerm)}&limit=2`;

      const response = await axios.get<GiphyResponse>(url);
      const gifUrl = response.data.data[0]?.images?.original?.url;

      if (gifUrl) {
        message.reply(gifUrl);
      } else {
        message.reply('No se encontraron resultados para esa búsqueda.');
      }
    } catch (error: any) {
      console.error('Error al buscar el GIF:', error.message);
      message.reply('Ocurrió un error al buscar el GIF.');
    }
  },
};

export default comando;
