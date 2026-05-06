import { Events, AttachmentBuilder } from 'discord.js';

// Canvas es opcional — requiere compilación nativa
let canvas: any = null;
try { canvas = require('canvas'); } catch { console.warn('⚠️ Canvas no instalado. Bienvenidas sin imagen.'); }

// Importar config desde src
const { getConfig } = require('../comandos/bienvenidas/configBienvenida');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member: any) {
    const config = getConfig(member.guild.id);
    if (!config?.habilitado) return;

    if (config.rolId) {
      try { await member.roles.add(config.rolId); } catch (e) { console.error('Error asignando rol:', e); }
    }

    const channel = member.guild.channels.cache.get(config.canalId) as any;
    if (!channel) return;

    let mensaje = `¡Bienvenido/a a **${member.guild.name}** ${member}!`;
    if (config.mensaje) mensaje += `\n\n${config.mensaje}`;

    try {
      if (!canvas) {
        await channel.send({ content: mensaje });
        return;
      }

      const { createCanvas, loadImage } = canvas;
      const c = createCanvas(1024, 500);
      const ctx = c.getContext('2d');

      try {
        const bg = await loadImage(config.fondo ?? 'https://i.imgur.com/wSTFkRM.png');
        ctx.drawImage(bg, 0, 0, c.width, c.height);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, c.width, c.height);
      } catch {
        const g = ctx.createLinearGradient(0, 0, c.width, c.height);
        g.addColorStop(0, '#2c3e50'); g.addColorStop(1, '#3498db');
        ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
      }

      const size = 250, x = (c.width - size) / 2, y = 40;
      ctx.beginPath(); ctx.arc(c.width / 2, y + size / 2, size / 2 + 8, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(c.width / 2, y + size / 2, size / 2, 0, Math.PI * 2); ctx.clip();
      const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true }));
      ctx.drawImage(avatar, x, y, size, size); ctx.restore();

      ctx.font = 'bold 50px Arial'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 8;
      const nombre = member.user.username.length > 20 ? member.user.username.slice(0, 20) + '...' : member.user.username;
      ctx.fillText(nombre, c.width / 2, y + size + 80);
      ctx.font = '35px Arial'; ctx.fillText('¡Welcome To Arcadia!', c.width / 2, y + size + 130);
      ctx.font = '30px Arial'; ctx.fillText(`You are the Deity #${member.guild.memberCount}`, c.width / 2, y + size + 170);

      const attachment = new AttachmentBuilder(await c.toBuffer('image/png'), { name: 'bienvenida.png' });
      await channel.send({ content: mensaje, files: [attachment] });
    } catch (error) {
      console.error('Error en bienvenida:', error);
      await channel.send(mensaje);
    }
  },
};
