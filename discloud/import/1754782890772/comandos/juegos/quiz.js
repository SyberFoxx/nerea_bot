module.exports = {
    nombre: 'quiz',
    ejecutar: async (message) => {
      const preguntas = [
        {
          pregunta: '¿En qué año se fundó Google?',
          opciones: ['A) 1996', 'B) 1998', 'C) 2000', 'D) 2002'],
          respuesta: 'B'
        },
        {
          pregunta: '¿Cuál es la capital de Australia?',
          opciones: ['A) Sydney', 'B) Melbourne', 'C) Canberra', 'D) Brisbane'],
          respuesta: 'C'
        },
        {
          pregunta: '¿Qué órgano del cuerpo produce insulina?',
          opciones: ['A) Hígado', 'B) Riñón', 'C) Páncreas', 'D) Estómago'],
          respuesta: 'C'
        }
      ];
  
      let puntuacion = 0;
  
      for (let i = 0; i < preguntas.length; i++) {
        const p = preguntas[i];
  
        await message.channel.send(
          `📚 **Pregunta ${i + 1}**:\n${p.pregunta}\n${p.opciones.join('\n')}\n\nResponde con A, B, C o D.`
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
          if (respuestaUsuario === p.respuesta) {
            puntuacion++;
            await message.channel.send('✅ ¡Correcto!');
          } else {
            await message.channel.send(`❌ Incorrecto. La respuesta era **${p.respuesta}**.`);
          }
        } catch {
          await message.channel.send('⏰ Tiempo agotado para esta pregunta.');
        }
      }
  
      message.channel.send(`🎉 ¡Has terminado el quiz! Puntuación: **${puntuacion}/${preguntas.length}**`);
    }
  };
  