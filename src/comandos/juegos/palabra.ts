import { Comando } from '../../types';

interface PreguntaPalabra {
  pista: string;
  palabra: string;
}

const preguntas: PreguntaPalabra[] = [
  { pista: 'Es un lenguaje de programación muy usado en la web.', palabra: 'javascript' },
  { pista: 'Animal que ladra.', palabra: 'perro' },
  { pista: 'Dispositivo para hacer llamadas.', palabra: 'telefono' },
];

const comando: Comando = {
  nombre: 'palabra',
  descripcion: 'Adivina la palabra con una pista',
  uso: '!palabra',
  ejecutar: async (message) => {
    const sel = preguntas[Math.floor(Math.random() * preguntas.length)];
    await (message.channel as any).send(`🧠 **Adivina la Palabra**\nPista: *${sel.pista}*\nTienes 30 segundos.`);

    const filter = (m: any) => m.author.id === message.author.id;
    try {
      const collected = await (message.channel as any).awaitMessages({ filter, max: 1, time: 30_000, errors: ['time'] });
      const intento = collected.first().content.toLowerCase().trim();
      message.reply(intento === sel.palabra ? '✅ ¡Correcto!' : `❌ Incorrecto. La palabra era **${sel.palabra}**.`);
    } catch {
      message.reply(`⏰ Tiempo agotado. La palabra era **${sel.palabra}**.`);
    }
  },
};

export default comando;
