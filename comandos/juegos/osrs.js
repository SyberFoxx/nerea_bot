const axios = require('axios');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Cache para almacenar los precios temporalmente
const priceCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Colores para los embeds
const EMBED_COLORS = {
    DEFAULT: 0x00AA00,
    ERROR: 0xFF0000,
    PROFIT: 0x00AA00,
    LOSS: 0xFF0000
};

// Función para obtener el valor de High Alchemy de la API de la Wiki de OSRS
async function getHighAlchValue(itemId) {
    try {
        const response = await axios.get(
            'https://oldschool.runescape.wiki/api.php',
            {
                params: {
                    action: 'query',
                    prop: 'revisions',
                    rvprop: 'content',
                    rvslots: '*',
                    rvsection: 0,
                    format: 'json',
                    formatversion: 2,
                    pageids: itemId
                },
                headers: { 'User-Agent': 'NereaBot/1.0' }
            }
        );

        const content = response.data?.query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
        if (!content) return null;

        // Buscar el valor de High Alchemy en el contenido de la página
        const highAlchMatch = content.match(/High Level Alchemy.*?(\d{1,3}(?:,\d{3})*)/i);
        if (highAlchMatch) {
            return parseInt(highAlchMatch[1].replace(/,/g, ''));
        }
        
        // Si no se encuentra, intentar con el formato alternativo
        const alchMatch = content.match(/alch.*?\d{1,3}(?:,\d{3})*/gi) || [];
        for (const match of alchMatch) {
            const value = match.match(/(\d{1,3}(?:,\d{3})*)/);
            if (value) {
                return parseInt(value[0].replace(/,/g, ''));
            }
        }
        
        return null;
        
    } catch (error) {
        console.error('Error obteniendo valor de High Alchemy:', error.message);
        return null;
    }
}

// Función para buscar un ítem por nombre
async function searchItem(query) {
    try {
        // Primero buscamos el ID del ítem
        const searchResponse = await axios.get('https://prices.runescape.wiki/api/v1/osrs/mapping');
        const item = searchResponse.data.find(i => i.name.toLowerCase().includes(query.toLowerCase()));
        
        if (!item) {
            console.log('No se encontró el ítem:', query);
            return null;
        }
        
        // Obtener el precio actual del ítem
        const priceResponse = await axios.get(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${item.id}`);
        const priceData = priceResponse.data.data[item.id];
        
        // Obtener el valor de High Alchemy
        const highAlchValue = await getHighAlchValue(item.id) || Math.floor((priceData?.high || 0) * 0.6);
        
        const itemDetails = {
            id: item.id,
            name: item.name,
            cost: Math.max(1, Math.abs(parseInt(priceData?.high) || 0)),
            highalch: highAlchValue > 0 ? highAlchValue : 1
        };
        
        console.log(`Item: ${item.name}, Precio: ${itemDetails.cost}, High Alch: ${itemDetails.highalch}`);
        
        return itemDetails;
        
    } catch (error) {
        console.error('Error buscando ítem:', error.message);
        return null;
    }
}

// Función para obtener el precio actual de un ítem
async function getItemPrice(itemId) {
    const cacheKey = `price_${itemId}`;
    const cached = priceCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.data;
    }

    try {
        const response = await axios.get(`https://prices.runescape.wiki/api/v1/osrs/latest?id=${itemId}`);
        const priceData = response.data.data[itemId];
        
        if (!priceData) return null;
        
        // Asegurar que los valores sean positivos
        const cleanData = {
            high: Math.abs(priceData.high || 0),
            highTime: priceData.highTime || 0,
            low: Math.abs(priceData.low || 0),
            lowTime: priceData.lowTime || 0,
            highTimeVolume: Math.abs(priceData.highTimeVolume || 0)
        };
        
        // Guardar en caché
        priceCache.set(cacheKey, {
            data: cleanData,
            timestamp: Date.now()
        });
        
        return cleanData;
        
    } catch (error) {
        console.error('Error obteniendo precio del ítem:', error);
        return null;
    }
}

// Función para calcular la ganancia con High Alchemy
function calculateHighAlchemyProfit(itemPrice, highAlchPrice) {
    const natureRuneCost = 250; // Costo de la runa nature
    
    // Asegurar que los precios sean números positivos
    const safeItemPrice = Math.max(1, Math.abs(parseInt(itemPrice) || 0));
    const safeHighAlch = Math.max(1, Math.abs(parseInt(highAlchPrice) || 0));
    
    // Calcular ganancia
    const gpReturn = safeHighAlch - safeItemPrice - natureRuneCost;
    const profitPerHour = Math.floor((gpReturn / 3.6) * 60); // 1200 alchs/hora = 1 cada 3.6 segundos
    
    // Calcular ROI de manera segura
    const totalCost = safeItemPrice + natureRuneCost;
    const roi = totalCost > 0 ? ((gpReturn / totalCost) * 100).toFixed(2) : 0;
    
    return {
        profit: gpReturn,
        profitPerHour: profitPerHour,
        cost: totalCost,
        breakEven: totalCost,
        roi: Math.max(0, parseFloat(roi)) // No permitir ROI negativo
    };
}

module.exports = {
    nombre: 'osrs',
    descripcion: 'Consulta precios y estadísticas de ítems de Old School RuneScape',
    
    async ejecutar(message, args) {
        const subcommand = args[0]?.toLowerCase();
        const itemName = args.slice(1).join(' ');
        
        if (!subcommand || !itemName) {
            return message.reply(
                'Uso correcto: `!osrs <precio|alquimia> <nombre del ítem>`\n' +
                'Ejemplos:\n' +
                '`!osrs precio rune scimitar` - Muestra el precio actual\n' +
                '`!osrs alquimia rune platebody` - Calcula ganancia con High Alchemy'
            );
        }
        
        try {
            // Buscar el ítem
            const item = await searchItem(itemName);
            if (!item) {
                return message.reply('❌ No se encontró el ítem especificado.');
            }
            
            // Obtener precios actuales
            const priceData = await getItemPrice(item.id);
            if (!priceData) {
                return message.reply('❌ No se pudo obtener la información de precios en este momento.');
            }
            
            // Manejar subcomandos
            if (subcommand === 'precio') {
                const embed = new EmbedBuilder()
                    .setTitle(`📊 ${item.name}`)
                    .setColor(EMBED_COLORS.DEFAULT)
                    .setThumbnail(`https://www.osrsbox.com/osrsbox-db/items-icons/${item.id}.png`)
                    .addFields(
                        { name: '💵 Precio de compra', value: `${priceData.high.toLocaleString()} gp`, inline: true },
                        { name: '💰 Precio de venta', value: `${priceData.low.toLocaleString()} gp`, inline: true },
                        { name: '📈 Volumen diario', value: `${priceData.highTimeVolume.toLocaleString()}`, inline: true }
                    )
                    .setFooter({ text: 'Datos de OSRS Wiki | Actualizado' })
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
                
            } else if (subcommand === 'alquimia') {
                const alchProfit = calculateHighAlchemyProfit(priceData.high, item.highalch);
                
                const embed = new EmbedBuilder()
                    .setTitle(`✨ ${item.name} - Análisis de Alquimia`)
                    .setColor(alchProfit.profit > 0 ? EMBED_COLORS.PROFIT : EMBED_COLORS.LOSS)
                    .setThumbnail(`https://www.osrsbox.com/osrsbox-db/items-icons/${item.id}.png`)
                    .addFields(
                        { name: '🏷️ Precio actual', value: `${priceData.high.toLocaleString()} gp`, inline: true },
                        { name: '✨ Valor High Alchemy', value: `${item.highalch.toLocaleString()} gp`, inline: true },
                        { name: '💎 Ganancia por alquimia', value: `${alchProfit.profit.toLocaleString()} gp`, inline: true },
                        { name: '⏱️ Ganancia/hora', value: `${alchProfit.profitPerHour.toLocaleString()} gp/h`, inline: true },
                        { name: '📊 ROI', value: `${alchProfit.roi}%`, inline: true },
                        { name: '💰 Costo por alquimia', value: `${alchProfit.cost.toLocaleString()} gp`, inline: true }
                    )
                    .setFooter({ text: 'Datos de OSRS Wiki | Actualizado' })
                    .setTimestamp();
                
                await message.reply({ embeds: [embed] });
                
            } else {
                await message.reply('❌ Subcomando no reconocido. Usa `!osrs precio <ítem>` o `!osrs alquimia <ítem>`');
            }
            
        } catch (error) {
            console.error('Error en comando OSRS:', error);
            message.reply('❌ Ocurrió un error al procesar la solicitud.');
        }
    }
};
