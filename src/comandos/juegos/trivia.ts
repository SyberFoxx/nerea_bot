import { Comando } from '../../types';

interface Pregunta {
  pregunta: string;
  opciones: string[];
  respuesta: string;
}

const preguntas: Pregunta[] = [
  { pregunta: '¿Cuál es el planeta más grande del sistema solar?', opciones: ['A) Marte', 'B) Tierra', 'C) Júpiter', 'D) Venus'], respuesta: 'C' },
  { pregunta: '¿Quién escribió "Cien años de soledad"?', opciones: ['A) Mario Vargas Llosa', 'B) Gabriel García Márquez', 'C) Pablo Neruda', 'D) Julio Cortázar'], respuesta: 'B' },
  { pregunta: '¿Cuál es el símbolo químico del oro?', opciones: ['A) Ag', 'B) Go', 'C) Au', 'D) Gd'], respuesta: 'C' },
];

const comando: Comando = {
  nombre: 'trivia',
  descripcion: 'Responde una pregunta de trivia',
  uso: '!trivia',
  ejecutar: async (message) => {
    const sel = preguntas[Math.floor(Math.random() * preguntas.length)];
    await (message.channel as any).send(
      `🧠 **Trivia**\n${sel.pregunta}\n${sel.opciones.join('\n')}\n\nResponde con A, B, C o D.`
    );

    const filter = (m: any) => m.author.id === message.author.id && /^[A-Da-d]$/.test(m.content.trim());
    try {
      const collected = await (message.channel as any).awaitMessages({ filter, max: 1, time: 20_000, errors: ['time'] });
      const resp = collected.first().content.toUpperCase();
      message.reply(resp === sel.respuesta ? '✅ ¡Correcto!' : `❌ Incorrecto. La respuesta era **${sel.respuesta}**.`);
    } catch {
      message.reply('⏰ Se acabó el tiempo.');
    }
  },
};

export default comando;
