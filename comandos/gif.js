require('dotenv').config();
const axios = require('axios');

module.exports = {
  nombre: 'gif',
  ejecutar: async (message, args) => {
    try {
      const searchTerm = args.join(' ');
      if (!searchTerm) {
        return message.reply('¡Por favor proporciona una palabra para buscar un GIF!');
      }

      const apiKey = process.env.GIPHY_API_KEY;
      
      // Verificar si la API key existe
      if (!apiKey) {
        console.error('GIPHY_API_KEY no encontrada en las variables de entorno');
        return message.reply('Error: No se ha configurado la API key de Giphy.');
      }

      console.log(`Buscando GIF para: "${searchTerm}"`);
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(searchTerm)}&limit=2`;

      const response = await axios.get(url);
      console.log('Respuesta de Giphy recibida:', response.status);
      
      const gifUrl = response.data.data[0]?.images?.original?.url;

      if (gifUrl) {
        console.log('GIF encontrado, enviando respuesta');
        message.reply(gifUrl);
      } else {
        console.log('No se encontraron GIFs para la búsqueda');
        message.reply('No se encontraron resultados para esa búsqueda.');
      }
    } catch (error) {
      console.error('Error completo al buscar el GIF:', error.message);
      console.error('Stack trace:', error.stack);
      
      if (error.response) {
        console.error('Status de respuesta:', error.response.status);
        console.error('Datos de respuesta:', error.response.data);
      }
      
      message.reply('Ocurrió un error al buscar el GIF. Revisa la consola para más detalles.');
    }
  }
};