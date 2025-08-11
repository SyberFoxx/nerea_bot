module.exports = {
    nombre: 'ban',
    ejecutar: async (message, args) => {
      if (!message.member.permissions.has('BAN_MEMBERS')) {
        return message.reply('No tienes permisos para banear a otros usuarios.');
      }
  
      const usuario = message.mentions.members.first();
      if (!usuario) {
        return message.reply('Por favor menciona al usuario que quieres banear.');
      }
  
      const razon = args.slice(1).join(' ') || 'Sin razón';
  
      try {
        await usuario.ban({ reason: razon });
        message.reply(`¡${usuario.user.tag} ha sido baneado por ${razon}!`);
      } catch (error) {
        console.error(error);
        message.reply('Hubo un error al intentar banear al usuario.');
      }
    }
  };
  