// Temporizador (!timer 10m)
const { setTimeout } = require('node:timers');

module.exports = {
  nombre: 'timer',
  ejecutar: async (message, args) => {
    if (!args.length) return message.reply('Por favor, especifica el tiempo. Ej: !timer 10m');

    const input = args[0];
    const match = input.match(/(\d+)([smh])/); // s=segundos, m=minutos, h=horas
    if (!match) return message.reply('Formato no válido. Usa s, m o h (ej: 5m)');

    const [_, cantidad, unidad] = match;
    let milisegundos = parseInt(cantidad);
    if (unidad === 'm') milisegundos *= 60;
    else if (unidad === 'h') milisegundos *= 3600;
    milisegundos *= 1000;

    message.reply(`Temporizador iniciado por ${cantidad}${unidad}...`);
    setTimeout(() => message.reply(`⏰ ¡Se acabó el tiempo de ${cantidad}${unidad}!`), milisegundos);
  }
};