const { Events, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');
const { getConfig } = require('../comandos/bienvenidas/configBienvenida');
const path = require('path');

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const config = getConfig(member.guild.id);
        if (!config || !config.habilitado) return;

        // Asignar rol si está configurado
        if (config.rolId) {
            try {
                await member.roles.add(config.rolId);
            } catch (error) {
                console.error('Error al asignar rol de bienvenida:', error);
            }
        }

        // Obtener el canal de bienvenida
        const channel = member.guild.channels.cache.get(config.canalId);
        if (!channel) return;

        try {
            // Crear imagen de bienvenida
            const canvas = createCanvas(1024, 500);
            const ctx = canvas.getContext('2d');

            // Cargar imagen de fondo personalizada o usar una por defecto
            try {
                const backgroundImage = config.fondo || 'https://i.imgur.com/wSTFkRM.png';
                const background = await loadImage(backgroundImage);
                // Aplicar un tinte oscuro al fondo para mejorar la legibilidad del texto
                ctx.drawImage(background, 0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            } catch (error) {
                console.error('Error al cargar la imagen de fondo:', error);
                // Fondo degradado como respaldo
                const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
                gradient.addColorStop(0, '#2c3e50');
                gradient.addColorStop(1, '#3498db');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Dibujar avatar del usuario (más grande)
            const avatarSize = 250; // Tamaño aumentado del avatar
            const avatarX = (canvas.width - avatarSize) / 2;
            const avatarY = 40;
            
            // Crear un borde circular para el avatar
            ctx.beginPath();
            ctx.arc(canvas.width / 2, avatarY + avatarSize / 2, avatarSize / 2 + 8, 0, Math.PI * 2, true);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            // Recortar el avatar en forma circular
            ctx.save();
            ctx.beginPath();
            ctx.arc(canvas.width / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();
            
            // Cargar y dibujar el avatar
            const avatar = await loadImage(member.user.displayAvatarURL({ 
                extension: 'png', 
                size: 512,
                forceStatic: true
            }));
            ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();

            // Configuración del texto
            const textoY = avatarY + avatarSize + 80;
            const textoBienvenidaY = textoY + 50;
            
            // Estilo para el nombre de usuario
            ctx.font = 'bold 50px "Arial", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            
            // Sombra para mejor legibilidad
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            
            // Nombre de usuario (con recorte si es muy largo)
            const nombreUsuario = member.user.username.length > 20 
                ? member.user.username.substring(0, 20) + '...' 
                : member.user.username;
                
            ctx.fillText(nombreUsuario, canvas.width / 2, textoY);
            
            // Texto de bienvenida
            ctx.font = '35px "Arial", sans-serif';
            ctx.fillText('¡Welcome To Arcadia!', canvas.width / 2, textoBienvenidaY);
            
            // Contador de miembros
            ctx.font = '30px "Arial", sans-serif';
            ctx.fillText(`You are the Deity #${member.guild.memberCount}`, canvas.width / 2, textoBienvenidaY + 40);
            
            // Restaurar configuración de sombra
            ctx.shadowColor = 'transparent';

            // Convertir el canvas a un buffer
            const attachment = new AttachmentBuilder(await canvas.toBuffer('image/png'), { name: 'bienvenida.png' });

            // Reemplazar variables en el mensaje
            let mensaje = `¡Bienvenido/a a **${member.guild.name}** ${member}!`;
            
            // Agregar el mensaje personalizado si existe
            if (config.mensaje) {
                mensaje += `\n\n${config.mensaje}`;
            }

            // Enviar mensaje de bienvenida
            await channel.send({
                content: mensaje,
                files: [attachment]
            });

        } catch (error) {
            console.error('Error al crear la imagen de bienvenida:', error);
            // Enviar mensaje sin imagen si hay un error
            let mensaje = config.mensaje
                .replace(/{usuario}/g, member.toString())
                .replace(/{servidor}/g, member.guild.name);
                
            await channel.send(mensaje);
        }
    },
};
