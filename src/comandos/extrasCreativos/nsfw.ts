import { Comando } from '../../types';
import { fetchWaifuImage } from '../../canvas/waifuApi';

const TAGS: Record<string, string> = {
  ero:     'Contenido erótico general',
  ecchi:   'Contenido sugerente parcial',
  hentai:  'Contenido explícito',
  oppai:   'Grandes pechos',
  milf:    'Mujeres maduras',
  ass:     'Contenido de trasero',
  oral:    'Contenido oral',
  paizuri: 'Paizuri',
};

const comando: Comando = {
  nombre: 'nsfw',
  descripcion: 'Imágenes NSFW de alta calidad (waifu.im) — solo en canales NSFW',
  uso: `!nsfw [${Object.keys(TAGS).join('|')}]`,
  nsfw: true,
  ejecutar: async (message, args) => {
    if (!(message.channel as any).nsfw)
      return message.reply({
        embeds: [{
          title: '🔞 Canal no permitido',
          description: 'Este comando solo puede usarse en canales marcados como **NSFW**.',
          color: 0xe74c3c,
        }],
      });

    const tag = (args[0] ?? 'ero').toLowerCase().replace(/\s+/g, '-');

    if (!TAGS[tag]) {
      const lista = Object.entries(TAGS).map(([k, v]) => `\`${k}\` — ${v}`).join('\n');
      return message.reply({
        embeds: [{
          title: '🔞 Categorías disponibles',
          description: lista,
          color: 0xe74c3c,
          footer: { text: 'Uso: !nsfw [categoría]  •  Powered by waifu.im' },
        }],
      });
    }

    const image = await fetchWaifuImage(tag, true);
    if (!image) return message.reply('❌ No se encontraron imágenes. Intenta de nuevo.');

    const accentInt = parseInt((image.dominantColor ?? '#e74c3c').replace('#', ''), 16);
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
        title: `🔞 ${tag.charAt(0).toUpperCase() + tag.slice(1)}`,
        image: { url: image.url },
        color: accentInt,
        fields,
        footer: { text: `waifu.im • ID: ${image.id}` },
      }],
    });
  },
};

export default comando;
