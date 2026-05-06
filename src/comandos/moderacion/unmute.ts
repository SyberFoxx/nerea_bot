import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'unmute',
  descripcion: 'Quita el silencio a un usuario',
  uso: '!unmute @usuario',
  categoria: 'moderacion',
  ejecutar: async (message) => {
    if (!message.member?.permissions.has('MuteMembers'))
      return message.reply('No tienes permisos para desilenciar usuarios.');

    const usuario = message.mentions.members?.first();
    if (!usuario) return message.reply('Por favor menciona al usuario que quieres desilenciar.');

    try {
      await usuario.timeout(null);
      message.reply(`¡${usuario.user.tag} ha sido desilenciado!`);
    } catch (error) {
      console.error(error);
      message.reply('Hubo un error al intentar desilenciar al usuario.');
    }
  },
};

export default comando;
