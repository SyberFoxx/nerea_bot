import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'avisar',
  descripcion: 'Envía una advertencia a un usuario',
  uso: '!avisar @usuario <mensaje>',
  categoria: 'moderacion',
  ejecutar: async (message, args) => {
    if (!message.member?.permissions.has('Administrator'))
      return message.reply('No tienes permisos para mandar advertencias.');

    const usuario = message.mentions.members?.first();
    if (!usuario) return message.reply('Por favor menciona al usuario al que quieres advertir.');

    const texto = args.slice(1).join(' ');
    if (!texto) return message.reply('Por favor proporciona un mensaje para la advertencia.');

    try {
      await (message.channel as any).send(`⚠️ **Advertencia a ${usuario.user.tag}:** ${texto}`);
    } catch (error) {
      console.error(error);
      message.reply('Hubo un error al intentar mandar la advertencia.');
    }
  },
};

export default comando;
