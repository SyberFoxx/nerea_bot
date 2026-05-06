import axios from 'axios';
import { Comando } from '../../types';

interface WeatherResponse {
  current: {
    temp_c: number;
    condition: { text: string };
  };
}

const comando: Comando = {
  nombre: 'clima',
  descripcion: 'Consulta el clima de una ciudad',
  uso: '!clima <ciudad>',
  ejecutar: async (message, args) => {
    if (!args.length) return message.reply('Por favor, ingresa el nombre de una ciudad.');

    const ciudad = args.join(' ');
    const apiKey = process.env.WEATHERAPI_KEY;

    try {
      const response = await axios.get<WeatherResponse>(
        `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${ciudad}&lang=es`
      );
      const { temp_c, condition } = response.data.current;
      message.reply(`El clima en ${ciudad} es de ${temp_c}°C con ${condition.text}.`);
    } catch (error) {
      console.error(error);
      message.reply('No se pudo obtener el clima para esa ciudad.');
    }
  },
};

export default comando;
