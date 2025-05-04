module.exports = {
    nombre: 'rps',
    ejecutar: (message, args) => {
      const opciones = ['piedra', 'papel', 'tijeras'];
      const eleccionUsuario = args[0]?.toLowerCase();
  
      if (!opciones.includes(eleccionUsuario)) {
        message.reply('Debes elegir: piedra, papel o tijeras. Ejemplo: **!rps piedra**');
        return;
      }
  
      const eleccionBot = opciones[Math.floor(Math.random() * opciones.length)];
      let resultado = '';
  
      if (eleccionUsuario === eleccionBot) {
        resultado = '¡Empate!';
      } else if (
        (eleccionUsuario === 'piedra' && eleccionBot === 'tijeras') ||
        (eleccionUsuario === 'papel' && eleccionBot === 'piedra') ||
        (eleccionUsuario === 'tijeras' && eleccionBot === 'papel')
      ) {
        resultado = '¡Ganaste!';
      } else {
        resultado = '¡Perdiste!';
      }
  
      message.reply(`Elegiste **${eleccionUsuario}**, yo elegí **${eleccionBot}**. ${resultado}`);
    }
  };
  