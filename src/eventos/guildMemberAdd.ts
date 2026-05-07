import { Events, AttachmentBuilder } from 'discord.js';
import { generateWelcomeCard } from '../canvas/imageUtils';

const { getConfig } = require('../comandos/bienvenidas/configBienvenida');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member: any) {
    const config = getConfig(member.guild.id);
    if (!config?.habilitado) return;

    // Asignar rol si está configurado
    if (config.rolId) {
      try { await member.roles.add(config.rolId); }
      catch (e) { console.error('Error asignando rol de bienvenida:', e); }
    }

    const channel = member.guild.channels.cache.get(config.canalId) as any;
    if (!channel) return;

    // Color de acento del rol más alto del servidor (o el configurado)
    const accentColor = config.accentColor ?? '#3498db';

    let mensaje = `¡Bienvenido/a a **${member.guild.name}** ${member}!`;
    if (config.mensaje) mensaje += `\n\n${config.mensaje}`;

    try {
      const buffer = await generateWelcomeCard({
        username:    member.user.username,
        avatarUrl:   member.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }),
        memberCount: member.guild.memberCount,
        guildName:   member.guild.name,
        accentColor,
        backgroundUrl: config.fondo,
      });

      const attachment = new AttachmentBuilder(buffer, { name: 'bienvenida.png' });
      await channel.send({ content: mensaje, files: [attachment] });
    } catch (error) {
      console.error('Error generando imagen de bienvenida:', error);
      // Fallback a mensaje de texto
      await channel.send(mensaje);
    }
  },
};
