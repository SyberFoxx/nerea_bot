import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'timer',
  descripcion: 'Inicia un temporizador',
  uso: '!timer <tiempo>  (ej: 10s, 5m, 1h)',
  ejecutar: async (message, args) => {
    if (!args.length) return message.reply('Por favor especifica el tiempo. Ej: `!timer 10m`');

    const match = args[0].match(/^(\d+)([smh])$/);
    if (!match) return message.reply('Formato no válido. Usa s, m o h (ej: `5m`, `30s`, `1h`)');

    const cantidad = parseInt(match[1]);
    const unidad = match[2];
    let ms = cantidad;
    if (unidad === 'm') ms *= 60;
    else if (unidad === 'h') ms *= 3600;
    ms *= 1000;

    message.reply(`⏳ Temporizador iniciado por ${cantidad}${unidad}...`);
    setTimeout(() => message.reply(`⏰ ¡Se acabó el tiempo de ${cantidad}${unidad}!`), ms);
  },
};

export default comando;
