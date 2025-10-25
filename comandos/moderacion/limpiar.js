const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  nombre: 'limpiar',
  alias: ['clear', 'purge', 'borrar'],
  descripcion: 'Elimina una cantidad específica de mensajes del canal actual o de un usuario específico.',
  categoria: 'moderacion',
  permisos: [PermissionsBitField.Flags.ManageMessages],
  uso: '!limpiar <cantidad> [@usuario]',
  ejemplos: ['!limpiar 10', '!limpiar 50 @usuario'],
  
  ejecutar: async (message, args) => {
    // Verificar permisos de manera más flexible
    const member = message.member;
    const requiredPermissions = [
      PermissionsBitField.Flags.ManageMessages,  // Permiso directo
      PermissionsBitField.Flags.Administrator,   // Admin global
      PermissionsBitField.Flags.ManageGuild,     // Gestionar servidor
      PermissionsBitField.Flags.ManageChannels   // Gestionar canales
    ];
    
    // Verificar si tiene alguno de los permisos requeridos
    const hasPermission = requiredPermissions.some(permission => 
      member.permissions.has(permission)
    );
    
    if (!hasPermission) {
      return message.reply('❌ No tienes permisos para limpiar mensajes. Necesitas el permiso "Gestionar mensajes" o un rol con permisos de administración.');
    }

    // Verificar permisos del bot en este canal específico
    const botMember = message.guild.members.me;
    const channel = message.channel;
    
    // Verificar si el bot puede ver el canal
    if (!channel.viewable) {
      return message.reply('❌ No puedo ver este canal.');
    }
    
    // Verificar permisos del bot en el canal
    const botChannelPerms = channel.permissionsFor(botMember);
    
    if (!botChannelPerms.has(PermissionsBitField.Flags.ManageMessages)) {
      return message.reply('❌ No tengo permisos para borrar mensajes en este canal. Por favor, asegúrate de que mi rol tenga el permiso "Gestionar mensajes" en este canal.');
    }
    
    // Verificar si el bot puede enviar mensajes en este canal
    if (!botChannelPerms.has(PermissionsBitField.Flags.SendMessages)) {
      return message.reply('❌ No tengo permiso para enviar mensajes en este canal.');
    }

    // Obtener la cantidad de mensajes a borrar
    const cantidad = parseInt(args[0]);
    if (isNaN(cantidad) || cantidad <= 0 || cantidad > 100) {
      return message.reply('❌ Por favor, proporciona un número válido de mensajes (de 1 a 100).');
    }

    // Verificar si se mencionó un usuario
    const targetUser = message.mentions.users.first();
    let mensajesBorrados = 0;

    try {
      // Primero borrar el mensaje del comando
      await message.delete().catch(() => {});
      
      if (targetUser) {
        // Borrar mensajes de un usuario específico
        let mensajes = [];
        let lastId;
        
        // Asegurarse de no exceder el límite de 100 mensajes
        const limit = Math.min(cantidad, 100);
        
        // Recopilar mensajes en lotes de 100
        while (mensajes.length < limit) {
          const opciones = { limit: Math.min(limit - mensajes.length, 100) };
          if (lastId) opciones.before = lastId;
          
          const mensajesLote = await message.channel.messages.fetch(opciones);
          if (mensajesLote.size === 0) break;
          
          const filtrados = mensajesLote.filter(m => m.author.id === targetUser.id);
          mensajes = mensajes.concat(Array.from(filtrados.values()));
          lastId = mensajesLote.last().id;
          
          if (mensajesLote.size < 100) break;
        }
        
        // Limitar a la cantidad solicitada
        mensajes = mensajes.slice(0, cantidad);
        mensajesBorrados = mensajes.length;
        
        // Borrar los mensajes
        if (mensajes.length > 0) {
          if (mensajes.length === 1) {
            await mensajes[0].delete();
          } else {
            await message.channel.bulkDelete(mensajes, true);
          }
        }
      } else {
        // Borrar los últimos N mensajes (máximo 100)
        const limit = Math.min(cantidad, 100);
        const mensajes = await message.channel.messages.fetch({ limit });
        
        if (mensajes.size > 0) {
          await message.channel.bulkDelete(mensajes, true);
          mensajesBorrados = mensajes.size;
        }
      }
      
      // Enviar mensaje de confirmación
      // Solo enviar confirmación si se borraron mensajes
      if (mensajesBorrados > 0) {
        const embed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setDescription(`✅ Se han borrado ${mensajesBorrados} mensajes${targetUser ? ` de ${targetUser.tag}` : ''}.`)
          .setFooter({ text: `Solicitado por ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
          .setTimestamp();
        
        const mensajeConfirmacion = await message.channel.send({ embeds: [embed] });
        
        // Eliminar el mensaje de confirmación después de 5 segundos
        setTimeout(() => {
          mensajeConfirmacion.delete().catch(() => {});
        }, 5000);
      }
      
    } catch (error) {
      console.error('Error al limpiar mensajes:', error);
      
      if (error.code === 50013) {
        return message.reply('❌ No tengo permisos para borrar mensajes en este canal.');
      } else if (error.code === 50034) {
        return message.reply('❌ No se pueden borrar mensajes con más de 14 días de antigüedad.');
      } else {
        return message.reply('❌ Ocurrió un error al intentar borrar los mensajes.');
      }
    }
  }
};
