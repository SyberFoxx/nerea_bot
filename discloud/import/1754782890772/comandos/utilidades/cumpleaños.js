const cumpleaños = new Map();

module.exports = {
  nombre: 'cumpleaños',
  ejecutar: async (message, args) => {
    if (args[0] === 'agregar') {
      const fecha = args[1];
      if (!fecha || !/^\d{2}\/\d{2}$/.test(fecha)) {
        return message.reply('Uso correcto: !cumpleaños agregar <dd/mm>');
      }

      cumpleaños.set(message.author.id, fecha);
      return message.reply(`Tu cumpleaños ha sido registrado como ${fecha}.`);
    }

    if (args[0] === 'lista') {
      let listaCumpleaños = '🎂 **Cumpleaños registrados**:\n';
      cumpleaños.forEach((fecha, id) => {
        const usuario = message.guild.members.cache.get(id);
        listaCumpleaños += `- ${usuario.tag}: ${fecha}\n`;
      });

      if (listaCumpleaños === '🎂 **Cumpleaños registrados**:\n') {
        return message.reply('No hay cumpleaños registrados.');
      }

      return message.reply(listaCumpleaños);
    }
  }
};
