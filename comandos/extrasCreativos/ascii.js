const figlet = require('figlet');  // Paquete necesario para generar arte ASCII

module.exports = {
  nombre: 'ascii',
  descripcion: 'Convierte un texto en arte ASCII.',
  async execute(message, args) {
    const texto = args.join(' ');  // El texto que el usuario proporciona después del comando
    if (!texto) {
      return message.reply('Por favor, proporciona el texto que quieres convertir en ASCII.');
    }

    // Generamos el arte ASCII con la librería 'figlet'
    try {
      const data = await figlet.promises.text(texto);  // Usamos la versión de promesas de figlet
      message.channel.send(`\`\`\`${data}\`\`\``);  // Enviamos el arte ASCII en un bloque de código
    } catch (err) {
      console.error(err);
      return message.reply('Hubo un error al generar el arte ASCII.');
    }
  },
};
