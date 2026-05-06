import { Comando } from '../../types';

const notas = new Map<string, string[]>();

const comando: Comando = {
  nombre: 'notas',
  descripcion: 'Gestiona tus notas personales',
  uso: '!notas agregar <texto> | !notas leer | !notas borrar',
  ejecutar: async (message, args) => {
    const sub = args[0];
    const id = message.author.id;

    if (sub === 'agregar') {
      const nota = args.slice(1).join(' ');
      if (!nota) return message.reply('Escribe la nota que deseas agregar.');
      if (!notas.has(id)) notas.set(id, []);
      notas.get(id)!.push(nota);
      return message.reply('📝 Nota agregada.');
    }

    if (sub === 'leer') {
      const lista = notas.get(id) ?? [];
      if (!lista.length) return message.reply('No tienes notas guardadas.');
      return message.reply('Tus notas:\n' + lista.map((n, i) => `${i + 1}. ${n}`).join('\n'));
    }

    if (sub === 'borrar') {
      notas.delete(id);
      return message.reply('🗑️ Todas tus notas han sido borradas.');
    }

    message.reply('Subcomandos: `agregar`, `leer`, `borrar`.');
  },
};

export default comando;
