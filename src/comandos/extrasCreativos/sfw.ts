import { Comando } from '../../types';
import { fetchWaifuImage } from '../../canvas/waifuApi';

const TAGS: Record<string, string> = {
  'waifu':          'Personajes femeninos anime',
  'maid':           'Chicas en uniforme de doncella',
  'uniform':        'Uniformes y cosplay',
  'selfies':        'Estilo foto realista',
  'genshin-impact': 'Personajes de Genshin Impact',
  'raiden-shogun':  'Raiden Shogun de Genshin',
  'marin-kitagawa': 'My Dress-Up Darling',
};

const comando: Comando = {
  nombre: 'sfw',
  descripcion: 'Imágenes SFW de alta calidad (waifu.im)',
  uso: `!sfw [${Object.keys(TAGS).join('|')}]`,
  ejecutar: async (message, args) => {
    const tag = (args[0] ?? 'waifu').toLowerCase().replace(/\s+/g, '-');

    if (!TAGS[tag]) {
      const lista = Object.entries(TAGS).map(([k, v]) => `\`${k}\` — ${v}`).join('\n');
      return message.reply({
        embeds: [{
          title: '✅ Categorías disponibles',
          description: lista,
          color: 0x2ecc71,
          footer: { text: 'Uso: !sfw [categoría]  •  Powered by waifu.im' },
        }],
      });
    }

    const image = await fetchWaifuImage(tag, false);
    if (!image) return message.reply('❌ No se encontraron imágenes. Intenta de nuevo.');

    const accentInt = parseInt((image.dominantColor ?? '#2ecc71').replace('#', ''), 16);
    const fields: any[] = [];
    if (image.artists.length > 0) {
      const a    = image.artists[0];
      const link = a.pixivUrl ? ` — [Pixiv](${a.pixivUrl})` : '';
      fields.push({ name: '🎨 Artista', value: `${a.name}${link}`, inline: true });
    }
    if (image.source) fields.push({ name: '🔗 Fuente', value: `[Ver original](${image.source as string})`, inline: true });
    fields.push({ name: '📐 Resolución', value: `${image.width} × ${image.height}`, inline: true });

    await (message.channel as any).send({
      embeds: [{
        title: `✅ ${tag.charAt(0).toUpperCase() + tag.slice(1).replace(/-/g, ' ')}`,
        image: { url: image.url },
        color: accentInt,
        fields,
        footer: { text: `waifu.im • ID: ${image.id}` },
      }],
    });
  },
};

export default comando;
