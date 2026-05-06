import axios from 'axios';
import { Comando } from '../../types';

interface WikiResponse {
  extract: string;
}

const comando: Comando = {
  nombre: 'wiki',
  descripcion: 'Busca un resumen en Wikipedia',
  uso: '!wiki <tema>',
  ejecutar: async (message, args) => {
    if (!args.length) return message.reply('Por favor, proporciona un tema para buscar en Wikipedia.');

    const tema = args.join(' ');
    try {
      const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(tema)}`;
      const response = await axios.get<WikiResponse>(url);
      message.reply(`Resumen de ${tema}: ${response.data.extract}`);
    } catch (error) {
      console.error(error);
      message.reply('No se pudo encontrar un resumen para ese tema.');
    }
  },
};

export default comando;
