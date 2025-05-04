require('dotenv').config();
const axios = require('axios');

module.exports = {
  nombre: 'gif',
  ejecutar: async (message, args) => {
    const searchTerm = args.join(' ');
    if (!searchTerm) {
      return message.reply('¡Por favor proporciona una palabra para buscar un GIF!');
    }

    const apiKey = process.env.GIPHY_API_KEY;
    const url = `https://api.giphy.com/v1/gifs/search?api_key=${apiKey}&q=${encodeURIComponent(searchTerm)}&limit=1`;

    try {
      const response = await axios.get(url);
      const gifUrl = response.data.data[0]?.images?.original?.url;

      if (gifUrl) {
        message.reply(gifUrl);
      } else {
        message.reply('No se encontraron resultados para esa búsqueda.');
      }
    } catch (error) {
      console.error('Error al buscar el GIF:', error);
      message.reply('Ocurrió un error al buscar el GIF.');
    }
  }
};