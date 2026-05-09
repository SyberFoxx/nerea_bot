import {
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ComponentType, EmbedBuilder, AttachmentBuilder,
} from 'discord.js';
import { Comando } from '../../types';
import { generateDiceImage } from '../../canvas/diceCanvas';
import { getWallet, updateBalance, getGuildEconomySettings } from '../../sistemas/economy';
import { getPetGameBonus } from '../../sistemas/pets';

// ─── Duelos pendientes ────────────────────────────────────────────────────────
interface PendingDuel {
  challengerId: string;
  targetId:     string;
  amount:       number;
  guildId:      string;
  type:         DuelType;
  expiresAt:    number;
}

type DuelType = 'dados' | 'moneda';

const pendingDuels = new Map<string, PendingDuel>(); // key: messageId

// ─── Lógica de duelo ──────────────────────────────────────────────────────────

async function playDiceDuel(
  challengerId: string,
  targetId: string,
  guildId: string,
  amount: number,
  settings: any,
): Promise<{ embed: EmbedBuilder; files: AttachmentBuilder[] }> {
  // Cada jugador tira 2 dados
  const c1 = Math.ceil(Math.random() * 6), c2 = Math.ceil(Math.random() * 6);
  const t1 = Math.ceil(Math.random() * 6), t2 = Math.ceil(Math.random() * 6);
  const cSum = c1 + c2, tSum = t1 + t2;

  let winnerId: string | null = null;
  let loserId:  string | null = null;

  if (cSum > tSum)      { winnerId = challengerId; loserId = targetId; }
  else if (tSum > cSum) { winnerId = targetId;     loserId = challengerId; }
  // Empate: nadie gana, se devuelve el dinero

  const [petBonusC, petBonusT] = await Promise.all([
    getPetGameBonus(challengerId, guildId),
    getPetGameBonus(targetId, guildId),
  ]);

  if (winnerId && loserId) {
    const winnerBonus = winnerId === challengerId ? petBonusC : petBonusT;
    const finalPayout = Math.floor(amount * winnerBonus);
    await updateBalance(loserId,  guildId, -amount,       'game_loss', `Duelo de dados vs <@${winnerId}>`);
    await updateBalance(winnerId, guildId,  finalPayout,  'game_win',  `Duelo de dados vs <@${loserId}>`);
  }

  // Canvas del retador
  const bufC = generateDiceImage({
    die1: c1, die2: c2,
    accentColor:   winnerId === challengerId ? '#2ecc71' : winnerId === null ? '#f1c40f' : '#e74c3c',
    won:           winnerId === challengerId,
    result:        winnerId === challengerId ? 'win' : 'lose',
    label:         `<@${challengerId}> tiró ${cSum}`,
    betAmount:     amount,
    payout:        winnerId === challengerId ? amount : 0,
    balance:       0,
    username:      `Retador`,
    currencyEmoji: settings.currency_emoji,
    currencyName:  settings.currency_name,
  });

  const bufT = generateDiceImage({
    die1: t1, die2: t2,
    accentColor:   winnerId === targetId ? '#2ecc71' : winnerId === null ? '#f1c40f' : '#e74c3c',
    won:           winnerId === targetId,
    result:        winnerId === targetId ? 'win' : 'lose',
    label:         `<@${targetId}> tiró ${tSum}`,
    betAmount:     amount,
    payout:        winnerId === targetId ? amount : 0,
    balance:       0,
    username:      `Retado`,
    currencyEmoji: settings.currency_emoji,
    currencyName:  settings.currency_name,
  });

  const attachC = new AttachmentBuilder(bufC, { name: 'dado_retador.png' });
  const attachT = new AttachmentBuilder(bufT, { name: 'dado_retado.png' });

  const resultLine = winnerId === null
    ? `🤝 **¡Empate!** (${cSum} vs ${tSum}) — Se devuelve la apuesta`
    : `🏆 **¡<@${winnerId}> gana!** (${winnerId === challengerId ? cSum : tSum} vs ${winnerId === challengerId ? tSum : cSum})\n` +
      `${settings.currency_emoji} **+${amount.toLocaleString()}** para el ganador`;

  const embed = new EmbedBuilder()
    .setTitle('🎲 Duelo de Dados — Resultado')
    .setDescription(resultLine)
    .setColor(winnerId === null ? 0xf1c40f : 0x2ecc71)
    .addFields(
      { name: `🎲 <@${challengerId}>`, value: `Tiró **${c1}** + **${c2}** = **${cSum}**`, inline: true },
      { name: `🎲 <@${targetId}>`,     value: `Tiró **${t1}** + **${t2}** = **${tSum}**`, inline: true },
    )
    .setFooter({ text: `Apuesta: ${settings.currency_emoji} ${amount.toLocaleString()}` });

  return { embed, files: [attachC, attachT] };
}

async function playCoinDuel(
  challengerId: string,
  targetId: string,
  guildId: string,
  amount: number,
  settings: any,
): Promise<EmbedBuilder> {
  const flip    = Math.random() < 0.5;
  const winnerId = flip ? challengerId : targetId;
  const loserId  = flip ? targetId : challengerId;

  const [petBonusW] = await Promise.all([
    getPetGameBonus(winnerId, guildId),
  ]);

  const finalPayout = Math.floor(amount * petBonusW);
  await updateBalance(loserId,  guildId, -amount,      'game_loss', `Duelo moneda vs <@${winnerId}>`);
  await updateBalance(winnerId, guildId,  finalPayout, 'game_win',  `Duelo moneda vs <@${loserId}>`);

  return new EmbedBuilder()
    .setTitle(`${flip ? '🪙 Cara' : '🪙 Cruz'} — Duelo de Moneda`)
    .setDescription(
      `La moneda cayó en **${flip ? 'Cara' : 'Cruz'}**\n\n` +
      `🏆 **¡<@${winnerId}> gana!**\n` +
      `${settings.currency_emoji} **+${finalPayout.toLocaleString()}** ${settings.currency_name}`
    )
    .setColor(0xf1c40f)
    .addFields(
      { name: '🎯 Cara', value: `<@${challengerId}>`, inline: true },
      { name: '🎯 Cruz', value: `<@${targetId}>`,     inline: true },
    )
    .setFooter({ text: `Apuesta: ${settings.currency_emoji} ${amount.toLocaleString()}` });
}

// ─── Comando ──────────────────────────────────────────────────────────────────

const comando: Comando = {
  nombre: 'duelo',
  alias: ['duel', 'retar', 'apostar'],
  descripcion: 'Reta a otro usuario a un duelo apostando monedas',
  uso: '!duelo @usuario <cantidad> [dados|moneda]',
  categoria: 'juegos',
  ejecutar: async (message, args) => {
    const guildId  = message.guild!.id;
    const userId   = message.author.id;
    const settings = await getGuildEconomySettings(guildId);

    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Menciona al usuario que quieres retar. Ej: `!duelo @usuario 500`');
    if (target.id === userId) return message.reply('❌ No puedes retarte a ti mismo.');
    if (target.bot) return message.reply('❌ No puedes retar a un bot.');

    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount < 50)  return message.reply(`❌ La apuesta mínima para duelos es ${settings.currency_emoji} **50**.`);
    if (amount > 100_000)              return message.reply(`❌ La apuesta máxima es ${settings.currency_emoji} **100,000**.`);

    const duelType: DuelType = (args[2]?.toLowerCase() === 'moneda') ? 'moneda' : 'dados';

    // Verificar saldo del retador
    const challengerWallet = await getWallet(userId, guildId);
    if (challengerWallet.balance < amount) {
      return message.reply(`❌ No tienes suficientes ${settings.currency_name}. Saldo: ${settings.currency_emoji} **${challengerWallet.balance.toLocaleString()}**.`);
    }

    // Verificar saldo del retado
    const targetWallet = await getWallet(target.id, guildId);
    if (targetWallet.balance < amount) {
      return message.reply(`❌ ${target.username} no tiene suficientes ${settings.currency_name} para esta apuesta.`);
    }

    // ── Enviar desafío ────────────────────────────────────────────────────────
    const typeLabel = duelType === 'dados' ? '🎲 Dados' : '🪙 Moneda';
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('duel_accept')
        .setLabel('✅ Aceptar duelo')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('duel_decline')
        .setLabel('❌ Rechazar')
        .setStyle(ButtonStyle.Danger),
    );

    const challengeMsg = await message.reply({
      content: `${target} — ¡Te han retado!`,
      embeds: [
        new EmbedBuilder()
          .setTitle(`⚔️ Desafío de ${typeLabel}`)
          .setDescription(
            `**${message.author.username}** reta a **${target.username}** a un duelo de **${typeLabel}**\n\n` +
            `💰 Apuesta: ${settings.currency_emoji} **${amount.toLocaleString()}** ${settings.currency_name}\n\n` +
            `*${target.username} tiene 60 segundos para aceptar o rechazar.*`
          )
          .setColor(0xf1c40f)
          .setFooter({ text: `El ganador se lleva todo • Tipo: ${typeLabel}` }),
      ],
      components: [row],
    });

    // Guardar duelo pendiente
    pendingDuels.set(challengeMsg.id, {
      challengerId: userId,
      targetId:     target.id,
      amount,
      guildId,
      type:         duelType,
      expiresAt:    Date.now() + 60_000,
    });

    // ── Collector de respuesta ────────────────────────────────────────────────
    const collector = challengeMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === target.id,
      time: 60_000,
      max: 1,
    });

    collector.on('collect', async (interaction) => {
      await interaction.deferUpdate();
      const duel = pendingDuels.get(challengeMsg.id);
      if (!duel) return;
      pendingDuels.delete(challengeMsg.id);

      if (interaction.customId === 'duel_decline') {
        await challengeMsg.edit({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setTitle('⚔️ Duelo rechazado')
              .setDescription(`**${target.username}** rechazó el duelo.`)
              .setColor(0xe74c3c),
          ],
          components: [],
        });
        return;
      }

      // Aceptó — jugar
      await challengeMsg.edit({
        content: '',
        embeds: [
          new EmbedBuilder()
            .setTitle('⚔️ ¡Duelo en curso!')
            .setDescription(`**${message.author.username}** vs **${target.username}** — ${typeLabel}`)
            .setColor(0xf1c40f),
        ],
        components: [],
      });

      await new Promise(r => setTimeout(r, 1500));

      if (duelType === 'dados') {
        const { embed, files } = await playDiceDuel(userId, target.id, guildId, amount, settings);
        await challengeMsg.edit({ embeds: [embed], files, components: [] });
      } else {
        const embed = await playCoinDuel(userId, target.id, guildId, amount, settings);
        await challengeMsg.edit({ embeds: [embed], components: [] });
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'time' && pendingDuels.has(challengeMsg.id)) {
        pendingDuels.delete(challengeMsg.id);
        await challengeMsg.edit({
          content: '',
          embeds: [
            new EmbedBuilder()
              .setTitle('⚔️ Duelo expirado')
              .setDescription(`**${target.username}** no respondió a tiempo.`)
              .setColor(0x95a5a6),
          ],
          components: [],
        }).catch(() => {});
      }
    });
  },
};

export default comando;
