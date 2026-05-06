import { Comando } from '../types';

const comando: Comando = {
  nombre: '8ball',
  descripcion: 'Responde una pregunta con la bola mágica',
  uso: '!8ball <pregunta>',
  ejecutar: (message, args) => {
    if (args.length === 0) {
      message.reply('Hazme una pregunta.');
      return;
    }

    const respuestas: string[] = [
      'Sí.',
      'No.',
      'Tal vez.',
      'Definitivamente sí.',
      'No cuentes con ello.',
      'Probablemente.',
      'Pregunta de nuevo más tarde.',
      'No puedo decirte ahora.',
    ];

    const respuesta = respuestas[Math.floor(Math.random() * respuestas.length)];
    message.reply(`🎱 ${respuesta}`);
  },
};

export default comando;
