const axios = require('axios');  

module.exports = {
  nombre: 'clima',
  ejecutar: async (message, args) => {
    if (!args.length) {
      return message.reply('Por favor, ingresa el nombre de una ciudad.');
    }

    const ciudad = args.join(' ');
    const apiKey = process.env.WEATHERAPI_KEY;  // API Key de WeatherAPI

    try {
      const response = await axios.get(`http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${ciudad}&lang=es`);
      const temperatura = response.data.current.temp_c;
      const descripcion = response.data.current.condition.text;
      message.reply(`El clima en ${ciudad} es de ${temperatura}°C con ${descripcion}.`);
    } catch (error) {
      console.error(error);
      message.reply('No se pudo obtener el clima para esa ciudad.');
    }
  }
};
