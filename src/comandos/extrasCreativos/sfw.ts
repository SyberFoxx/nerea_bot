import axios from 'axios';
import { Comando } from '../../types';

const categoriasWaifu = ['waifu', 'neko', 'shinobu', 'megumin', 'bully', 'cuddle', 'cry', 'hug', 'awoo', 'kiss', 'lick', 'pat', 'smug', 'bonk', 'yeet', 'blush', 'smile', 'wave', 'highfive', 'handhold', 'nom', 'bite', 'glomp', 'slap', 'kill', 'kick', 'happy', 'wink', 'poke', 'dance', 'cringe'];
const categoriasNekos = ['neko', 'waifu', 'hug', 'pat', 'kiss', 'tickle', 'poke', 'feed', 'cuddle', 'slap', 'smug', 'baka', 'happy'];

const comando: Comando = {
  nombre: 'sfw',
  descripcion: 'Muestra una imagen SFW (Safe For Work)',
  uso: '!sfw [categoría]',
  ejecutar: async (message, args) => {
    const categoria = (args[0] ?? 'waifu').toLowerCase();
    let imageUrl: string | null = null;
    let apiUsada = '';

    if (categoriasWaifu.includes(categoria)) {
      try {
        const r = await axios.get<{ url: string }>(`https://api.waifu.pics/sfw/${categoria}`);
        if (r.data?.url) { imageUrl = r.data.url; apiUsada = 'waifu.pics'; }
      } catch { /* continuar */ }
    }

    if (!imageUrl && categoriasNekos.includes(categoria)) {
      try {
        const r = await axios.get<{ url: string }>(`https://nekos.life/api/v2/img/${categoria}`);
        if (r.data?.url) { imageUrl = r.data.url; apiUsada = 'nekos.life'; }
      } catch { /* continuar */ }
    }

    if (!imageUrl) {
      for (const alt of ['waifu', 'neko', 'pat', 'hug']) {
        try {
          const r = await axios.get<{ url: string }>(`https://api.waifu.pics/sfw/${alt}`);
          if (r.data?.url) { imageUrl = r.data.url; apiUsada = `waifu.pics (alt: ${alt})`; break; }
        } catch { /* continuar */ }
      }
    }

    if (!imageUrl) {
      const todas = [...new Set([...categoriasWaifu, ...categoriasNekos])];
      return message.reply(
        todas.includes(categoria)
          ? `❌ La categoría "${categoria}" no está disponible ahora.`
          : `❌ Categoría no válida. Populares: \`waifu\`, \`neko\`, \`hug\`, \`pat\`, \`kiss\``
      );
    }

    await (message.channel as any).send({
      embeds: [{ title: `✨ ${categoria.charAt(0).toUpperCase() + categoria.slice(1)}`, image: { url: imageUrl }, color: 0x00FF7F, footer: { text: `Powered by ${apiUsada}` } }],
    });
  },
};

export default comando;
