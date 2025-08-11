const { obtenerActividad } = require('./_actividadTracking');

module.exports = {
  nombre: 'actividad',
  ejecutar: async (message) => {
    const actividad = obtenerActividad();

    const top = Object.entries(actividad)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count], index) => `${index + 1}. <@${id}> - ${count} mensajes`)
      .join('\n');

    message.reply('📈 Usuarios más activos:\n' + (top || 'No hay datos aún.'));
  }
};
