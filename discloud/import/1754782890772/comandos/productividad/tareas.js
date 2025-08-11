const tareas = new Map();

module.exports = {
  nombre: 'tareas',
  ejecutar: async (message, args) => {
    const subcomando = args[0];
    const id = message.author.id;

    if (subcomando === 'tarea') {
      const tarea = args.slice(1).join(' ');
      if (!tarea) return message.reply('Escribe la tarea que deseas añadir.');
      if (!tareas.has(id)) tareas.set(id, []);
      tareas.get(id).push(tarea);
      return message.reply('✅ Tarea añadida.');
    }

    if (subcomando === 'leer') {
      const userTareas = tareas.get(id) || [];
      if (userTareas.length === 0) return message.reply('No tienes tareas pendientes.');
      return message.reply('Tus tareas:\n' + userTareas.map((t, i) => `${i + 1}. ${t}`).join('\n'));
    }

    if (subcomando === 'borrar') {
      tareas.delete(id);
      return message.reply('🗑️ Todas tus tareas han sido borradas.');
    }

    message.reply('Subcomando no reconocido. Usa tarea, leer o borrar.');
  }
};
