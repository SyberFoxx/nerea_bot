module.exports = {
    nombre: 'sugerencia',
    ejecutar: async (message, args) => {
      const sugerencia = args.join(' ');
      if (!sugerencia) {
        return message.reply('Por favor, proporciona una sugerencia.');
      }
  
      // Aquí puedes cambiar el canal donde se envía la sugerencia
      const canalSugerencias = message.guild.channels.cache.find(c => c.name === 'sugerencias');
      if (!canalSugerencias) {
        return message.reply('No se encontró el canal de sugerencias.');
      }
  
      canalSugerencias.send(`💡 **Sugerencia de ${message.author.tag}**: ${sugerencia}`);
      message.reply('Tu sugerencia ha sido enviada.');
    }
  };
  