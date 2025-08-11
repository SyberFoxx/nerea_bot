const palabras = ['manzana', 'programacion', 'discord', 'javascript', 'perro', 'universo'];

module.exports = {
  nombre: 'ahorcado',
  ejecutar: async (message) => {
    const palabra = palabras[Math.floor(Math.random() * palabras.length)];
    const letrasAdivinadas = new Set();
    let intentos = 6;

    const ocultarPalabra = () =>
      palabra.split('').map(l => (letrasAdivinadas.has(l) ? l : '_')).join(' ');

    const filtro = m => m.author.id === message.author.id;

    const juego = await message.channel.send(
      `🎮 **Ahorcado**\nAdivina la palabra:\n\`${ocultarPalabra()}\`\nIntentos restantes: ${intentos}\nEscribe una letra.`
    );

    const collector = message.channel.createMessageCollector({ filter: filtro, time: 60000 });

    collector.on('collect', msg => {
      const letra = msg.content.toLowerCase().trim();

      if (!/^[a-záéíóúñ]$/i.test(letra)) {
        msg.reply('Por favor, escribe solo una letra válida.');
        return;
      }

      if (palabra.includes(letra)) {
        letrasAdivinadas.add(letra);
      } else {
        intentos--;
      }

      const estado = ocultarPalabra();
      juego.edit(`🎮 **Ahorcado**\n\`${estado}\`\nIntentos restantes: ${intentos}`);

      if (!estado.includes('_')) {
        collector.stop('ganaste');
      } else if (intentos <= 0) {
        collector.stop('perdiste');
      }
    });

    collector.on('end', (_, motivo) => {
      if (motivo === 'ganaste') {
        message.channel.send(`🎉 ¡Correcto! La palabra era **${palabra}**.`);
      } else if (motivo === 'perdiste') {
        message.channel.send(`💀 Perdiste. La palabra era **${palabra}**.`);
      } else {
        message.channel.send('⏰ Tiempo agotado.');
      }
    });
  }
};
