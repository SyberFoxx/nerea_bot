const axios = require('axios');

module.exports = {
  nombre: 'dolar',
  descripcion: 'Consulta el precio del dólar y euro en Venezuela (BCV, Paralelo, Binance) + Euro/USDT',
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

      // Función para obtener datos de Binance (para EUR/USDT)
      const obtenerBinance = async () => {
        try {
          // Obtener EUR/USDT desde Binance
          const eurUsdtResponse = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=EURUSDT');
          return {
            eur_usdt: parseFloat(eurUsdtResponse.data.price)
          };
        } catch (error) {
          console.log(`Error con Binance: ${error.message}`);
          return null;
        }
      };

      // Función para obtener datos de AirTM (alternativa para USDT/VES)
      const obtenerAirTM = async () => {
        try {
          // Usando una API alternativa para tasas de cambio
          const response = await axios.get('https://api.exchangerate-api.com/v4/latest/USD');
          const vesRate = response.data.rates.VES || response.data.rates.VEF;
          const eurRate = response.data.rates.EUR;
          
          return {
            eur_ves: eurRate && vesRate ? (1 / (eurRate / vesRate)).toFixed(2) : null,
            usd_ves: vesRate ? (1 / vesRate).toFixed(2) : null
          };
        } catch (error) {
          console.log(`Error al obtener tasas de cambio: ${error.message}`);
          return null;
        }
      };

      // Obtener datos de todas las fuentes
      const [dolarApiData, binanceData, exchangeData] = await Promise.all([
        obtenerDolarApi(),
        obtenerBinance(),
        obtenerAirTM()
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

      // Agregar datos de Euro desde Binance y tasas de cambio
      if (binanceData && binanceData.eur_usdt) {
        // Si tenemos datos de AirTM para convertir a VES
        if (exchangeData && exchangeData.usd_ves) {
          // Obtener el tipo de cambio USD/VES del BCV (oficial)
          const bcvRate = dolarApiData?.find(d => d.nombre?.toLowerCase().includes('oficial'))?.promedio ||
                         dolarApiData?.[0]?.promedio;
          
          if (bcvRate) {
            // Calcular EUR/VES usando la tasa EUR/USD de Binance y USD/VES del BCV
            const eur_ves = (binanceData.eur_usdt * parseFloat(bcvRate)).toFixed(2);
            
            // Agregar EUR/VES
            embed.fields.push({
              name: '🇪🇺 Euro (VES)',
              value: `**Bs. ${parseFloat(eur_ves).toLocaleString('es-VE', {minimumFractionDigits: 2})}**\n` +
                     `Tasa de cambio estimada`,
              inline: true
            });
          }
        }

        // Agregar EUR/USDT
        embed.fields.push({
          name: '💶 Euro (USDT)',
          value: `**$${binanceData.eur_usdt.toLocaleString('en-US', {minimumFractionDigits: 4})}**\n` +
                 `Precio EUR/USDT`,
          inline: true
        });
      }

      // Agregar datos de referencia internacional si están disponibles
      if (exchangeData && exchangeData.eur_ves) {
        embed.fields.push({
          name: '🌍 Referencia Euro',
          value: `EUR/VES: Bs. ${parseFloat(exchangeData.eur_ves).toLocaleString('es-VE', {minimumFractionDigits: 2})}\n` +
                 `*Tasa oficial internacional*`,
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
                         `• **Euro (VES)** = Precio estimado del Euro en bolívares\n` +
                         `• **Euro (USDT)** = Precio EUR/USDT en el mercado`;
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
