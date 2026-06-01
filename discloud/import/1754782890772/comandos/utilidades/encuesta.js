module.exports = {
    nombre: 'encuesta',
    ejecutar: async (message, args) => {
      if (args.length < 3) {
        return message.reply('Uso: !encuesta <pregunta> | <opción1> | <opción2> | ...');
      }
  
      const pregunta = args.shift();
      const opciones = args.join(' ').split('|').map(opcion => opcion.trim());
  
      let encuesta = `📊 **Encuesta**: ${pregunta}\n\n`;
      opciones.forEach((opcion, index) => {
        encuesta += `${index + 1}. ${opcion}\n`;
      });
  
      const mensajeEncuesta = await message.channel.send(encuesta);
      for (let i = 0; i < opciones.length; i++) {
        await mensajeEncuesta.react(`${i + 1}️⃣`);
      }
    }
  };
  