const { Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Ruta al archivo de configuración
const configPath = path.join(__dirname, '../config/despedidas.json');

// Función para obtener la configuración
function getConfig(guildId) {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(data);
            return config[guildId] || { habilitado: false };
        }
    } catch (error) {
        console.error('Error al leer la configuración de despedidas:', error);
    }
    return { habilitado: false };
}

// Función para formatear el mensaje con variables
function formatMessage(message, member) {
    return message
        .replace(/{usuario}/g, member.user.toString())
        .replace(/{usuario\.tag}/g, member.user.tag)
        .replace(/{usuario\.username}/g, member.user.username)
        .replace(/{servidor}/g, member.guild.name)
        .replace(/{miembros}/g, member.guild.memberCount);
}

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const config = getConfig(member.guild.id);
        
        // Verificar si las despedidas están habilitadas
        if (!config || !config.habilitado || !config.canalId) return;

        // Obtener el canal de despedida
        const channel = member.guild.channels.cache.get(config.canalId);
        if (!channel) return;

        try {
            // Obtener la información de auditoría para detectar si fue expulsado/expulsado
            const auditLogs = await member.guild.fetchAuditLogs({
                type: 'MEMBER_KICK',
                limit: 1
            });

            const kickLog = auditLogs.entries.first();
            const wasKicked = kickLog && 
                kickLog.target.id === member.user.id && 
                Date.now() - kickLog.createdTimestamp < 10000; // Dentro de los últimos 10 segundos

            const banLogs = await member.guild.fetchAuditLogs({
                type: 'MEMBER_BAN_ADD',
                limit: 1
            });

            const banLog = banLogs.entries.first();
            const wasBanned = banLog && 
                banLog.target.id === member.user.id && 
                Date.now() - banLog.createdTimestamp < 10000; // Dentro de los últimos 10 segundos

            // Crear embed de despedida
            const embed = new EmbedBuilder()
                .setColor(wasBanned ? '#FF0000' : wasKicked ? '#FFA500' : '#3498DB')
                .setTitle(wasBanned ? '🚨 Usuario Baneado' : wasKicked ? '⚠️ Usuario Expulsado' : '👋 Usuario Abandonó')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
                .addFields(
                    { name: 'Usuario', value: member.user.tag, inline: true },
                    { name: 'ID', value: member.user.id, inline: true },
                    { name: 'Cuenta creada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: 'Se unió', value: member.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'Desconocido', inline: true },
                    { name: 'Miembros restantes', value: member.guild.memberCount.toString(), inline: true },
                )
                .setTimestamp();

            // Agregar razón si fue expulsado o baneado
            if (wasKicked && kickLog.reason) {
                embed.addFields({ name: 'Razón de la expulsión', value: kickLog.reason });
            } else if (wasBanned && banLog.reason) {
                embed.addFields({ name: 'Razón del baneo', value: banLog.reason });
            }

            // Enviar mensaje personalizado si existe, de lo contrario usar el embed
            if (config.mensaje) {
                const mensajeDespedida = formatMessage(config.mensaje, member);
                await channel.send({ 
                    content: mensajeDespedida,
                    embeds: [embed] 
                });
            } else {
                await channel.send({ embeds: [embed] });
            }

        } catch (error) {
            console.error('Error al enviar mensaje de despedida:', error);
            
            // Enviar un mensaje simple si falla el embed
            try {
                const defaultMessage = `**${member.user.tag}** ha abandonado el servidor. ¡Hasta pronto!`;
                await channel.send(defaultMessage);
            } catch (err) {
                console.error('Error al enviar mensaje de despedida alternativo:', err);
            }
        }
    },
};
