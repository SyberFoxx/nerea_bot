module.exports = {
    nombre: 'palabra',
    ejecutar: async (message) => {
      const preguntas = [
        {
          pista: 'Es un lenguaje de programación muy usado en la web.',
          palabra: 'javascript'
        },
        {
          pista: 'Animal que ladra.',
          palabra: 'perro'
        },
        {
          pista: 'Dispositivo para hacer llamadas.',
          palabra: 'telefono'
        }
      ];
  
      const seleccionada = preguntas[Math.floor(Math.random() * preguntas.length)];
      const respuesta = seleccionada.palabra.toLowerCase();
  
      await message.channel.send(`🧠 **Adivina la Palabra**\nPista: *${seleccionada.pista}*\nTienes 30 segundos.`);
  
      const filter = m =>
        m.author.id === message.author.id;
  
      try {
        const collected = await message.channel.awaitMessages({
          filter,
          max: 1,
          time: 30000,
          errors: ['time']
        });
  
        const intento = collected.first().content.toLowerCase().trim();
  
        if (intento === respuesta) {
          message.reply('✅ ¡Correcto! Has adivinado la palabra.');
        } else {
          message.reply(`❌ Incorrecto. La palabra era **${respuesta}**.`);
        }
      } catch {
        message.reply(`⏰ Se acabó el tiempo. La palabra era **${respuesta}**.`);
      }
    }
  };
  