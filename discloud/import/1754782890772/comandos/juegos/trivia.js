module.exports = {
    nombre: 'trivia',
    ejecutar: async (message) => {
      const preguntas = [
        {
          pregunta: '¿Cuál es el planeta más grande del sistema solar?',
          opciones: ['A) Marte', 'B) Tierra', 'C) Júpiter', 'D) Venus'],
          respuesta: 'C'
        },
        {
          pregunta: '¿Quién escribió "Cien años de soledad"?',
          opciones: ['A) Mario Vargas Llosa', 'B) Gabriel García Márquez', 'C) Pablo Neruda', 'D) Julio Cortázar'],
          respuesta: 'B'
        },
        {
          pregunta: '¿Cuál es el símbolo químico del oro?',
          opciones: ['A) Ag', 'B) Go', 'C) Au', 'D) Gd'],
          respuesta: 'C'
        }
      ];
  
      const seleccionada = preguntas[Math.floor(Math.random() * preguntas.length)];
  
      await message.channel.send(
        `🧠 **Trivia**\n${seleccionada.pregunta}\n${seleccionada.opciones.join('\n')}\n\nResponde con A, B, C o D.`
      );
  
      const filter = m =>
        m.author.id === message.author.id &&
        /^[A-Da-d]$/.test(m.content.trim());
  
      try {
        const collected = await message.channel.awaitMessages({
          filter,
          max: 1,
          time: 20000,
          errors: ['time']
        });
  
        const respuestaUsuario = collected.first().content.toUpperCase();
        if (respuestaUsuario === seleccionada.respuesta) {
          message.reply('✅ ¡Correcto!');
        } else {
          message.reply(`❌ Incorrecto. La respuesta correcta era **${seleccionada.respuesta}**.`);
        }
      } catch {
        message.reply('⏰ Se acabó el tiempo para responder.');
      }
    }
  };
  