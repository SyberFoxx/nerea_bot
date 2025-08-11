const cronometros = new Map();

module.exports = {
  nombre: 'cronometro',
  ejecutar: async (message, args) => {
    const subcomando = args[0];
    const id = message.author.id;

    if (subcomando === 'iniciar') {
      if (cronometros.has(id)) return message.reply('Ya tienes un cronómetro activo.');

      const interval = setInterval(() => {
        const inicio = cronometros.get(id)?.inicio;
        if (!inicio) return;
        const transcurrido = Math.floor((Date.now() - inicio) / 1000);
        message.channel.send(`⏱️ ${transcurrido} segundos transcurridos.`);
      }, 10000); // cada 10 segundos

      cronometros.set(id, { inicio: Date.now(), interval });
      return message.reply('⏱️ Cronómetro iniciado.');
    }

    if (subcomando === 'parar') {
      if (!cronometros.has(id)) return message.reply('No tienes un cronómetro activo.');
      const { inicio, interval } = cronometros.get(id);
      clearInterval(interval);
      const tiempo = ((Date.now() - inicio) / 1000).toFixed(2);
      cronometros.delete(id);
      return message.reply(`⏱️ Cronómetro detenido. Tiempo transcurrido: ${tiempo} segundos.`);
    }

    message.reply('Usa "!cronómetro iniciar" o "!cronómetro parar".');
  }
};