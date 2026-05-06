import axios from 'axios';
import { Comando } from '../../types';

interface DolarItem {
  nombre: string;
  promedio: string;
  precio: string;
  compra: string;
  venta: string;
}

interface BinanceData {
  eur_usdt: number;
}

interface ExchangeData {
  eur_ves: string | null;
  usd_ves: string | null;
}

interface EmbedField {
  name: string;
  value: string;
  inline: boolean;
}

interface EmbedObject {
  title: string;
  color: number;
  timestamp: Date;
  footer: { text: string };
  fields: EmbedField[];
  description?: string;
}

const comando: Comando = {
  nombre: 'dolar',
  descripcion: 'Consulta el precio del dólar y euro en Venezuela',
  uso: '!dolar',
  ejecutar: async (message) => {
    try {
      const embed: EmbedObject = {
        title: '💰 Precios de Divisas en Venezuela',
        color: 0x00D4AA,
        timestamp: new Date(),
        footer: { text: 'Datos actualizados • Bot Nerea' },
        fields: [],
      };

      const obtenerDolarApi = async (): Promise<DolarItem[] | null> => {
        try {
          const response = await axios.get<DolarItem[]>('https://ve.dolarapi.com/v1/dolares');
          return response.data;
        } catch { return null; }
      };

      const obtenerBinance = async (): Promise<BinanceData | null> => {
        try {
          const res = await axios.get<{ price: string }>('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT');
          return { eur_usdt: parseFloat(res.data.price) };
        } catch { return null; }
      };

      const obtenerExchange = async (): Promise<ExchangeData | null> => {
        try {
          const res = await axios.get<{ rates: Record<string, number> }>('https://api.exchangerate-api.com/v4/latest/USD');
          const vesRate = res.data.rates.VES ?? res.data.rates.VEF;
          const eurRate = res.data.rates.EUR;
          return {
            eur_ves: eurRate && vesRate ? (1 / (eurRate / vesRate)).toFixed(2) : null,
            usd_ves: vesRate ? (1 / vesRate).toFixed(2) : null,
          };
        } catch { return null; }
      };

      const [dolarApiData, binanceData, exchangeData] = await Promise.all([
        obtenerDolarApi(), obtenerBinance(), obtenerExchange(),
      ]);

      if (dolarApiData && Array.isArray(dolarApiData)) {
        for (const dolar of dolarApiData) {
          const nombre = dolar.nombre ?? 'Dólar';
          if (nombre.toLowerCase().includes('bitcoin')) continue;

          const emoji = nombre.toLowerCase().includes('oficial') ? '🏛️'
            : nombre.toLowerCase().includes('paralelo') ? '📈' : '💵';
          const label = nombre.toLowerCase().includes('oficial') ? 'BCV (Oficial)'
            : nombre.toLowerCase().includes('paralelo') ? 'Paralelo (USDT/VES)' : nombre;

          embed.fields.push({
            name: `${emoji} ${label}`,
            value: `**Bs. ${parseFloat(dolar.promedio ?? dolar.precio).toLocaleString('es-VE', { minimumFractionDigits: 2 })}**\n` +
              `Compra: Bs. ${parseFloat(dolar.compra).toLocaleString('es-VE', { minimumFractionDigits: 2 })}\n` +
              `Venta: Bs. ${parseFloat(dolar.venta).toLocaleString('es-VE', { minimumFractionDigits: 2 })}`,
            inline: true,
          });
        }
      }

      if (binanceData) {
        if (exchangeData?.usd_ves) {
          const bcvRate = dolarApiData?.find(d => d.nombre?.toLowerCase().includes('oficial'))?.promedio ?? dolarApiData?.[0]?.promedio;
          if (bcvRate) {
            const eur_ves = (binanceData.eur_usdt * parseFloat(bcvRate)).toFixed(2);
            embed.fields.push({
              name: '🇪🇺 Euro (VES)',
              value: `**Bs. ${parseFloat(eur_ves).toLocaleString('es-VE', { minimumFractionDigits: 2 })}**\nTasa estimada`,
              inline: true,
            });
          }
        }
        embed.fields.push({
          name: '💶 Euro (USDT)',
          value: `**$${binanceData.eur_usdt.toLocaleString('en-US', { minimumFractionDigits: 4 })}**\nPrecio EUR/USDT`,
          inline: true,
        });
      }

      if (embed.fields.length === 0) {
        embed.description = '❌ No se pudieron obtener los datos. Intenta más tarde.';
        embed.color = 0xFF0000;
      } else {
        embed.description = '💡 **BCV** = Oficial | **Paralelo** = Mercado libre | **Euro** = Estimado';
      }

      await (message.channel as any).send({ embeds: [embed] });
    } catch (error: any) {
      console.error('Error al obtener precios:', error.message);
      await (message.channel as any).send({
        embeds: [{ title: '❌ Error', description: 'No se pudieron obtener los datos.', color: 0xFF0000 }],
      });
    }
  },
};

export default comando;
