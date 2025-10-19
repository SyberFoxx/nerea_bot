const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Ruta al archivo de configuración
const configPath = path.join(__dirname, '../../config/despedidas.json');

// Crear el archivo de configuración si no existe
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({}), 'utf8');
}

// Función para guardar la configuración
async function saveConfig(config) {
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
}

// Función para obtener la configuración
function getConfig(guildId) {
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(data);
            if (!config[guildId]) {
                config[guildId] = {
                    canalId: null,
                    mensaje: '{usuario} ha abandonado el servidor. ¡Hasta pronto! 👋',
                    habilitado: false
                };
                saveConfig(config);
            }
            return config;
        }
    } catch (error) {
        console.error('Error al leer la configuración de despedidas:', error);
    }
    return {};
}

module.exports = {
    nombre: 'configdespedida',
    alias: ['setfarewell', 'despedida'],
    descripcion: 'Configura los mensajes de despedida del servidor',
    categoria: 'moderacion',
    permisos: [PermissionFlagsBits.ManageGuild],
    
    async ejecutar(message, args) {
        const subcomando = args[0]?.toLowerCase();
        const guildId = message.guild.id;
        
        // Obtener configuración actual
        const config = getConfig(guildId);
        
        // Si no hay argumentos, mostrar ayuda
        if (!subcomando) {
            return mostrarAyuda(message, config[guildId]);
        }
        
        try {
            switch (subcomando) {
                case 'canal': {
                    const canalMencionado = message.mentions.channels.first();
                    if (!canalMencionado) {
                        return message.reply('❌ Debes mencionar un canal. Ejemplo: `!configdespedida canal #canal-de-despedidas`');
                    }
                    
                    config[guildId].canalId = canalMencionado.id;
                    config[guildId].habilitado = true;
                    await saveConfig(config);
                    
                    return message.reply(`✅ Canal de despedidas establecido a ${canalMencionado}.`);
                }
                
                case 'mensaje': {
                    const mensaje = args.slice(1).join(' ');
                    if (!mensaje) {
                        return message.reply('❌ Debes especificar un mensaje. Ejemplo: `!configdespedida mensaje {usuario} ha dejado {servidor}. ¡Hasta pronto!`');
                    }
                    
                    config[guildId].mensaje = mensaje;
                    await saveConfig(config);
                    
                    // Mostrar vista previa
                    const preview = mensaje
                        .replace(/{usuario}/g, message.author.toString())
                        .replace(/{servidor}/g, message.guild.name)
                        .replace(/{miembros}/g, message.guild.memberCount);
                    
                    return message.reply({
                        content: '✅ Mensaje de despedida actualizado. Vista previa:',
                        embeds: [{
                            description: preview,
                            color: 0x3498db,
                            footer: {
                                text: 'Variables: {usuario} - Menciona al usuario | {servidor} - Nombre del servidor | {miembros} - Número de miembros'
                            }
                        }]
                    });
                }
                
                case 'ver':
                case 'mostrar':
                case 'config': {
                    return mostrarConfiguracion(message, config[guildId]);
                }
                
                case 'activar':
                case 'on': {
                    config[guildId].habilitado = true;
                    await saveConfig(config);
                    return message.reply('✅ Sistema de despedidas activado.');
                }
                
                case 'desactivar':
                case 'off': {
                    config[guildId].habilitado = false;
                    await saveConfig(config);
                    return message.reply('❌ Sistema de despedidas desactivado.');
                }
                
                default: {
                    return mostrarAyuda(message, config[guildId]);
                }
            }
        } catch (error) {
            console.error('Error en configDespedida:', error);
            return message.reply('❌ Ocurrió un error al procesar el comando.');
        }
    }
};

// Función para mostrar la ayuda
function mostrarAyuda(message, config) {
    const canal = config.canalId ? `<#${config.canalId}>` : 'No establecido';
    const estado = config.habilitado ? '✅ Activado' : '❌ Desactivado';
    
    return message.reply({
        embeds: [{
            title: '🛠️ Configuración de Despedidas',
            description: 'Configura los mensajes de despedida cuando un miembro abandona el servidor.',
            color: 0x3498db,
            fields: [
                { 
                    name: '📝 Uso', 
                    value: '```' +
                        '!configdespedida canal #canal - Establece el canal de despedidas\n' +
                        '!configdespedida mensaje [mensaje] - Establece el mensaje de despedida\n' +
                        '!configdespedida ver - Muestra la configuración actual\n' +
                        '!configdespedida on/off - Activa/desactiva las despedidas\n' +
                        '!configdespedida ayuda - Muestra este mensaje'
                },
                { 
                    name: '📋 Variables disponibles', 
                    value: '```' +
                        '{usuario} - Menciona al usuario\n' +
                        '{usuario.tag} - Muestra el tag del usuario\n' +
                        '{usuario.username} - Muestra el nombre de usuario\n' +
                        '{servidor} - Muestra el nombre del servidor\n' +
                        '{miembros} - Muestra el número de miembros actual\n' +
                        '```'
                },
                { 
                    name: '⚙️ Configuración actual', 
                    value: `**Canal:** ${canal}\n` +
                           `**Estado:** ${estado}\n` +
                           `**Mensaje:** \`${config.mensaje || 'Predeterminado'}\``
                }
            ],
            footer: {
                text: `Solicitado por ${message.author.tag}`,
                icon_url: message.author.displayAvatarURL()
            },
            timestamp: new Date()
        }]
    });
}

// Función para mostrar la configuración actual
async function mostrarConfiguracion(message, config) {
    const canal = config.canalId ? `<#${config.canalId}>` : 'No establecido';
    const estado = config.habilitado ? '✅ Activado' : '❌ Desactivado';
    
    return message.reply({
        embeds: [{
            title: '⚙️ Configuración de Despedidas',
            color: 0x3498db,
            fields: [
                { name: 'Canal', value: canal, inline: true },
                { name: 'Estado', value: estado, inline: true },
                { 
                    name: 'Mensaje actual', 
                    value: `\`\`\`${config.mensaje || 'Mensaje predeterminado'}\`\`\`` 
                },
                { 
                    name: 'Vista previa', 
                    value: config.mensaje
                        .replace(/{usuario}/g, message.member.toString())
                        .replace(/{servidor}/g, message.guild.name)
                        .replace(/{miembros}/g, message.guild.memberCount)
                }
            ],
            footer: {
                text: `Usa !configdespedida ayuda para ver todas las opciones`
            },
            timestamp: new Date()
        }]
    });
}

