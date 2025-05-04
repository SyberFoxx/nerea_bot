module.exports = {
    nombre: 'mute',
    ejecutar: async (message, args) => {
      if (!message.member.permissions.has('MUTE_MEMBERS')) {
        return message.reply('No tienes permisos para silenciar a otros usuarios.');
      }
  
      const usuario = message.mentions.members.first();
      if (!usuario) {
        return message.reply('Por favor menciona al usuario que quieres silenciar.');
      }
  
      const tiempo = args[1] ? parseInt(args[1], 10) : 0;
      if (!tiempo) {
        return message.reply('Por favor proporciona un tiempo válido (en minutos).');
      }
  
      try {
        await usuario.timeout(tiempo * 60000);
        message.reply(`¡${usuario.user.tag} ha sido silenciado por ${tiempo} minuto(s)!`);
  
        // Si hay un tiempo, luego de ese tiempo se desilencia automáticamente.
        setTimeout(() => {
          usuario.timeout(null);
          message.channel.send(`El silencio de ${usuario.user.tag} ha sido levantado.`);
        }, tiempo * 60000);
      } catch (error) {
        console.error(error);
        message.reply('Hubo un error al intentar silenciar al usuario.');
      }
    }
  };
  