import { Comando } from '../../types';

const tareas = new Map<string, string[]>();

const comando: Comando = {
  nombre: 'tareas',
  descripcion: 'Gestiona tus tareas pendientes',
  uso: '!tareas tarea <texto> | !tareas leer | !tareas borrar',
  ejecutar: async (message, args) => {
    const sub = args[0];
    const id = message.author.id;

    if (sub === 'tarea') {
      const tarea = args.slice(1).join(' ');
      if (!tarea) return message.reply('Escribe la tarea que deseas añadir.');
      if (!tareas.has(id)) tareas.set(id, []);
      tareas.get(id)!.push(tarea);
      return message.reply('✅ Tarea añadida.');
    }

    if (sub === 'leer') {
      const lista = tareas.get(id) ?? [];
      if (!lista.length) return message.reply('No tienes tareas pendientes.');
      return message.reply('Tus tareas:\n' + lista.map((t, i) => `${i + 1}. ${t}`).join('\n'));
    }

    if (sub === 'borrar') {
      tareas.delete(id);
      return message.reply('🗑️ Todas tus tareas han sido borradas.');
    }

    message.reply('Subcomandos: `tarea`, `leer`, `borrar`.');
  },
};

export default comando;
