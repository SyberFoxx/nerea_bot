const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Función para guardar la configuración
function saveConfig(guildId, config) {
    const configPath = path.join(__dirname, '../../configBienvenidas.json');
    let configs = {};
    
    if (fs.existsSync(configPath)) {
        configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    configs[guildId] = config;
    fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
    return config;
}

// Función para obtener la configuración de un servidor
function getConfig(guildId) {
    const configPath = path.join(__dirname, '../../configBienvenidas.json');
    
    if (!fs.existsSync(configPath)) return null;
    
    try {
        const configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return configs[guildId] || null;
    } catch (error) {
        console.error('Error al leer la configuración de bienvenidas:', error);
        return null;
    }
}

// Primero definimos el objeto del comando
const comando = {
    nombre: 'configbienvenida',
    descripcion: 'Configura los mensajes de bienvenida',
    uso: '!configbienvenida #canal "Mensaje de bienvenida" [@rol]',
    permisos: ['Administrator'],
    
    async ejecutar(message, args) {
        // Verificar permisos
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Necesitas permisos de administrador para usar este comando.');
        }

        // Comando para configurar la imagen de fondo
        if (args[0] === 'fondo' && args[1]) {
            const imageUrl = args[1];
            
            // Validar que sea una URL de imagen
            if (!imageUrl.match(/\.(jpeg|jpg|gif|png)$/)) {
                return message.reply('❌ Por favor proporciona una URL válida de imagen (JPEG, JPG, GIF o PNG)');
            }

            const config = getConfig(message.guild.id) || {};
            config.fondo = imageUrl;
            
            saveConfig(message.guild.id, config);
            
            return message.reply({
                embeds: [new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('✅ Imagen de fondo actualizada')
                    .setDescription('La imagen de fondo se ha configurado correctamente.')
                    .setImage(imageUrl)
                ]
            });
        }

        // Mostrar configuración actual si no hay argumentos
        if (args.length === 0) {
            const config = getConfig(message.guild.id);
            if (!config) {
                return message.reply('ℹ️ No hay ninguna configuración de bienvenida guardada. Usa `!configbienvenida #canal "Mensaje"` para configurarlo.');
            }

            const canal = message.guild.channels.cache.get(config.canalId) || 'Canal no encontrado';
            const rol = config.rolId ? message.guild.roles.cache.get(config.rolId)?.toString() || 'Rol no encontrado' : 'Ninguno';
            
            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('⚙️ Configuración actual de bienvenidas')
                .addFields(
                    { name: 'Canal', value: `${canal}`, inline: true },
                    { name: 'Mensaje', value: config.mensaje || 'No definido', inline: true },
                    { name: 'Rol automático', value: rol, inline: true },
                    { name: 'Estado', value: config.habilitado ? '✅ Activado' : '❌ Desactivado', inline: true },
                    { name: 'Imagen de fondo', value: config.fondo ? '[Ver imagen](' + config.fondo + ')' : 'No definida', inline: true }
                )
                .setFooter({ 
                    text: 'Usa !configbienvenida #canal "mensaje" [@rol] para configurar\n' +
                          'Usa !configbienvenida fondo [URL de la imagen] para cambiar la imagen de fondo' 
                });
                
            // Mostrar vista previa de la imagen si está configurada
            if (config.fondo) {
                embed.setImage(config.fondo);
            }

            return message.reply({ embeds: [embed] });
        }

        // Obtener el canal mencionado
        const canalMencionado = message.mentions.channels.first();
        if (!canalMencionado) {
            return message.reply('❌ Por favor menciona un canal de texto. Ejemplo: `!configbienvenida #bienvenidas "¡Bienvenido {usuario}!" @NuevoMiembro`');
        }

        // Obtener el mensaje (entre comillas si contiene espacios)
        const mensajeMatch = message.content.match(/"([^"]*)"/) || message.content.match(/'([^']*)'/);
        if (!mensajeMatch) {
            return message.reply('❌ Por favor incluye un mensaje entre comillas. Ejemplo: `"¡Bienvenido {usuario}!"`');
        }
        const mensaje = mensajeMatch[1];

        // Obtener el rol mencionado (opcional)
        const rolMencionado = message.mentions.roles.first();

        // Crear configuración
        const config = {
            canalId: canalMencionado.id,
            mensaje: mensaje,
            rolId: rolMencionado ? rolMencionado.id : null,
            habilitado: true
        };

        // Guardar configuración
        saveConfig(message.guild.id, config);

        // Enviar confirmación
        const respuesta = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ Configuración de bienvenida guardada')
            .addFields(
                { name: 'Canal', value: `${canalMencionado}`, inline: true },
                { name: 'Mensaje', value: mensaje, inline: true },
                { name: 'Rol', value: rolMencionado ? rolMencionado.toString() : 'Ninguno', inline: true }
            )
            .setFooter({ text: 'Usa !simular para probar la configuración' });

        await message.reply({ embeds: [respuesta] });
        
        // Eliminar mensaje de comando después de un tiempo
        setTimeout(() => {
            message.delete().catch(console.error);
        }, 5000);
    },

    // Exportar funciones de utilidad
    getConfig,
    saveConfig
};

// Exportar el comando
module.exports = comando;
