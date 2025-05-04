module.exports = {
    nombre: 'kick',
    ejecutar: async (message, args) => {
      if (!message.member.permissions.has('KICK_MEMBERS')) {
        return message.reply('No tienes permisos para expulsar a otros usuarios.');
      }
  
      const usuario = message.mentions.members.first();
      if (!usuario) {
        return message.reply('Por favor menciona al usuario que quieres expulsar.');
      }
  
      const razon = args.slice(1).join(' ') || 'Sin razón';
  
      try {
        await usuario.kick(razon);
        message.reply(`¡${usuario.user.tag} ha sido expulsado por ${razon}!`);
      } catch (error) {
        console.error(error);
        message.reply('Hubo un error al intentar expulsar al usuario.');
      }
    }
  };
  