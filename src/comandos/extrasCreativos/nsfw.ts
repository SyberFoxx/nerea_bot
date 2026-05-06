import axios from 'axios';
import { Comando } from '../../types';

const categoriasWaifu = ['waifu', 'neko', 'trap', 'blowjob'];
const categoriasNekobot = ['hentai', 'hass', 'hmidriff', 'pgif', '4k', 'hentai_anal', 'yaoi', 'tentacle'];
const categoriasNekos = ['neko', 'waifu', 'trap', 'blowjob', 'pussy', 'feet', 'yuri', 'anal', 'avatar', 'ero', 'cum'];
const alternativas: Record<string, string> = { yuri: 'waifu', feet: 'neko', anal: 'hentai', cum: 'neko', ero: 'waifu', pussy: 'neko' };

const comando: Comando = {
  nombre: 'nsfw',
  descripcion: 'Muestra una imagen NSFW (solo en canales NSFW)',
  uso: '!nsfw [categoría]',
  nsfw: true,
  ejecutar: async (message, args) => {
    if (!(message.channel as any).nsfw)
      return message.reply('❌ Este comando solo puede usarse en canales NSFW.');

    const categoria = (args[0] ?? 'neko').toLowerCase();
    let imageUrl: string | null = null;
    let apiUsada = '';

    if (categoriasWaifu.includes(categoria)) {
      try {
        const r = await axios.get<{ url: string }>(`https://api.waifu.pics/nsfw/${categoria}`);
        if (r.data?.url) { imageUrl = r.data.url; apiUsada = 'waifu.pics'; }
      } catch { /* continuar */ }
    }

    if (!imageUrl && categoriasNekobot.includes(categoria)) {
      try {
        const r = await axios.get<{ message: string }>(`https://nekobot.xyz/api/image?type=${categoria}`);
        if (r.data?.message) { imageUrl = r.data.message; apiUsada = 'nekobot.xyz'; }
      } catch { /* continuar */ }
    }

    if (!imageUrl && categoriasNekos.includes(categoria)) {
      try {
        const r = await axios.get<{ url: string }>(`https://nekos.life/api/v2/img/${categoria}`);
        if (r.data?.url) { imageUrl = r.data.url; apiUsada = 'nekos.life'; }
      } catch { /* continuar */ }
    }

    if (!imageUrl && alternativas[categoria]) {
      try {
        const alt = alternativas[categoria];
        const r = await axios.get<{ url: string }>(`https://api.waifu.pics/nsfw/${alt}`);
        if (r.data?.url) { imageUrl = r.data.url; apiUsada = `waifu.pics (alt: ${alt})`; }
      } catch { /* continuar */ }
    }

    if (!imageUrl) {
      const todas = [...new Set([...categoriasWaifu, ...categoriasNekobot, ...categoriasNekos])];
      return message.reply(
        todas.includes(categoria)
          ? `❌ La categoría "${categoria}" no está disponible ahora.`
          : `❌ Categoría no válida. Disponibles: \`${todas.join('`, `')}\``
      );
    }

    await (message.channel as any).send({
      embeds: [{ title: `🔞 ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`, image: { url: imageUrl }, color: 0xFF69B4, footer: { text: `Powered by ${apiUsada}` } }],
    });
  },
};

export default comando;
