const axios = require('axios');

module.exports = {
  nombre: 'wiki',
  ejecutar: async (message, args) => {
    if (!args.length) {
      return message.reply('Por favor, proporciona un tema para buscar en Wikipedia.');
    }

    // Unimos los argumentos para formar el tema
    const tema = args.join(' ');

    try {
      // Codificamos el tema para que los espacios y caracteres especiales sean manejados correctamente
      const url = `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(tema)}`;
      
      const response = await axios.get(url);
      const resumen = response.data.extract;
      
      // Respondemos con el resumen obtenido
      message.reply(`Resumen de ${tema}: ${resumen}`);
    } catch (error) {
      console.error(error);
      message.reply('No se pudo encontrar un resumen para ese tema.');
    }
  }
};
