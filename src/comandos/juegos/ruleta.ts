import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { Comando } from '../../types';
import {
  generateRouletteWheel,
  generateBetTable,
  checkWin,
  getBetMultiplier,
  formatBetLabel,
  WHEEL_ORDER,
  NUMBER_COLOR,
  Roulettebet,
} from '../../canvas/rouletteCanvas';
import { getWallet, updateBalance, getGuildEconomySettings } from '../../sistemas/economy';
import { getPetGameBonus } from '../../sistemas/pets';

// ─── Cooldown anti-spam ───────────────────────────────────────────────────────
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 10_000;

// ─── Parser de apuesta ────────────────────────────────────────────────────────

function parseBet(input: string): Roulettebet | null {
  const s = input.toLowerCase().trim();
  const num = parseInt(s);
  if (!isNaN(num) && num >= 0 && num <= 36) return { type: 'number', value: num };
  if (s === 'rojo'   || s === 'red')    return { type: 'color',  value: 'red' };
  if (s === 'negro'  || s === 'black')  return { type: 'color',  value: 'black' };
  if (s === 'verde'  || s === 'green')  return { type: 'color',  value: 'green' };
  if (s === 'par'    || s === 'even')   return { type: 'parity', value: 'even' };
  if (s === 'impar'  || s === 'odd')    return { type: 'parity', value: 'odd' };
  if (s === 'bajo'   || s === 'low'  || s === '1-18')  return { type: 'half', value: 'low' };
  if (s === 'alto'   || s === 'high' || s === '19-36') return { type: 'half', value: 'high' };
  if (s === 'd1' || s === 'docena1' || s === '1-12')  return { type: 'dozen', value: 1 };
  if (s === 'd2' || s === 'docena2' || s === '13-24') return { type: 'dozen', value: 2 };
  if (s === 'd3' || s === 'docena3' || s === '25-36') return { type: 'dozen', value: 3 };
  if (s === 'c1' || s === 'col1' || s === 'columna1') return { type: 'column', value: 1 };
  if (s === 'c2' || s === 'col2' || s === 'columna2') return { type: 'column', value: 2 };
  if (s === 'c3' || s === 'col3' || s === 'columna3') return { type: 'column', value: 3 };
  return null;
}

// ─── Ayuda ────────────────────────────────────────────────────────────────────

function buildHelpEmbed(currencyEmoji: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🎰 Ruleta Europea — Guía de apuestas')
    .setColor(0x27ae60)
    .setDescription('Usa `!ruleta <apuesta> <cantidad>` para jugar.')
    .addFields(
      { name: '🎯 Número exacto (×35)', value: '`!ruleta 7 100` — Apuesta al número 7\n`!ruleta 0 50` — Apuesta al cero', inline: false },
      { name: '🔴⚫ Color (×1)',        value: '`!ruleta rojo 200`\n`!ruleta negro 200`', inline: true },
      { name: '🔢 Paridad (×1)',        value: '`!ruleta par 100`\n`!ruleta impar 100`', inline: true },
      { name: '📊 Mitad (×1)',          value: '`!ruleta bajo 100` — 1-18\n`!ruleta alto 100` — 19-36', inline: true },
      { name: '📋 Docenas (×2)',        value: '`!ruleta d1 100` — 1-12\n`!ruleta d2 100` — 13-24\n`!ruleta d3 100` — 25-36', inline: true },
      { name: '📐 Columnas (×2)',       value: '`!ruleta c1 100`\n`!ruleta c2 100`\n`!ruleta c3 100`', inline: true },
      { name: `${currencyEmoji} Límites`, value: 'Mínimo: **10** • Máximo: **50,000**', inline: false },
    )
    .setFooter({ text: 'El 0 solo gana si apuestas directamente al 0 o al color verde' });
}

// ─── Animación de giro ────────────────────────────────────────────────────────

/**
 * Genera los ángulos de rotación para simular desaceleración.
 * La rueda empieza rápido y frena progresivamente hasta el ángulo final.
 */
function buildSpinFrames(finalAngle: number, totalSpins = 5): number[] {
  // Ángulo total recorrido: varias vueltas completas + ángulo final
  const totalAngle = Math.PI * 2 * totalSpins + finalAngle;

  // 6 frames con ease-out (desaceleración cuadrática)
  const frameCount = 6;
  const frames: number[] = [];

  for (let i = 1; i <= frameCount; i++) {
    // t va de 0 a 1, ease-out: t = 1 - (1-progress)^2
    const progress = i / frameCount;
    const eased    = 1 - Math.pow(1 - progress, 2.5);
    frames.push(eased * totalAngle);
  }

  return frames;
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Comando ──────────────────────────────────────────────────────────────────

const comando: Comando = {
  nombre: 'ruleta',
  alias: ['roulette', 'rul'],
  descripcion: 'Juega a la ruleta europea y apuesta tus monedas',
  uso: '!ruleta <apuesta> <cantidad> | !ruleta ayuda',
  categoria: 'juegos',
  ejecutar: async (message, args) => {
    const guildId  = message.guild!.id;
    const userId   = message.author.id;
    const settings = await getGuildEconomySettings(guildId);

    if (!args[0] || args[0].toLowerCase() === 'ayuda' || args[0].toLowerCase() === 'help') {
      return message.reply({ embeds: [buildHelpEmbed(settings.currency_emoji)] });
    }

    // Cooldown
    const lastUsed = cooldowns.get(userId) ?? 0;
    const elapsed  = Date.now() - lastUsed;
    if (elapsed < COOLDOWN_MS) {
      const remaining = ((COOLDOWN_MS - elapsed) / 1000).toFixed(1);
      return message.reply(`⏳ Espera **${remaining}s** antes de volver a girar.`);
    }

    const bet = parseBet(args[0]);
    if (!bet) {
      return message.reply(`❌ Apuesta inválida: \`${args[0]}\`\nUsa \`!ruleta ayuda\` para ver las opciones.`);
    }

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 10)     return message.reply(`❌ La apuesta mínima es ${settings.currency_emoji} **10**.`);
    if (amount > 50_000)                  return message.reply(`❌ La apuesta máxima es ${settings.currency_emoji} **50,000**.`);

    const wallet = await getWallet(userId, guildId);
    if (wallet.balance < amount) {
      return message.reply(
        `❌ No tienes suficientes ${settings.currency_name}.\n` +
        `Tu saldo: ${settings.currency_emoji} **${wallet.balance.toLocaleString()}**`
      );
    }

    cooldowns.set(userId, Date.now());

    // ── Calcular resultado ANTES de animar ────────────────────────────────────
    const result    = Math.floor(Math.random() * 37);
    const won       = checkWin(bet, result);
    const mult      = getBetMultiplier(bet);
    const payout    = won ? amount * mult : 0;
    const petBonus  = await getPetGameBonus(userId, guildId);
    const finalPayout = won ? Math.floor(payout * petBonus) : 0;
    const finalNet    = won ? finalPayout : -amount;

    // Calcular ángulo final para que el número ganador quede bajo el marcador
    const winnerIdx  = WHEEL_ORDER.indexOf(result);
    const slotAngle  = (Math.PI * 2) / WHEEL_ORDER.length;
    // Marcador en -π/2 (arriba). Queremos que el centro del slot ganador quede ahí.
    const finalAngle = (-Math.PI / 2) - (winnerIdx * slotAngle) - (slotAngle / 2);

    // Frames de animación con desaceleración
    const frames = buildSpinFrames(
      ((finalAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    );

    // ── Frame inicial — rueda en posición de inicio ───────────────────────────
    const frame0 = generateRouletteWheel({ result: null, rotation: 0 });
    const attach0 = new AttachmentBuilder(frame0, { name: 'ruleta.png' });

    const spinMsg = await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎰 ¡Girando la ruleta!')
          .setDescription(
            `**${message.author.username}** apostó ${settings.currency_emoji} **${amount.toLocaleString()}** a **"${formatBetLabel(bet)}"**`
          )
          .setImage('attachment://ruleta.png')
          .setColor(0xf1c40f)
          .setFooter({ text: '🎲 La bola está rodando...' }),
      ],
      files: [attach0],
    });

    // ── Frames intermedios (sin resultado, rotando) ───────────────────────────
    // Delays decrecientes: empieza rápido, frena al final
    const delays = [350, 400, 500, 650, 850, 1100];

    for (let i = 0; i < frames.length - 1; i++) {
      await sleep(delays[i] ?? 600);
      const buf    = generateRouletteWheel({ result: null, rotation: frames[i] });
      const attach = new AttachmentBuilder(buf, { name: 'ruleta.png' });
      await spinMsg.edit({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎰 ¡Girando la ruleta!')
            .setDescription(
              `**${message.author.username}** apostó ${settings.currency_emoji} **${amount.toLocaleString()}** a **"${formatBetLabel(bet)}"**`
            )
            .setImage('attachment://ruleta.png')
            .setColor(0xf1c40f)
            .setFooter({ text: '🎲 La bola está rodando...' }),
        ],
        files: [attach],
      });
    }

    // ── Frame final — rueda detenida con resultado ────────────────────────────
    await sleep(delays[frames.length - 1] ?? 1100);

    // Actualizar balance
    await updateBalance(
      userId, guildId,
      finalNet,
      won ? 'game_win' : 'game_loss',
      `Ruleta: ${formatBetLabel(bet)} — resultado ${result}`
    );
    const newWallet = await getWallet(userId, guildId);

    const resultBuf    = generateRouletteWheel({ result, rotation: finalAngle });
    const tableBuf     = generateBetTable({
      bet, result, won,
      payout:        finalPayout,
      betAmount:     amount,
      balance:       newWallet.balance,
      username:      message.author.username,
      currencyEmoji: settings.currency_emoji,
      currencyName:  settings.currency_name,
    });

    const resultAttach = new AttachmentBuilder(resultBuf, { name: 'ruleta.png' });
    const tableAttach  = new AttachmentBuilder(tableBuf,  { name: 'mesa.png' });

    const resultColor = NUMBER_COLOR[result];
    const colorEmoji  = resultColor === 'red' ? '🔴' : resultColor === 'black' ? '⚫' : '🟢';
    const embedColor  = won ? 0x2ecc71 : 0xe74c3c;

    const petBonusLine = won && petBonus > 1
      ? `\n🐾 Bonus mascota: **+${((petBonus - 1) * 100).toFixed(0)}%**`
      : '';

    await spinMsg.edit({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${colorEmoji} Cayó el **${result}**`)
          .setDescription(
            `**${message.author.username}** apostó a **"${formatBetLabel(bet)}"**\n\n` +
            (won
              ? `✨ **¡GANASTE!** ${settings.currency_emoji} **+${finalPayout.toLocaleString()}** (×${mult})${petBonusLine}`
              : `💸 **Perdiste** ${settings.currency_emoji} **-${amount.toLocaleString()}**`)
          )
          .setImage('attachment://ruleta.png')
          .setColor(embedColor)
          .setFooter({ text: `Saldo: ${settings.currency_emoji} ${newWallet.balance.toLocaleString()} • !ruleta ayuda` }),
        new EmbedBuilder()
          .setImage('attachment://mesa.png')
          .setColor(embedColor),
      ],
      files: [resultAttach, tableAttach],
    });
  },
};

export default comando;
