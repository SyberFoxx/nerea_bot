import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'ban',
  descripcion: 'Banea a un usuario del servidor',
  uso: '!ban @usuario [razón]',
  categoria: 'moderacion',
  ejecutar: async (message, args) => {
    if (!message.member?.permissions.has('BanMembers'))
      return message.reply('No tienes permisos para banear usuarios.');

    const usuario = message.mentions.members?.first();
    if (!usuario) return message.reply('Por favor menciona al usuario que quieres banear.');

    const razon = args.slice(1).join(' ') || 'Sin razón';
    try {
      await usuario.ban({ reason: razon });
      message.reply(`¡${usuario.user.tag} ha sido baneado por ${razon}!`);
    } catch (error) {
      console.error(error);
      message.reply('Hubo un error al intentar banear al usuario.');
    }
  },
};

export default comando;
