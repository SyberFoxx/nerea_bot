import { Comando } from '../../types';
import { obtenerActividad } from './_actividadTracking';

const comando: Comando = {
  nombre: 'actividad',
  descripcion: 'Muestra los usuarios más activos del servidor',
  uso: '!actividad',
  ejecutar: async (message) => {
    const actividad = obtenerActividad();
    const top = Object.entries(actividad)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, count], i) => `${i + 1}. <@${id}> — ${count} mensajes`)
      .join('\n');
    message.reply('📈 Usuarios más activos:\n' + (top || 'No hay datos aún.'));
  },
};

export default comando;
