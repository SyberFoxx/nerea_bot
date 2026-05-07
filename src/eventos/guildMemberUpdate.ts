/**
 * Evento guildMemberUpdate — detecta cuando un miembro es muteado
 * y aplica el mute_shield si tiene una mascota con ese perk activo.
 *
 * NOTA: El bot solo puede revertir el mute si su rol está por encima
 * del moderador que lo aplicó. Si un admin mutea, no se puede revertir.
 */
import { Events, GuildMember } from 'discord.js';
import { hasMuteShield } from '../sistemas/pets';

module.exports = {
  name: Events.GuildMemberUpdate,
  async execute(oldMember: GuildMember, newMember: GuildMember) {
    try {
      // Detectar si el miembro fue muteado (timeout aplicado)
      const wasTimedOut = !oldMember.communicationDisabledUntilTimestamp;
      const isTimedOut  = !!newMember.communicationDisabledUntilTimestamp;

      if (!wasTimedOut || !isTimedOut) return; // No fue un nuevo mute

      const guildId = newMember.guild.id;
      const userId  = newMember.id;

      const shield = await hasMuteShield(userId, guildId);
      if (!shield) return;

      // Intentar revertir el mute
      await newMember.disableCommunicationUntil(null, 'Mute Shield activo — mascota épica/legendaria');

      // Notificar en DM al usuario
      try {
        await newMember.user.send({
          embeds: [{
            title: '🛡️ ¡Mute Shield activado!',
            description:
              `Tu mascota te protegió de un silencio en **${newMember.guild.name}**.\n` +
              `El escudo se activa automáticamente mientras tu mascota esté sana (hambre y felicidad > 50).`,
            color: 0x9b59b6,
            footer: { text: 'Cuida bien a tu mascota para mantener el escudo activo' },
          }],
        });
      } catch { /* DMs cerrados */ }

      // Notificar en el servidor si hay canal de logs configurado
      const logChannel = newMember.guild.channels.cache.find(
        (c: any) => c.name === 'logs' || c.name === 'mod-logs' || c.name === 'moderacion'
      ) as any;

      if (logChannel?.isTextBased()) {
        await logChannel.send({
          embeds: [{
            title: '🛡️ Mute Shield activado',
            description: `<@${userId}> fue protegido por su mascota. El silencio fue revertido automáticamente.`,
            color: 0x9b59b6,
            timestamp: new Date().toISOString(),
          }],
        }).catch(() => {});
      }

    } catch (error: any) {
      // Si no tiene permisos para revertir el mute, simplemente ignorar
      if (error.code !== 50013) { // 50013 = Missing Permissions
        console.error('[MuteShield] Error:', error.message);
      }
    }
  },
};
