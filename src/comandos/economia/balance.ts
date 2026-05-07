import { Comando } from '../../types';
import { getWallet, getGuildEconomySettings } from '../../sistemas/economy';

const comando: Comando = {
  nombre: 'balance',
  alias: ['bal', 'monedas', 'dinero'],
  descripcion: 'Muestra tu saldo actual',
  uso: '!balance [@usuario]',
  categoria: 'economia',
  ejecutar: async (message, args) => {
    const target = message.mentions.users.first() ?? message.author;
    const guildId = message.guild!.id;

    const [wallet, settings] = await Promise.all([
      getWallet(target.id, guildId),
      getGuildEconomySettings(guildId),
    ]);

    const isOwn = target.id === message.author.id;
    const title = isOwn ? '💰 Tu billetera' : `💰 Billetera de ${target.username}`;

    await message.reply({
      embeds: [{
        title,
        color: 0xf1c40f,
        thumbnail: { url: target.displayAvatarURL() },
        fields: [
          {
            name: `${settings.currency_emoji} Saldo actual`,
            value: `**${wallet.balance.toLocaleString()}** ${settings.currency_name}`,
            inline: true,
          },
          {
            name: '📈 Total ganado',
            value: `**${wallet.total_earned.toLocaleString()}** ${settings.currency_name}`,
            inline: true,
          },
        ],
        footer: { text: `Usa !daily para reclamar tu recompensa diaria` },
      }],
    });
  },
};

export default comando;
