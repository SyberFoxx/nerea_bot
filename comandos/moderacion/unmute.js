module.exports = {
    nombre: 'unmute',
    ejecutar: async (message, args) => {
      if (!message.member.permissions.has('MUTE_MEMBERS')) {
        return message.reply('No tienes permisos para desilenciar a otros usuarios.');
      }
  
      const usuario = message.mentions.members.first();
      if (!usuario) {
        return message.reply('Por favor menciona al usuario que quieres desilenciar.');
      }
  
      try {
        await usuario.timeout(null);
        message.reply(`¡${usuario.user.tag} ha sido desilenciado!`);
      } catch (error) {
        console.error(error);
        message.reply('Hubo un error al intentar desilenciar al usuario.');
      }
    }
  };
  