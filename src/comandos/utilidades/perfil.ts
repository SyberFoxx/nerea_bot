import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'perfil',
  descripcion: 'Muestra tu perfil en el servidor',
  uso: '!perfil',
  ejecutar: async (message) => {
    const miembro = message.guild?.members.cache.get(message.author.id);
    if (!miembro) return message.reply('No se pudo obtener tu información.');

    const fechaUnion = miembro.joinedAt?.toLocaleDateString() ?? 'Desconocida';
    const roles = miembro.roles.cache
      .filter(r => r.name !== '@everyone')
      .map(r => r.name)
      .join(', ') || 'Ninguno';

    message.reply(
      `**Perfil de ${message.author.tag}**:\n` +
      `- Fecha de unión: ${fechaUnion}\n` +
      `- Roles: ${roles}`
    );
  },
};

export default comando;
