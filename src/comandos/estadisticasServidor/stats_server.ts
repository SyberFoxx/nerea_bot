import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'stats',
  descripcion: 'Muestra estadísticas del servidor',
  uso: '!stats',
  ejecutar: async (message) => {
    const { guild } = message;
    if (!guild) return message.reply('Este comando solo se puede usar en un servidor.');
    message.reply(
      `📊 Estadísticas del servidor:\n` +
      `👥 Miembros: ${guild.memberCount}\n` +
      `📁 Canales: ${guild.channels.cache.size}\n` +
      `🎭 Roles: ${guild.roles.cache.size}`
    );
  },
};

export default comando;
