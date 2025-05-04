module.exports = {
    nombre: 'recordatorio',
    ejecutar: async (message, args) => {
      const tiempo = args[0]; // 10m, 1h, etc.
      const recordatorio = args.slice(1).join(' ');
  
      if (!tiempo || !recordatorio) {
        return message.reply('Uso: !recordatorio <tiempo> <mensaje>');
      }
  
      const duracion = ms(tiempo);
      if (!duracion) {
        return message.reply('Formato de tiempo no válido. Usa algo como "10m", "1h".');
      }
  
      setTimeout(() => {
        message.reply(`⏰ ¡Recordatorio! ${recordatorio}`);
      }, duracion);
  
      message.reply(`✅ He programado el recordatorio para ${tiempo}.`);
    }
  };
  
  function ms(time) {
    const match = time.match(/^(\d+)(m|h|d)$/);
    if (!match) return null;
  
    const cantidad = parseInt(match[1]);
    const unidad = match[2];
  
    if (unidad === 'm') return cantidad * 60000;
    if (unidad === 'h') return cantidad * 3600000;
    if (unidad === 'd') return cantidad * 86400000;
  }
  