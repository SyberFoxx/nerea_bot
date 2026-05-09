import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { Comando } from '../../types';
import { generateDiceImage } from '../../canvas/diceCanvas';
import { getWallet, updateBalance, getGuildEconomySettings } from '../../sistemas/economy';
import { getPetGameBonus } from '../../sistemas/pets';

// ─── Cooldown ─────────────────────────────────────────────────────────────────
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 5_000;

// ─── Reglas de Craps simplificado ─────────────────────────────────────────────
// 7 u 11 en el primer tiro → gana x2
// 2, 3 o 12 → pierde (craps)
// Cualquier otro → "punto", hay que repetirlo antes de sacar 7

type BetType = 'pass' | 'nopass' | 'any7' | 'doubles' | 'high' | 'low';

interface BetInfo {
  label:      string;
  desc:       string;
  multiplier: number;
}

const BET_TYPES: Record<BetType, BetInfo> = {
  pass:    { label: 'Pase',        desc: 'Gana con 7 u 11, pierde con 2, 3 o 12',  multiplier: 1 },
  nopass:  { label: 'No Pase',     desc: 'Gana con 2 o 3, pierde con 7 u 11',      multiplier: 1 },
  any7:    { label: 'Cualquier 7', desc: 'Gana solo si la suma es exactamente 7',   multiplier: 4 },
  doubles: { label: 'Dobles',      desc: 'Gana si ambos dados son iguales',         multiplier: 5 },
  high:    { label: 'Alto (9-12)', desc: 'Gana si la suma es 9, 10, 11 o 12',      multiplier: 1 },
  low:     { label: 'Bajo (2-5)',  desc: 'Gana si la suma es 2, 3, 4 o 5',         multiplier: 1 },
};

function evaluateBet(bet: BetType, d1: number, d2: number): boolean {
  const sum = d1 + d2;
  switch (bet) {
    case 'pass':    return sum === 7 || sum === 11;
    case 'nopass':  return sum === 2 || sum === 3;
    case 'any7':    return sum === 7;
    case 'doubles': return d1 === d2;
    case 'high':    return sum >= 9;
    case 'low':     return sum <= 5;
  }
}

function buildHelpEmbed(currencyEmoji: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('🎲 Dados — Guía de apuestas')
    .setColor(0x3498db)
    .setDescription('Usa `!dados <apuesta> <cantidad>` para jugar.')
    .addFields(
      { name: '🎯 Tipos de apuesta', value:
        Object.entries(BET_TYPES).map(([k, v]) =>
          `\`${k}\` — **${v.label}** (×${v.multiplier + 1})\n*${v.desc}*`
        ).join('\n\n'),
        inline: false,
      },
      { name: `${currencyEmoji} Límites`, value: 'Mínimo: **10** • Máximo: **25,000**', inline: false },
      { name: '💡 Ejemplo', value: '`!dados pass 500` — Apuesta 500 al pase\n`!dados doubles 200` — Apuesta a dobles', inline: false },
    );
}

const comando: Comando = {
  nombre: 'dados',
  alias: ['dice', 'craps'],
  descripcion: 'Juega a los dados y apuesta tus monedas',
  uso: '!dados <pass|nopass|any7|doubles|high|low> <cantidad>',
  categoria: 'juegos',
  ejecutar: async (message, args) => {
    const guildId  = message.guild!.id;
    const userId   = message.author.id;
    const settings = await getGuildEconomySettings(guildId);

    if (!args[0] || args[0] === 'ayuda' || args[0] === 'help') {
      return message.reply({ embeds: [buildHelpEmbed(settings.currency_emoji)] });
    }

    // Cooldown
    const lastUsed = cooldowns.get(userId) ?? 0;
    if (Date.now() - lastUsed < COOLDOWN_MS) {
      const rem = ((COOLDOWN_MS - (Date.now() - lastUsed)) / 1000).toFixed(1);
      return message.reply(`⏳ Espera **${rem}s** antes de volver a tirar.`);
    }

    const betType = args[0].toLowerCase() as BetType;
    if (!BET_TYPES[betType]) {
      return message.reply(`❌ Apuesta inválida. Opciones: \`${Object.keys(BET_TYPES).join('`, `')}\`\nUsa \`!dados ayuda\` para más info.`);
    }

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 10)   return message.reply(`❌ Mínimo ${settings.currency_emoji} **10**.`);
    if (amount > 25_000)                return message.reply(`❌ Máximo ${settings.currency_emoji} **25,000**.`);

    const wallet = await getWallet(userId, guildId);
    if (wallet.balance < amount) {
      return message.reply(`❌ Saldo insuficiente. Tienes ${settings.currency_emoji} **${wallet.balance.toLocaleString()}**.`);
    }

    cooldowns.set(userId, Date.now());

    // ── Tirar dados ───────────────────────────────────────────────────────────
    const d1  = Math.ceil(Math.random() * 6);
    const d2  = Math.ceil(Math.random() * 6);
    const won = evaluateBet(betType, d1, d2);
    const bet = BET_TYPES[betType];

    // Bonus de mascota
    const petBonus    = await getPetGameBonus(userId, guildId);
    const basePayout  = won ? amount * (bet.multiplier + 1) : 0;
    const finalPayout = won ? Math.floor(basePayout * petBonus) : 0;
    const netChange   = won ? finalPayout - amount : -amount;

    await updateBalance(
      userId, guildId,
      netChange,
      won ? 'game_win' : 'game_loss',
      `Dados: ${bet.label} — ${d1}+${d2}=${d1+d2}`
    );
    const newWallet = await getWallet(userId, guildId);

    // ── Canvas ────────────────────────────────────────────────────────────────
    const buf = generateDiceImage({
      die1: d1, die2: d2,
      accentColor:   won ? '#2ecc71' : '#e74c3c',
      won,
      result:        won ? 'win' : 'lose',
      label:         `Apuesta: ${bet.label} — Suma: ${d1 + d2}`,
      betAmount:     amount,
      payout:        finalPayout,
      balance:       newWallet.balance,
      username:      message.author.username,
      currencyEmoji: settings.currency_emoji,
      currencyName:  settings.currency_name,
    });

    const attach = new AttachmentBuilder(buf, { name: 'dados.png' });
    const petLine = won && petBonus > 1
      ? `\n🐾 Bonus mascota: **+${((petBonus - 1) * 100).toFixed(0)}%**`
      : '';

    await message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`🎲 ${d1} + ${d2} = **${d1 + d2}**`)
          .setDescription(
            won
              ? `✨ **¡Ganaste!** ${settings.currency_emoji} **+${finalPayout.toLocaleString()}** (×${bet.multiplier + 1})${petLine}`
              : `💸 **Perdiste** ${settings.currency_emoji} **-${amount.toLocaleString()}**`
          )
          .setImage('attachment://dados.png')
          .setColor(won ? 0x2ecc71 : 0xe74c3c)
          .setFooter({ text: `Saldo: ${settings.currency_emoji} ${newWallet.balance.toLocaleString()} • !dados ayuda` }),
      ],
      files: [attach],
    });
  },
};

export default comando;
