import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { Comando } from '../../types';
import { spinReel, evaluateSlots, generateSlotsImage, SLOT_SYMBOLS } from '../../canvas/slotsCanvas';
import { getWallet, updateBalance, getGuildEconomySettings } from '../../sistemas/economy';
import { getPetGameBonus } from '../../sistemas/pets';

// ─── Cooldown ─────────────────────────────────────────────────────────────────
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 4_000;

const comando: Comando = {
  nombre: 'slots',
  alias: ['tragamonedas', 'slot'],
  descripcion: 'Juega a las tragamonedas y apuesta tus monedas',
  uso: '!slots <cantidad>',
  categoria: 'juegos',
  ejecutar: async (message, args) => {
    const guildId  = message.guild!.id;
    const userId   = message.author.id;
    const settings = await getGuildEconomySettings(guildId);

    // Ayuda
    if (!args[0] || args[0] === 'ayuda' || args[0] === 'help') {
      const symbolList = SLOT_SYMBOLS.map(s =>
        `${s.emoji} **${s.label}** — ×${s.multiplier} (tres iguales)`
      ).join('\n');

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🎰 Slots — Tabla de pagos')
            .setColor(0x9b59b6)
            .setDescription(
              '**Tres iguales** → Multiplica tu apuesta por el valor del símbolo\n' +
              '**Dos iguales** → Ganas 30% del multiplicador\n\n' +
              symbolList
            )
            .addFields({
              name: `${settings.currency_emoji} Límites`,
              value: 'Mínimo: **10** • Máximo: **10,000**',
            })
            .setFooter({ text: 'Uso: !slots <cantidad>  •  Ej: !slots 500' }),
        ],
      });
    }

    // Cooldown
    const lastUsed = cooldowns.get(userId) ?? 0;
    if (Date.now() - lastUsed < COOLDOWN_MS) {
      const rem = ((COOLDOWN_MS - (Date.now() - lastUsed)) / 1000).toFixed(1);
      return message.reply(`⏳ Espera **${rem}s** antes de volver a girar.`);
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 10)  return message.reply(`❌ Mínimo ${settings.currency_emoji} **10**.`);
    if (amount > 10_000)               return message.reply(`❌ Máximo ${settings.currency_emoji} **10,000**.`);

    const wallet = await getWallet(userId, guildId);
    if (wallet.balance < amount) {
      return message.reply(`❌ Saldo insuficiente. Tienes ${settings.currency_emoji} **${wallet.balance.toLocaleString()}**.`);
    }

    cooldowns.set(userId, Date.now());

    // ── Girar carretes ────────────────────────────────────────────────────────
    const reels  = [spinReel(), spinReel(), spinReel()] as [typeof reels[0], typeof reels[0], typeof reels[0]];
    const result = evaluateSlots(reels);

    // Bonus de mascota
    const petBonus    = await getPetGameBonus(userId, guildId);
    const basePayout  = result.won ? amount * result.multiplier : 0;
    const finalPayout = result.won ? Math.floor(basePayout * petBonus) : 0;
    const netChange   = result.won ? finalPayout - amount : -amount;

    await updateBalance(
      userId, guildId,
      netChange,
      result.won ? 'game_win' : 'game_loss',
      `Slots: ${reels.map(r => r.emoji).join('')}`
    );
    const newWallet = await getWallet(userId, guildId);

    // ── Canvas ────────────────────────────────────────────────────────────────
    const buf = generateSlotsImage({
      reels,
      result,
      betAmount:     amount,
      payout:        finalPayout,
      balance:       newWallet.balance,
      username:      message.author.username,
      currencyEmoji: settings.currency_emoji,
      currencyName:  settings.currency_name,
    });

    const attach  = new AttachmentBuilder(buf, { name: 'slots.png' });
    const petLine = result.won && petBonus > 1
      ? `\n🐾 Bonus mascota: **+${((petBonus - 1) * 100).toFixed(0)}%**`
      : '';

    const title = result.isJackpot
      ? `🏆 ¡¡JACKPOT!! ${reels[0].emoji}${reels[1].emoji}${reels[2].emoji}`
      : result.isTwoMatch
        ? `✨ ¡Dos iguales! ${reels[0].emoji}${reels[1].emoji}${reels[2].emoji}`
        : `💸 Sin suerte ${reels[0].emoji}${reels[1].emoji}${reels[2].emoji}`;

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(title)
          .setDescription(
            result.won
              ? `${settings.currency_emoji} **+${finalPayout.toLocaleString()}** (×${result.multiplier})${petLine}`
              : `${settings.currency_emoji} **-${amount.toLocaleString()}**`
          )
          .setImage('attachment://slots.png')
          .setColor(result.isJackpot ? 0xffd700 : result.isTwoMatch ? 0x2ecc71 : 0xe74c3c)
          .setFooter({ text: `Saldo: ${settings.currency_emoji} ${newWallet.balance.toLocaleString()} • !slots ayuda` }),
      ],
      files: [attach],
    });
  },
};

export default comando;
