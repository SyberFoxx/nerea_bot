module.exports = {
    nombre: 'avisar',
    ejecutar: async (message, args) => {
      if (!message.member.permissions.has('ADMINISTRATOR')) {
        return message.reply('No tienes permisos para mandar advertencias.');
      }
  
      const usuario = message.mentions.members.first();
      if (!usuario) {
        return message.reply('Por favor menciona al usuario al que quieres mandar una advertencia.');
      }
  
      const texto = args.slice(1).join(' ');
      if (!texto) {
        return message.reply('Por favor proporciona un mensaje para la advertencia.');
      }
  
      try {
        message.channel.send(`⚠️ **Advertencia a ${usuario.user.tag}:** ${texto}`);
      } catch (error) {
        console.error(error);
        message.reply('Hubo un error al intentar mandar la advertencia.');
      }
    }
  };
  