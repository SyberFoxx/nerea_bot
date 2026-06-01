const axios = require('axios');

module.exports = {
  nombre: 'nsfw',
  descripcion: 'Muestra una imagen NSFW (solo en canales NSFW)',
  async ejecutar(message, args) {
    try {
      // Verificar si el canal es NSFW
      if (!message.channel.nsfw) {
        return message.reply('❌ Este comando solo puede usarse en canales marcados como NSFW.');
      }

      // Verificar si el usuario proporcionó una categoría
      const categoria = args[0] || 'neko';
      
      // Mapeo de categorías para diferentes APIs
      const categoriasWaifu = ['waifu', 'neko', 'trap', 'blowjob'];
      const categoriasNekobot = ['hentai', 'hass', 'hmidriff', 'pgif', '4k', 'hentai_anal', 'yaoi', 'tentacle'];
      const categoriasNekos = ['neko', 'waifu', 'trap', 'blowjob', 'pussy', 'feet', 'yuri', 'anal', 'avatar', 'ero', 'cum'];

      console.log(`Buscando imagen NSFW de categoría: ${categoria}`);
      
      let imageUrl = null;
      let apiUsada = '';

      // Intentar primero con waifu.pics (más confiable para categorías básicas)
      if (categoriasWaifu.includes(categoria.toLowerCase())) {
        try {
          const response = await axios.get(`https://api.waifu.pics/nsfw/${categoria.toLowerCase()}`);
          if (response.data && response.data.url) {
            imageUrl = response.data.url;
            apiUsada = 'waifu.pics';
          }
        } catch (error) {
          console.log(`Error con waifu.pics: ${error.message}`);
        }
      }

      // Si waifu.pics falló, intentar con nekobot.xyz para categorías específicas
      if (!imageUrl && categoriasNekobot.includes(categoria.toLowerCase())) {
        try {
          const response = await axios.get(`https://nekobot.xyz/api/image?type=${categoria.toLowerCase()}`);
          if (response.data && response.data.message) {
            imageUrl = response.data.message;
            apiUsada = 'nekobot.xyz';
          }
        } catch (error) {
          console.log(`Error con nekobot.xyz: ${error.message}`);
        }
      }

      // Si las anteriores fallaron, intentar con nekos.life
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

      // Fallback adicional: si es una categoría problemática, usar una alternativa
      if (!imageUrl) {
        const alternativas = {
          'yuri': 'waifu',
          'feet': 'neko',
          'anal': 'hentai',
          'cum': 'neko',
          'ero': 'waifu',
          'pussy': 'neko'
        };

        if (alternativas[categoria.toLowerCase()]) {
          console.log(`Intentando categoría alternativa: ${alternativas[categoria.toLowerCase()]}`);
          try {
            const response = await axios.get(`https://api.waifu.pics/nsfw/${alternativas[categoria.toLowerCase()]}`);
            if (response.data && response.data.url) {
              imageUrl = response.data.url;
              apiUsada = 'waifu.pics (alternativa)';
            }
          } catch (error) {
            console.log(`Error con alternativa: ${error.message}`);
          }
        }
      }

      // Si ninguna API funcionó
      if (!imageUrl) {
        const todasCategorias = [...new Set([...categoriasWaifu, ...categoriasNekobot, ...categoriasNekos])];
        
        if (!todasCategorias.includes(categoria.toLowerCase())) {
          return message.reply(
            `❌ Categoría no válida. Categorías disponibles:\n\`${todasCategorias.join('`, `')}\`\n\n` +
            `Uso: \`!nsfw [categoría]\`\nEjemplo: \`!nsfw neko\``
          );
        } else {
          return message.reply(`❌ La categoría "${categoria}" no está disponible en este momento. Prueba con: \`neko\`, \`waifu\`, \`trap\`, o \`blowjob\``);
        }
      }

      // Crear embed para mostrar la imagen
      const embed = {
        title: `🔞 ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`,
        image: {
          url: imageUrl
        },
        color: 0xFF69B4,
        footer: {
          text: `Powered by ${apiUsada}`
        }
      };

      console.log(`Imagen NSFW encontrada usando ${apiUsada}, enviando respuesta`);
      await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error general al obtener imagen NSFW:', error.message);
      message.reply('❌ Ocurrió un error inesperado. Inténtalo de nuevo más tarde.');
    }
  }
};
