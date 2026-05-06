import { Comando } from '../../types';

interface Pregunta {
  pregunta: string;
  opciones: string[];
  respuesta: string;
}

const preguntas: Pregunta[] = [
  { pregunta: '¿En qué año se fundó Google?', opciones: ['A) 1996', 'B) 1998', 'C) 2000', 'D) 2002'], respuesta: 'B' },
  { pregunta: '¿Cuál es la capital de Australia?', opciones: ['A) Sydney', 'B) Melbourne', 'C) Canberra', 'D) Brisbane'], respuesta: 'C' },
  { pregunta: '¿Qué órgano produce insulina?', opciones: ['A) Hígado', 'B) Riñón', 'C) Páncreas', 'D) Estómago'], respuesta: 'C' },
];

const comando: Comando = {
  nombre: 'quiz',
  descripcion: 'Quiz de 3 preguntas seguidas',
  uso: '!quiz',
  ejecutar: async (message) => {
    let puntuacion = 0;
    const filter = (m: any) => m.author.id === message.author.id && /^[A-Da-d]$/.test(m.content.trim());

    for (let i = 0; i < preguntas.length; i++) {
      const p = preguntas[i];
      await (message.channel as any).send(
        `📚 **Pregunta ${i + 1}**:\n${p.pregunta}\n${p.opciones.join('\n')}\n\nResponde con A, B, C o D.`
      );
      try {
        const collected = await (message.channel as any).awaitMessages({ filter, max: 1, time: 20_000, errors: ['time'] });
        const resp = collected.first().content.toUpperCase();
        if (resp === p.respuesta) { puntuacion++; await (message.channel as any).send('✅ ¡Correcto!'); }
        else await (message.channel as any).send(`❌ Incorrecto. Era **${p.respuesta}**.`);
      } catch {
        await (message.channel as any).send('⏰ Tiempo agotado para esta pregunta.');
      }
    }

    (message.channel as any).send(`🎉 ¡Quiz terminado! Puntuación: **${puntuacion}/${preguntas.length}**`);
  },
};

export default comando;
