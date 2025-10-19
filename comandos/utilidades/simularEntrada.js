const { Events } = require('discord.js');
const { getConfig } = require('../bienvenidas/configBienvenida');

module.exports = {
    nombre: 'simular',
    descripcion: 'Simula la entrada de un nuevo miembro al servidor',
    ejecutar: async (message, args) => {
        try {
            // Verificar permisos (solo administradores pueden usar este comando)
            if (!message.member.permissions.has('ADMINISTRATOR')) {
                return message.reply('❌ Necesitas permisos de administrador para usar este comando.');
            }

            // Obtener el usuario mencionado o el autor del mensaje
            const usuarioMencionado = message.mentions.users.first();
            const usuario = usuarioMencionado || message.author;
            const miembro = message.guild.members.cache.get(usuario.id);

            if (!miembro) {
                return message.reply('❌ No se pudo encontrar al miembro especificado.');
            }

            // Verificar configuración
            const config = getConfig(message.guild.id);
            if (!config) {
                return message.reply('❌ No hay configuración de bienvenida. Usa el comando de configuración primero.');
            }

            const canal = message.guild.channels.cache.get(config.canalId);
            if (!canal) {
                return message.reply(`❌ No se encontró el canal de bienvenida configurado (ID: ${config.canalId})`);
            }

            // Responder que se está simulando
            const mensajeRespuesta = await message.reply(`🔹 **Simulando entrada de ${miembro.toString()}...**\n📝 Verificando configuración...`);

            // Verificar permisos del bot
            const botMember = message.guild.members.me;
            if (!botMember.permissionsIn(canal).has(['SEND_MESSAGES', 'ATTACH_FILES', 'VIEW_CHANNEL'])) {
                return mensajeRespuesta.edit(`❌ El bot no tiene permisos para enviar mensajes en ${canal}.`);
            }

            // Disparar manualmente el evento de entrada
            message.client.emit(Events.GuildMemberAdd, miembro);
            
            // Actualizar mensaje de éxito
            await mensajeRespuesta.edit(`✅ Simulación completada para ${miembro.toString()}.\n📨 Se debería haber enviado un mensaje a ${canal}.`);
            
            // Eliminar mensajes después de un tiempo
            setTimeout(() => {
                message.delete().catch(console.error);
                mensajeRespuesta.delete().catch(console.error);
            }, 10000);
            
        } catch (error) {
            console.error('Error en comando simular:', error);
            message.reply('❌ Ocurrió un error al simular la entrada. Revisa la consola para más detalles.');
        }
    },
};
