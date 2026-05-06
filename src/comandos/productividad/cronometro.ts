import { Comando } from '../../types';

interface CronometroData {
  inicio: number;
  interval: ReturnType<typeof setInterval>;
}

const cronometros = new Map<string, CronometroData>();

const comando: Comando = {
  nombre: 'cronometro',
  descripcion: 'Inicia o detiene un cronómetro personal',
  uso: '!cronometro iniciar | !cronometro parar',
  ejecutar: async (message, args) => {
    const subcomando = args[0];
    const id = message.author.id;

    if (subcomando === 'iniciar') {
      if (cronometros.has(id)) return message.reply('Ya tienes un cronómetro activo.');

      const interval = setInterval(() => {
        const data = cronometros.get(id);
        if (!data) return;
        const seg = Math.floor((Date.now() - data.inicio) / 1000);
        (message.channel as any).send(`⏱️ ${seg} segundos transcurridos.`);
      }, 10_000);

      cronometros.set(id, { inicio: Date.now(), interval });
      return message.reply('⏱️ Cronómetro iniciado.');
    }

    if (subcomando === 'parar') {
      const data = cronometros.get(id);
      if (!data) return message.reply('No tienes un cronómetro activo.');
      clearInterval(data.interval);
      const tiempo = ((Date.now() - data.inicio) / 1000).toFixed(2);
      cronometros.delete(id);
      return message.reply(`⏱️ Cronómetro detenido. Tiempo: **${tiempo}** segundos.`);
    }

    message.reply('Usa `!cronometro iniciar` o `!cronometro parar`.');
  },
};

export default comando;
