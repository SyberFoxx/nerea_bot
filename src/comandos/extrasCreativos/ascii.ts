import figlet from 'figlet';
import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'ascii',
  descripcion: 'Convierte un texto en arte ASCII',
  uso: '!ascii <texto>',
  ejecutar: async (message, args) => {
    const texto = args.join(' ');
    if (!texto) return message.reply('Por favor, proporciona el texto que quieres convertir en ASCII.');

    try {
      const data = await new Promise<string>((resolve, reject) => {
        figlet(texto, (err, result) => {
          if (err || !result) reject(err ?? new Error('Sin resultado'));
          else resolve(result);
        });
      });
      (message.channel as any).send(`\`\`\`${data}\`\`\``);
    } catch (err) {
      console.error('Error al generar ASCII:', err);
      message.reply('Hubo un error al generar el arte ASCII.');
    }
  },
};

export default comando;
