import { Comando } from '../../types';
import { getInventory } from '../../sistemas/inventory';

const comando: Comando = {
  nombre: 'inventario',
  alias: ['inv', 'mochila'],
  descripcion: 'Muestra tu inventario',
  uso: '!inventario',
  categoria: 'economia',
  ejecutar: async (message) => {
    const guildId = message.guild!.id;
    const items   = await getInventory(message.author.id, guildId);

    if (items.length === 0) {
      return message.reply({
        embeds: [{
          title: '🎒 Tu inventario está vacío',
          description: 'Visita la `!tienda` para comprar ítems.',
          color: 0x95a5a6,
        }],
      });
    }

    const lines = items.map(entry => {
      const item = entry.shop_items;
      return `${item.emoji} **${item.name}** ×${entry.quantity}\n*${item.description}*`;
    });

    await message.reply({
      embeds: [{
        title: `🎒 Inventario de ${message.author.username}`,
        description: lines.join('\n\n'),
        color: 0x9b59b6,
        footer: { text: 'Usa los ítems con !alimentar o !jugar para tu mascota' },
      }],
    });
  },
};

export default comando;
