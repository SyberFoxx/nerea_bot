const figlet = require('figlet');  // Paquete necesario para generar arte ASCII

module.exports = {
  nombre: 'ascii',
  descripcion: 'Convierte un texto en arte ASCII.',
  async ejecutar(message, args) {
    const texto = args.join(' ');  // El texto que el usuario proporciona después del comando
    if (!texto) {
      return message.reply('Por favor, proporciona el texto que quieres convertir en ASCII.');
    }

    // Generamos el arte ASCII con la librería 'figlet'
    try {
      // Usar callback tradicional envuelto en Promise
      const data = await new Promise((resolve, reject) => {
        figlet(texto, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
      
      message.channel.send(`\`\`\`${data}\`\`\``);  // Enviamos el arte ASCII en un bloque de código
    } catch (err) {
      console.error('Error al generar ASCII:', err);
      return message.reply('Hubo un error al generar el arte ASCII.');
    }
  },
};
