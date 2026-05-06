import { Events, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';

const configPath = path.join(__dirname, '../../config/despedidas.json');

function getConfig(guildId: string): any {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config[guildId] ?? { habilitado: false };
    }
  } catch (e) { console.error('Error leyendo config despedidas:', e); }
  return { habilitado: false };
}

function formatMessage(msg: string, member: any): string {
  return msg
    .replace(/{usuario}/g, member.user.toString())
    .replace(/{usuario\.tag}/g, member.user.tag)
    .replace(/{usuario\.username}/g, member.user.username)
    .replace(/{servidor}/g, member.guild.name)
    .replace(/{miembros}/g, member.guild.memberCount);
}

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member: any) {
    const config = getConfig(member.guild.id);
    if (!config?.habilitado || !config.canalId) return;

    const channel = member.guild.channels.cache.get(config.canalId) as any;
    if (!channel) return;

    try {
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('👋 Usuario Abandonó')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
          { name: 'Usuario', value: member.user.tag, inline: true },
          { name: 'ID', value: member.user.id, inline: true },
          { name: 'Miembros restantes', value: String(member.guild.memberCount), inline: true },
        )
        .setTimestamp();

      const content = config.mensaje ? formatMessage(config.mensaje, member) : undefined;
      await channel.send({ content, embeds: [embed] });
    } catch (error) {
      console.error('Error al enviar mensaje de despedida:', error);
      try { await channel.send(`**${member.user.tag}** ha abandonado el servidor.`); } catch { /* ignorar */ }
    }
  },
};
