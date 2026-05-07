import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  AttachmentBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ComponentType,
} from 'discord.js';
import { createCanvas, loadImage, SKRSContext2D } from '@napi-rs/canvas';
import { SlashComando } from '../../types';
import { fetchWaifuImage, WaifuImage } from '../../canvas/waifuApi';

// ─── Tags ─────────────────────────────────────────────────────────────────────

const SFW_TAGS = [
  { slug: 'waifu',          label: 'Waifu',          emoji: '🌸', desc: 'Personajes femeninos anime' },
  { slug: 'maid',           label: 'Maid',            emoji: '🧹', desc: 'Chicas en uniforme de doncella' },
  { slug: 'uniform',        label: 'Uniform',         emoji: '👘', desc: 'Uniformes y cosplay' },
  { slug: 'selfies',        label: 'Selfies',         emoji: '📸', desc: 'Estilo foto realista' },
  { slug: 'genshin-impact', label: 'Genshin Impact',  emoji: '⚔️', desc: 'Personajes de Genshin' },
  { slug: 'raiden-shogun',  label: 'Raiden Shogun',   emoji: '⚡', desc: 'Raiden Shogun de Genshin' },
  { slug: 'marin-kitagawa', label: 'Marin Kitagawa',  emoji: '🪡', desc: 'My Dress-Up Darling' },
] as const;

const NSFW_TAGS = [
  { slug: 'ero',     label: 'Ero',     emoji: '🔥', desc: 'Contenido erótico general' },
  { slug: 'ecchi',   label: 'Ecchi',   emoji: '💋', desc: 'Contenido sugerente parcial' },
  { slug: 'hentai',  label: 'Hentai',  emoji: '🔞', desc: 'Contenido explícito' },
  { slug: 'oppai',   label: 'Oppai',   emoji: '🍒', desc: 'Grandes pechos' },
  { slug: 'milf',    label: 'MILF',    emoji: '👩', desc: 'Mujeres maduras atractivas' },
  { slug: 'ass',     label: 'Ass',     emoji: '🍑', desc: 'Contenido de trasero' },
  { slug: 'oral',    label: 'Oral',    emoji: '💦', desc: 'Contenido oral' },
  { slug: 'paizuri', label: 'Paizuri', emoji: '🎀', desc: 'Contenido de paizuri' },
] as const;

// ─── Canvas: frame decorativo ─────────────────────────────────────────────────

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function roundRect(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

async function generateImageFrame(opts: {
  imageUrl:      string;
  tag:           string;
  isNsfw:        boolean;
  artistName?:   string | null;
  artistPixiv?:  string | null;
  source?:       string;
  dominantColor: string;
}): Promise<Buffer> {
  const img    = await loadImage(opts.imageUrl);
  const maxW   = 800;
  const scale  = Math.min(1, maxW / img.width);
  const imgW   = Math.round(img.width  * scale);
  const imgH   = Math.round(img.height * scale);
  const barH   = 52;
  const W      = imgW;
  const H      = imgH + barH;

  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');
  const accent = opts.dominantColor.startsWith('#') ? opts.dominantColor : (opts.isNsfw ? '#e74c3c' : '#2ecc71');
  const { r, g, b } = hexToRgb(accent);

  // Imagen principal
  ctx.drawImage(img, 0, 0, imgW, imgH);

  // Overlay degradado en la parte inferior de la imagen
  const overlay = ctx.createLinearGradient(0, imgH - 50, 0, imgH);
  overlay.addColorStop(0, 'transparent');
  overlay.addColorStop(1, 'rgba(0,0,0,0.65)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, imgH - 50, W, 50);

  // Barra inferior
  const barY = imgH;
  const barGrad = ctx.createLinearGradient(0, barY, W, barY + barH);
  barGrad.addColorStop(0, '#0d0d1a');
  barGrad.addColorStop(1, '#111128');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, barY, W, barH);

  // Línea de acento superior de la barra
  const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
  lineGrad.addColorStop(0, `rgba(${r},${g},${b},0)`);
  lineGrad.addColorStop(0.1, accent);
  lineGrad.addColorStop(0.9, accent);
  lineGrad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = lineGrad;
  ctx.fillRect(0, barY, W, 2);

  // Badge de tag
  const tagLabel = opts.tag.charAt(0).toUpperCase() + opts.tag.slice(1).replace(/-/g, ' ');
  ctx.font = 'bold 13px sans-serif';
  const tagW = ctx.measureText(tagLabel).width + 20;

  ctx.fillStyle = `rgba(${r},${g},${b},0.2)`;
  roundRect(ctx, 10, barY + 13, tagW, 26, 13); ctx.fill();
  ctx.strokeStyle = `rgba(${r},${g},${b},0.6)`;
  ctx.lineWidth = 1;
  roundRect(ctx, 10, barY + 13, tagW, 26, 13); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(tagLabel, 10 + tagW / 2, barY + 31);

  // Badge SFW/NSFW
  const nsfwLabel = opts.isNsfw ? '🔞 NSFW' : '✅ SFW';
  const nsfwColor = opts.isNsfw ? '#e74c3c' : '#2ecc71';
  const nsfwW = ctx.measureText(nsfwLabel).width + 20;
  ctx.fillStyle = `${nsfwColor}33`;
  roundRect(ctx, 18 + tagW, barY + 13, nsfwW, 26, 13); ctx.fill();
  ctx.strokeStyle = `${nsfwColor}99`;
  roundRect(ctx, 18 + tagW, barY + 13, nsfwW, 26, 13); ctx.stroke();
  ctx.fillStyle = nsfwColor;
  ctx.fillText(nsfwLabel, 18 + tagW + nsfwW / 2, barY + 31);

  // Artista y fuente (derecha)
  ctx.textAlign = 'right';
  if (opts.artistName) {
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Art: ${opts.artistName}`, W - 10, barY + 24);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '11px sans-serif';
  ctx.fillText('waifu.im', W - 10, barY + 42);

  return canvas.toBuffer('image/png');
}

// ─── Función de envío ─────────────────────────────────────────────────────────

async function sendImage(
  interaction: ChatInputCommandInteraction,
  tag: string,
  isNsfw: boolean
): Promise<void> {
  const image = await fetchWaifuImage(tag, isNsfw);

  const replyFn = (opts: any) =>
    interaction.deferred || interaction.replied
      ? interaction.editReply(opts)
      : interaction.followUp(opts);

  if (!image) {
    await replyFn({
      embeds: [{
        title: '❌ Sin resultados',
        description: `No se encontraron imágenes para **${tag}**. Intenta con otra categoría.`,
        color: 0xe74c3c,
      }],
    });
    return;
  }

  const artist     = image.artists?.[0] ?? null;
  const accentHex  = image.dominantColor?.startsWith('#') ? image.dominantColor : (isNsfw ? '#e74c3c' : '#2ecc71');
  const accentInt  = parseInt(accentHex.replace('#', ''), 16);
  const tagInfo    = (isNsfw ? NSFW_TAGS : SFW_TAGS).find(t => t.slug === tag);

  const fields: any[] = [];
  if (artist?.name) {
    const link = artist.pixivUrl ? ` — [Pixiv](${artist.pixivUrl})` : '';
    fields.push({ name: '🎨 Artista', value: `${artist.name}${link}`, inline: true });
  }
  if (image.source) fields.push({ name: '🔗 Fuente', value: `[Ver original](${image.source})`, inline: true });
  fields.push({ name: '📐 Resolución', value: `${image.width} × ${image.height}`, inline: true });

  try {
    const buffer = await generateImageFrame({
      imageUrl:      image.url,
      tag,
      isNsfw:        image.isNsfw,
      artistName:    artist?.name ?? null,
      artistPixiv:   artist?.pixivUrl ?? null,
      source:        image.source,
      dominantColor: accentHex,
    });

    const attachment = new AttachmentBuilder(buffer, { name: 'imagen.png' });
    await replyFn({
      files: [attachment],
      embeds: [{
        color: accentInt,
        title: `${tagInfo?.emoji ?? (isNsfw ? '🔞' : '✅')} ${tagInfo?.label ?? tag}`,
        image: { url: 'attachment://imagen.png' },
        fields,
        footer: { text: `waifu.im • ID: ${image.id}` },
      }],
    });
  } catch {
    // Fallback sin canvas
    await replyFn({
      embeds: [{
        title: `${tagInfo?.emoji ?? (isNsfw ? '🔞' : '✅')} ${tagInfo?.label ?? tag}`,
        image: { url: image.url },
        color: accentInt,
        fields,
        footer: { text: `waifu.im • ID: ${image.id}` },
      }],
    });
  }
}

// ─── Slash Command ────────────────────────────────────────────────────────────

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('imagen')
    .setDescription('Imágenes anime de alta calidad (waifu.im)')
    .addSubcommand(sub =>
      sub.setName('sfw')
        .setDescription('Imágenes Safe For Work')
        .addStringOption(opt =>
          opt.setName('tag').setDescription('Categoría').setRequired(false)
            .addChoices(...SFW_TAGS.map(t => ({ name: `${t.emoji} ${t.label} — ${t.desc}`, value: t.slug })))
        )
    )
    .addSubcommand(sub =>
      sub.setName('nsfw')
        .setDescription('Imágenes NSFW — solo en canales NSFW')
        .addStringOption(opt =>
          opt.setName('tag').setDescription('Categoría').setRequired(false)
            .addChoices(...NSFW_TAGS.map(t => ({ name: `${t.emoji} ${t.label} — ${t.desc}`, value: t.slug })))
        )
    ),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const sub    = interaction.options.getSubcommand() as 'sfw' | 'nsfw';
    const isNsfw = sub === 'nsfw';

    if (isNsfw && !(interaction.channel as any)?.nsfw) {
      return interaction.reply({
        embeds: [{
          title: '🔞 Canal no permitido',
          description: 'Este comando solo puede usarse en canales marcados como **NSFW**.',
          color: 0xe74c3c,
        }],
        ephemeral: true,
      });
    }

    const tagArg = interaction.options.getString('tag');
    const tags   = isNsfw ? NSFW_TAGS : SFW_TAGS;

    // Sin tag → select menu
    if (!tagArg) {
      const select = new StringSelectMenuBuilder()
        .setCustomId(`imagen_tag_${sub}_${interaction.id}`)
        .setPlaceholder(`${isNsfw ? '🔞' : '✅'} Elige una categoría...`)
        .addOptions(
          tags.map(t =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`${t.emoji} ${t.label}`)
              .setDescription(t.desc)
              .setValue(t.slug)
          )
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

      await interaction.reply({
        embeds: [{
          title: isNsfw ? '🔞 Imágenes NSFW' : '✅ Imágenes SFW',
          description: tags.map(t => `${t.emoji} **${t.label}** — ${t.desc}`).join('\n'),
          color: isNsfw ? 0xe74c3c : 0x2ecc71,
          footer: { text: 'Powered by waifu.im • Selecciona una categoría' },
        }],
        components: [row],
        ephemeral: true,
      });

      try {
        const collected = await (interaction.channel as any).awaitMessageComponent({
          filter: (i: any) => i.customId === `imagen_tag_${sub}_${interaction.id}` && i.user.id === interaction.user.id,
          componentType: ComponentType.StringSelect,
          time: 30_000,
        });
        await collected.deferUpdate();
        await interaction.editReply({ content: '⏳ Buscando imagen...', embeds: [], components: [] });
        await sendImage(interaction, collected.values[0], isNsfw);
      } catch {
        await interaction.editReply({ content: '⏰ Tiempo agotado.', embeds: [], components: [] });
      }
      return;
    }

    await interaction.deferReply();
    await sendImage(interaction, tagArg, isNsfw);
  },
};

export default comando;
