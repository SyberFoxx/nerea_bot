import { Comando } from '../../types';

// Almacenamiento en memoria (se pierde al reiniciar — para persistencia usar DB)
const cumpleanos = new Map<string, string>();

const comando: Comando = {
  nombre: 'cumpleaños',
  descripcion: 'Registra o consulta cumpleaños',
  uso: '!cumpleaños agregar <dd/mm> | !cumpleaños lista',
  ejecutar: async (message, args) => {
    if (args[0] === 'agregar') {
      const fecha = args[1];
      if (!fecha || !/^\d{2}\/\d{2}$/.test(fecha))
        return message.reply('Uso correcto: !cumpleaños agregar <dd/mm>');

      cumpleanos.set(message.author.id, fecha);
      return message.reply(`Tu cumpleaños ha sido registrado como ${fecha}.`);
    }

    if (args[0] === 'lista') {
      if (cumpleanos.size === 0)
        return message.reply('No hay cumpleaños registrados.');

      let lista = '🎂 **Cumpleaños registrados**:\n';
      for (const [id, fecha] of cumpleanos) {
        const miembro = message.guild?.members.cache.get(id);
        lista += `- ${miembro?.user.tag ?? id}: ${fecha}\n`;
      }
      return message.reply(lista);
    }

    message.reply('Uso: `!cumpleaños agregar <dd/mm>` o `!cumpleaños lista`');
  },
};

export default comando;
