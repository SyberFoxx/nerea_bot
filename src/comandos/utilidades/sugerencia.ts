import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'sugerencia',
  descripcion: 'Envía una sugerencia al canal de sugerencias',
  uso: '!sugerencia <texto>',
  ejecutar: async (message, args) => {
    const sugerencia = args.join(' ');
    if (!sugerencia) return message.reply('Por favor, proporciona una sugerencia.');

    const canal = message.guild?.channels.cache.find(c => c.name === 'sugerencias') as any;
    if (!canal) return message.reply('No se encontró el canal de sugerencias.');

    await canal.send(`💡 **Sugerencia de ${message.author.tag}**: ${sugerencia}`);
    message.reply('Tu sugerencia ha sido enviada.');
  },
};

export default comando;
