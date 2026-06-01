const axios = require('axios');

module.exports = {
  nombre: 'dolar',
  descripcion: 'Consulta el precio del dólar y euro en Venezuela (BCV, Paralelo, Binance) + Bitcoin USD',
  async ejecutar(message, args) {
    try {
      const comando = args[0]?.toLowerCase() || 'todo';
      
      // Crear embed base
      const embed = {
        title: '💰 Precios de Divisas en Venezuela',
        color: 0x00D4AA,
        timestamp: new Date(),
        footer: {
          text: 'Datos actualizados • Bot Nerea'
        },
        fields: []
      };

      console.log(`Consultando precios de divisas...`);

      // Función para obtener datos de DolarApi Venezuela
      const obtenerDolarApi = async () => {
        try {
          const response = await axios.get('https://ve.dolarapi.com/v1/dolares');
          return response.data;
        } catch (error) {
          console.log(`Error con DolarApi: ${error.message}`);
          return null;
        }
      };

      // Función para obtener datos de Binance
      const obtenerBinance = async () => {
        try {
          // Solo obtener Bitcoin en USD desde Binance (símbolo correcto)
          const btcResponse = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT');
          
          return {
            btc: parseFloat(btcResponse.data.price)
          };
        } catch (error) {
          console.log(`Error con Binance: ${error.message}`);
          return null;
        }
      };

      // Función para obtener datos de AirTM (alternativa para USDT/VES)
      const obtenerAirTM = async () => {
        try {
          // AirTM es una plataforma popular en Venezuela para USDT
          const response = await axios.get('https://rates.airtm.com/api/v1/rates');
          const usdtRate = response.data.rates?.USDT_VES || response.data.rates?.USD_VES;
          
          return {
            usdt_airtm: usdtRate ? parseFloat(usdtRate) : null
          };
        } catch (error) {
          console.log(`Error con AirTM: ${error.message}`);
          return null;
        }
      };

      // Función para obtener datos alternativos (ExchangeRate-API)
      const obtenerExchangeRate = async () => {
        try {
          const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
          const vesRate = response.data.rates.VES || response.data.rates.VEF;
          const eurRate = response.data.rates.EUR;
          
          return {
            usd_oficial: vesRate ? (1 / vesRate).toFixed(2) : null,
            eur_oficial: eurRate && vesRate ? (eurRate / vesRate).toFixed(2) : null
          };
        } catch (error) {
          console.log(`Error con ExchangeRate: ${error.message}`);
          return null;
        }
      };

      // Obtener datos de todas las fuentes
      const [dolarApiData, binanceData, airtmData, exchangeData] = await Promise.all([
        obtenerDolarApi(),
        obtenerBinance(),
        obtenerAirTM(),
        obtenerExchangeRate()
      ]);

      // Procesar datos de DolarApi Venezuela
      if (dolarApiData && Array.isArray(dolarApiData)) {
        for (const dolar of dolarApiData) {
          let emoji = '💵';
          let nombre = dolar.nombre || 'Dólar';
          
          // Filtrar Bitcoin VES - no lo queremos en bolívares
          if (nombre.toLowerCase().includes('bitcoin')) {
            continue; // Saltar el Bitcoin en bolívares
          }
          
          if (nombre.toLowerCase().includes('oficial')) {
            emoji = '🏛️';
            nombre = 'BCV (Oficial)';
          } else if (nombre.toLowerCase().includes('paralelo')) {
            emoji = '📈';
            nombre = 'Paralelo (USDT/VES)';
          }
          
          embed.fields.push({
            name: `${emoji} ${nombre}`,
            value: `**Bs. ${parseFloat(dolar.promedio || dolar.precio).toLocaleString('es-VE', {minimumFractionDigits: 2})}**\n` +
                   `Compra: Bs. ${parseFloat(dolar.compra).toLocaleString('es-VE', {minimumFractionDigits: 2})}\n` +
                   `Venta: Bs. ${parseFloat(dolar.venta).toLocaleString('es-VE', {minimumFractionDigits: 2})}`,
            inline: true
          });
        }
      }

      // Agregar datos de Binance
      if (binanceData) {
        // Bitcoin en USD
        embed.fields.push({
          name: '₿ Bitcoin (USD)',
          value: `**$${binanceData.btc.toLocaleString('en-US', {minimumFractionDigits: 2})}**\n` +
                 `Precio actual BTC/USDT`,
          inline: true
        });
      }

      // Agregar datos de AirTM
      if (airtmData && airtmData.usdt_airtm) {
        embed.fields.push({
          name: '🔶 AirTM USDT/VES',
          value: `**Bs. ${airtmData.usdt_airtm.toLocaleString('es-VE', {minimumFractionDigits: 2})}**\n` +
                 `Precio directo AirTM`,
          inline: true
        });
      }

      // Agregar datos de referencia internacional
      if (exchangeData && exchangeData.usd_oficial) {
        embed.fields.push({
          name: '🌍 Referencia Internacional',
          value: `USD: Bs. ${parseFloat(exchangeData.usd_oficial).toLocaleString('es-VE', {minimumFractionDigits: 2})}` +
                 (exchangeData.eur_oficial ? `\nEUR: Bs. ${parseFloat(exchangeData.eur_oficial).toLocaleString('es-VE', {minimumFractionDigits: 2})}` : '') +
                 `\n*Tasa oficial internacional*`,
          inline: true
        });
      }

      // Si no hay datos disponibles
      if (embed.fields.length === 0) {
        embed.description = '❌ No se pudieron obtener los datos en este momento. Intenta de nuevo más tarde.';
        embed.color = 0xFF0000;
      } else {
        embed.description = `💡 **Información:**\n` +
                           `• **Paralelo** = Precio USDT/VES en mercado libre\n` +
                           `• **BCV** = Banco Central de Venezuela (oficial)\n` +
                           `• **Bitcoin** = Precio en USD (no bolívares)\n` +
                           `• **AirTM** = Precios directos del exchange`;
      }

      console.log(`Datos obtenidos exitosamente, enviando respuesta`);
      await message.channel.send({ embeds: [embed] });

    } catch (error) {
      console.error('Error general al obtener precios:', error.message);
      
      const errorEmbed = {
        title: '❌ Error al consultar precios',
        description: 'Ocurrió un error al obtener los datos. Intenta de nuevo más tarde.',
        color: 0xFF0000,
        timestamp: new Date()
      };
      
      message.channel.send({ embeds: [errorEmbed] });
    }
  }
};
