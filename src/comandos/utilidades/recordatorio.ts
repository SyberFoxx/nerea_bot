import { Comando } from '../../types';

function parseDuration(time: string): number | null {
  const match = time.match(/^(\d+)(m|h|d)$/);
  if (!match) return null;
  const cantidad = parseInt(match[1]);
  const unidad = match[2];
  if (unidad === 'm') return cantidad * 60_000;
  if (unidad === 'h') return cantidad * 3_600_000;
  if (unidad === 'd') return cantidad * 86_400_000;
  return null;
}

const comando: Comando = {
  nombre: 'recordatorio',
  descripcion: 'Programa un recordatorio',
  uso: '!recordatorio <tiempo> <mensaje>  (ej: 10m, 1h, 2d)',
  ejecutar: async (message, args) => {
    const tiempo = args[0];
    const texto = args.slice(1).join(' ');

    if (!tiempo || !texto)
      return message.reply('Uso: !recordatorio <tiempo> <mensaje>');

    const duracion = parseDuration(tiempo);
    if (!duracion)
      return message.reply('Formato de tiempo no válido. Usa algo como "10m", "1h" o "2d".');

    setTimeout(() => {
      message.reply(`⏰ ¡Recordatorio! ${texto}`);
    }, duracion);

    message.reply(`✅ Recordatorio programado para ${tiempo}.`);
  },
};

export default comando;
