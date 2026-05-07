import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import axios from 'axios';
import { SlashComando } from '../../types';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('dolar')
    .setDescription('Consulta el precio del dólar en Venezuela (BCV, Paralelo, Binance)'),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    await interaction.deferReply();

    try {
      const [dolarRes, binanceRes] = await Promise.allSettled([
        axios.get<any[]>('https://ve.dolarapi.com/v1/dolares'),
        axios.get<{ price: string }>('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT'),
      ]);

      const fields: { name: string; value: string; inline: boolean }[] = [];

      if (dolarRes.status === 'fulfilled') {
        for (const d of dolarRes.value.data) {
          if (d.nombre?.toLowerCase().includes('bitcoin')) continue;
          const emoji = d.nombre?.toLowerCase().includes('oficial') ? '🏛️' : '📈';
          const label = d.nombre?.toLowerCase().includes('oficial') ? 'BCV (Oficial)' : 'Paralelo (USDT/VES)';
          fields.push({
            name: `${emoji} ${label}`,
            value: `**Bs. ${parseFloat(d.promedio ?? d.precio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}**\nCompra: ${parseFloat(d.compra).toLocaleString('es-VE', { minimumFractionDigits: 2 })} | Venta: ${parseFloat(d.venta).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
            inline: true,
          });
        }
      }

      if (binanceRes.status === 'fulfilled') {
        fields.push({
          name: '💶 Euro (USDT)',
          value: `**$${parseFloat(binanceRes.value.data.price).toLocaleString('en-US', { minimumFractionDigits: 4 })}**`,
          inline: true,
        });
      }

      if (!fields.length) {
        return interaction.editReply('❌ No se pudieron obtener los datos en este momento.');
      }

      await interaction.editReply({
        embeds: [{
          title: '💰 Precios de Divisas en Venezuela',
          color: 0x00D4AA,
          fields,
          footer: { text: 'Datos actualizados • Bot Nerea' },
          timestamp: new Date().toISOString(),
        }],
      });
    } catch {
      await interaction.editReply('❌ Error al obtener los precios.');
    }
  },
};

export default comando;
