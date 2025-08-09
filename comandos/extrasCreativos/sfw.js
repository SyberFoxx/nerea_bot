const axios = require('axios');

module.exports = {
  nombre: 'sfw',
  descripcion: 'Muestra una imagen SFW (Safe For Work)',
  async ejecutar(message, args) {
    try {
      // Verificar si el usuario proporcionó una categoría
      const categoria = args[0] || 'waifu';
      
      // Mapeo de categorías para diferentes APIs
      const categoriasWaifu = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'];
      const categoriasNekos = ['neko', 'waifu', 'hug', 'pat', 'kiss', 'tickle', 'poke', 'feed', 'cuddle', 'slap', 'smug', 'baka', 'happy'];

      console.log(`Buscando imagen SFW de categoría: ${categoria}`);
      
      let imageUrl = null;
      let apiUsada = '';

      // Intentar primero con waifu.pics (más categorías SFW)
      if (categoriasWaifu.includes(categoria.toLowerCase())) {
        try {
          const response = await axios.get(`https://api.waifu.pics/sfw/${categoria.toLowerCase()}`);
          if (response.data && response.data.url) {
            imageUrl = response.data.url;
            apiUsada = 'waifu.pics';
          }
        } catch (error) {
          console.log(`Error con waifu.pics: ${error.message}`);
        }
      }

      // Si waifu.pics falló, intentar con nekos.life
      if (!imageUrl && categoriasNekos.includes(categoria.toLowerCase())) {
        try {
          const response = await axios.get(`https://nekos.life/api/v2/img/${categoria.toLowerCase()}`);
          if (response.data && response.data.url) {
            imageUrl = response.data.url;
            apiUsada = 'nekos.life';
          }
        } catch (error) {
          console.log(`Error con nekos.life: ${error.message}`);
        }
      }

      // Fallback: si es una categoría no disponible, usar una por defecto
      if (!imageUrl) {
        const alternativas = ['waifu', 'neko', 'pat', 'hug'];
        
        for (const alt of alternativas) {
          try {
            const response = await axios.get(`https://api.waifu.pics/sfw/${alt}`);
            if (response.data && response.data.url) {
              imageUrl = response.data.url;
              apiUsada = `waifu.pics (${alt} como alternativa)`;
              break;
            }
          } catch (error) {
            console.log(`Error con alternativa ${alt}: ${error.message}`);
          }
        }
      }

      // Si ninguna API funcionó
      if (!imageUrl) {
        const todasCategorias = [...new Set([...categoriasWaifu, ...categoriasNekos])];
        
        if (!todasCategorias.includes(categoria.toLowerCase())) {
          return message.reply(
            `❌ Categoría no válida. Categorías populares:\n\`waifu\`, \`neko\`, \`hug\`, \`pat\`, \`kiss\`, \`cuddle\`, \`smile\`, \`dance\`, \`happy\`\n\n` +
            `Uso: \`!sfw [categoría]\`\nEjemplo: \`!sfw waifu\``
          );
        } else {
          return message.reply(`❌ La categoría "${categoria}" no está disponible en este momento. Prueba con: \`waifu\`, \`neko\`, \`hug\`, o \`pat\``);
        }
      }

      // Crear embed para mostrar la imagen
      const embed = {
        title: `✨ ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`,
        image: {
          url: imageUrl
        },
        color: 0x00FF7F,
        footer: {
          text: `Powered by ${apiUsada}`
        }
      };

      console.log(`Imagen SFW encontrada usando ${apiUsada}, enviando respuesta`);
      await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error general al obtener imagen SFW:', error.message);
      message.reply('❌ Ocurrió un error inesperado. Inténtalo de nuevo más tarde.');
    }
  }
};
