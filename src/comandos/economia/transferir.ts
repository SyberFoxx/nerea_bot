import { Comando } from '../../types';
import { transfer, getGuildEconomySettings } from '../../sistemas/economy';

const comando: Comando = {
  nombre: 'transferir',
  alias: ['pagar', 'enviar'],
  descripcion: 'Transfiere monedas a otro usuario',
  uso: '!transferir @usuario <cantidad>',
  categoria: 'economia',
  ejecutar: async (message, args) => {
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Menciona a un usuario. Ej: `!transferir @usuario 100`');
    if (target.id === message.author.id) return message.reply('❌ No puedes transferirte monedas a ti mismo.');
    if (target.bot) return message.reply('❌ No puedes transferir monedas a un bot.');

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) return message.reply('❌ Indica una cantidad válida mayor a 0.');

    const guildId  = message.guild!.id;
    const settings = await getGuildEconomySettings(guildId);

    try {
      await transfer(message.author.id, target.id, guildId, amount);
      await message.reply({
        embeds: [{
          title: '💸 Transferencia exitosa',
          description: `Enviaste ${settings.currency_emoji} **${amount.toLocaleString()}** ${settings.currency_name} a ${target}`,
          color: 0x2ecc71,
        }],
      });
    } catch (e: any) {
      if (e.message === 'Saldo insuficiente') {
        return message.reply(`❌ No tienes suficientes ${settings.currency_name}.`);
      }
      throw e;
    }
  },
};

export default comando;
