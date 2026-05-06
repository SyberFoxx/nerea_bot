import { EmbedBuilder, PermissionsBitField } from 'discord.js';
import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'limpiar',
  alias: ['clear', 'purge', 'borrar'],
  descripcion: 'Elimina mensajes del canal',
  uso: '!limpiar <cantidad> [@usuario]',
  categoria: 'moderacion',
  permisos: [PermissionsBitField.Flags.ManageMessages],
  ejecutar: async (message, args) => {
    const member = message.member!;
    const hasPermission = [
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.Administrator,
      PermissionsBitField.Flags.ManageGuild,
      PermissionsBitField.Flags.ManageChannels,
    ].some(p => member.permissions.has(p));

    if (!hasPermission)
      return message.reply('❌ No tienes permisos para limpiar mensajes.');

    const channel = message.channel as any;
    const botMember = message.guild!.members.me!;
    const botPerms = channel.permissionsFor(botMember);

    if (!botPerms?.has(PermissionsBitField.Flags.ManageMessages))
      return message.reply('❌ No tengo permisos para borrar mensajes en este canal.');

    const cantidad = parseInt(args[0]);
    if (isNaN(cantidad) || cantidad <= 0 || cantidad > 100)
      return message.reply('❌ Proporciona un número válido entre 1 y 100.');

    const targetUser = message.mentions.users.first();
    let mensajesBorrados = 0;

    try {
      await message.delete().catch(() => {});

      if (targetUser) {
        let mensajes: any[] = [];
        let lastId: string | undefined;
        const limit = Math.min(cantidad, 100);

        while (mensajes.length < limit) {
          const opciones: any = { limit: Math.min(limit - mensajes.length, 100) };
          if (lastId) opciones.before = lastId;

          const lote = await channel.messages.fetch(opciones);
          if (lote.size === 0) break;

          const filtrados = lote.filter((m: any) => m.author.id === targetUser.id);
          mensajes = mensajes.concat(Array.from(filtrados.values()));
          lastId = lote.last()?.id;
          if (lote.size < 100) break;
        }

        mensajes = mensajes.slice(0, cantidad);
        mensajesBorrados = mensajes.length;

        if (mensajes.length === 1) await mensajes[0].delete();
        else if (mensajes.length > 1) await channel.bulkDelete(mensajes, true);
      } else {
        const mensajes = await channel.messages.fetch({ limit: Math.min(cantidad, 100) });
        if (mensajes.size > 0) {
          await channel.bulkDelete(mensajes, true);
          mensajesBorrados = mensajes.size;
        }
      }

      if (mensajesBorrados > 0) {
        const embed = new EmbedBuilder()
          .setColor('#2ecc71')
          .setDescription(`✅ Se han borrado ${mensajesBorrados} mensajes${targetUser ? ` de ${targetUser.tag}` : ''}.`)
          .setFooter({ text: `Solicitado por ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
          .setTimestamp();

        const confirmacion = await channel.send({ embeds: [embed] });
        setTimeout(() => confirmacion.delete().catch(() => {}), 5000);
      }
    } catch (error: any) {
      if (error.code === 50013) return message.reply('❌ No tengo permisos para borrar mensajes.');
      if (error.code === 50034) return message.reply('❌ No se pueden borrar mensajes con más de 14 días.');
      return message.reply('❌ Ocurrió un error al borrar los mensajes.');
    }
  },
};

export default comando;
