import { Comando } from '../../types';

const palabras = ['manzana', 'programacion', 'discord', 'javascript', 'perro', 'universo'];

const comando: Comando = {
  nombre: 'ahorcado',
  descripcion: 'Juego del ahorcado',
  uso: '!ahorcado',
  ejecutar: async (message) => {
    const palabra = palabras[Math.floor(Math.random() * palabras.length)];
    const letrasAdivinadas = new Set<string>();
    let intentos = 6;

    const ocultarPalabra = () =>
      palabra.split('').map(l => (letrasAdivinadas.has(l) ? l : '_')).join(' ');

    const juego = await (message.channel as any).send(
      `🎮 **Ahorcado**\nAdivina la palabra:\n\`${ocultarPalabra()}\`\nIntentos restantes: ${intentos}\nEscribe una letra.`
    );

    const collector = (message.channel as any).createMessageCollector({
      filter: (m: any) => m.author.id === message.author.id,
      time: 60_000,
    });

    collector.on('collect', (msg: any) => {
      const letra = msg.content.toLowerCase().trim();
      if (!/^[a-záéíóúñ]$/i.test(letra)) { msg.reply('Por favor escribe solo una letra válida.'); return; }

      if (palabra.includes(letra)) letrasAdivinadas.add(letra);
      else intentos--;

      const estado = ocultarPalabra();
      juego.edit(`🎮 **Ahorcado**\n\`${estado}\`\nIntentos restantes: ${intentos}`);

      if (!estado.includes('_')) collector.stop('ganaste');
      else if (intentos <= 0) collector.stop('perdiste');
    });

    collector.on('end', (_: any, motivo: string) => {
      if (motivo === 'ganaste') (message.channel as any).send(`🎉 ¡Correcto! La palabra era **${palabra}**.`);
      else if (motivo === 'perdiste') (message.channel as any).send(`💀 Perdiste. La palabra era **${palabra}**.`);
      else (message.channel as any).send('⏰ Tiempo agotado.');
    });
  },
};

export default comando;
