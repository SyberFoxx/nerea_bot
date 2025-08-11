module.exports = {
  nombre: 'limpiar',
  ejecutar: async (message, args) => {
    if (!message.member.permissions.has('MANAGE_MESSAGES')) {
      return message.reply('No tienes permisos para limpiar mensajes.');
    }

    const cantidad = parseInt(args[0], 10);
    if (isNaN(cantidad) || cantidad <= 0 || cantidad > 100) {
      return message.reply('Por favor, proporciona un número válido de mensajes (de 1 a 100).');
    }

    try {
      await message.channel.bulkDelete(cantidad, true);
      message.channel.send(`Se han borrado ${cantidad} mensajes.`); // No hace referencia a ningún mensaje previo
    } catch (error) {
      console.error(error);
      message.reply('Hubo un error al intentar borrar los mensajes.');
    }
  }
};
