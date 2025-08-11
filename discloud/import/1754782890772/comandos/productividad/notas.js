// Notas (!notas agregar/leer/borrar)
const notas = new Map();

module.exports = {
  nombre: 'notas',
  ejecutar: async (message, args) => {
    const subcomando = args[0];
    const id = message.author.id;

    if (subcomando === 'agregar') {
      const nota = args.slice(1).join(' ');
      if (!nota) return message.reply('Escribe la nota que deseas agregar.');
      if (!notas.has(id)) notas.set(id, []);
      notas.get(id).push(nota);
      return message.reply('📝 Nota agregada.');
    }

    if (subcomando === 'leer') {
      const userNotas = notas.get(id) || [];
      if (userNotas.length === 0) return message.reply('No tienes notas guardadas.');
      return message.reply('Tus notas:\n' + userNotas.map((n, i) => `${i + 1}. ${n}`).join('\n'));
    }

    if (subcomando === 'borrar') {
      notas.delete(id);
      return message.reply('🗑️ Todas tus notas han sido borradas.');
    }

    message.reply('Subcomando no reconocido. Usa agregar, leer o borrar.');
  }
};