import axios from 'axios';
import { EmbedBuilder } from 'discord.js';
import { Comando } from '../../types';

const priceCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

async function searchItem(query: string): Promise<any | null> {
  try {
    const res = await axios.get<any[]>('https://prices.runescape.wiki/api/v1/osrs/mapping');
    const item = res.data.find((i: any) => i.name.toLowerCase().includes(query.toLowerCase()));
    if (!item) return null;

    const priceRes = await axios.get<any>(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${item.id}`);
    const priceData = priceRes.data.data[item.id];
    const highAlch = Math.floor((priceData?.high ?? 0) * 0.6);

    return { id: item.id, name: item.name, cost: Math.max(1, Math.abs(parseInt(priceData?.high) || 0)), highalch: highAlch > 0 ? highAlch : 1 };
  } catch { return null; }
}

async function getItemPrice(itemId: number): Promise<any | null> {
  const key = `price_${itemId}`;
  const cached = priceCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.data;

  try {
    const res = await axios.get<any>(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemId}`);
    const d = res.data.data[itemId];
    if (!d) return null;
    const clean = { high: Math.abs(d.high || 0), low: Math.abs(d.low || 0), highTimeVolume: Math.abs(d.highTimeVolume || 0) };
    priceCache.set(key, { data: clean, timestamp: Date.now() });
    return clean;
  } catch { return null; }
}

function calcAlchProfit(itemPrice: number, highAlch: number) {
  const natureRune = 250;
  const cost = Math.max(1, itemPrice) + natureRune;
  const profit = Math.max(1, highAlch) - cost;
  const roi = cost > 0 ? ((profit / cost) * 100).toFixed(2) : '0';
  return { profit, profitPerHour: Math.floor((profit / 3.6) * 60), cost, roi: Math.max(0, parseFloat(roi)) };
}

const comando: Comando = {
  nombre: 'osrs',
  descripcion: 'Consulta precios de ítems de Old School RuneScape',
  uso: '!osrs precio <ítem> | !osrs alquimia <ítem>',
  ejecutar: async (message, args) => {
    const sub = args[0]?.toLowerCase();
    const itemName = args.slice(1).join(' ');

    if (!sub || !itemName)
      return message.reply('Uso: `!osrs precio <ítem>` o `!osrs alquimia <ítem>`');

    try {
      const item = await searchItem(itemName);
      if (!item) return message.reply('❌ No se encontró el ítem.');

      const priceData = await getItemPrice(item.id);
      if (!priceData) return message.reply('❌ No se pudo obtener el precio.');

      if (sub === 'precio') {
        const embed = new EmbedBuilder()
          .setTitle(`📊 ${item.name}`).setColor(0x00AA00)
          .setThumbnail(`https://www.osrsbox.com/osrsbox-db/items-icons/${item.id}.png`)
          .addFields(
            { name: '💵 Compra', value: `${priceData.high.toLocaleString()} gp`, inline: true },
            { name: '💰 Venta', value: `${priceData.low.toLocaleString()} gp`, inline: true },
            { name: '📈 Volumen', value: `${priceData.highTimeVolume.toLocaleString()}`, inline: true }
          ).setTimestamp();
        return message.reply({ embeds: [embed] });
      }

      if (sub === 'alquimia') {
        const alch = calcAlchProfit(priceData.high, item.highalch);
        const embed = new EmbedBuilder()
          .setTitle(`✨ ${item.name} — Alquimia`).setColor(alch.profit > 0 ? 0x00AA00 : 0xFF0000)
          .setThumbnail(`https://www.osrsbox.com/osrsbox-db/items-icons/${item.id}.png`)
          .addFields(
            { name: '🏷️ Precio', value: `${priceData.high.toLocaleString()} gp`, inline: true },
            { name: '✨ High Alch', value: `${item.highalch.toLocaleString()} gp`, inline: true },
            { name: '💎 Ganancia', value: `${alch.profit.toLocaleString()} gp`, inline: true },
            { name: '⏱️ Ganancia/hora', value: `${alch.profitPerHour.toLocaleString()} gp/h`, inline: true },
            { name: '📊 ROI', value: `${alch.roi}%`, inline: true },
            { name: '💰 Costo', value: `${alch.cost.toLocaleString()} gp`, inline: true }
          ).setTimestamp();
        return message.reply({ embeds: [embed] });
      }

      message.reply('❌ Subcomando no reconocido. Usa `precio` o `alquimia`.');
    } catch (error) {
      console.error('Error en OSRS:', error);
      message.reply('❌ Ocurrió un error al procesar la solicitud.');
    }
  },
};

export default comando;
