import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';
import { Comando } from '../../types';
import {
  adoptPet,
  getPetTypes,
  getPetType,
  RARITY_META,
  Rarity,
  PetType,
} from '../../sistemas/pets';
import { getWallet, getGuildEconomySettings } from '../../sistemas/economy';

const xpSystem = require('../../sistemas/xpSystem');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPerks(stats: PetType['base_stats']): string {
  const lines: string[] = [];
  if (stats.xp_bonus)    lines.push(`⭐ +${(stats.xp_bonus * 100).toFixed(0)}% XP`);
  if (stats.daily_bonus) lines.push(`🎁 +${(stats.daily_bonus * 100).toFixed(0)}% Daily/Weekly`);
  if (stats.game_bonus)  lines.push(`🎰 +${(stats.game_bonus * 100).toFixed(0)}% Juegos`);
  if (stats.lucky)       lines.push(`🍀 ${(stats.lucky * 100).toFixed(0)}% Lucky (no gasta ítem)`);
  if (stats.mute_shield) lines.push(`🛡️ Escudo anti-mute`);
  return lines.length ? lines.join(' • ') : 'Sin perks especiales';
}

async function buildRarityEmbed(
  rarity: Rarity,
  guildId: string,
  userId: string,
): Promise<EmbedBuilder> {
  const meta     = RARITY_META[rarity];
  const [types, wallet, settings, xpData] = await Promise.all([
    getPetTypes(rarity),
    getWallet(userId, guildId),
    getGuildEconomySettings(guildId),
    xpSystem.getUserXP(userId, guildId),
  ]);

  const userLevel: number = xpData.level;

  const lines = types.map((t: PetType) => {
    const locked    = userLevel < t.min_level;
    const free      = t.price === 0;
    const canAfford = wallet.balance >= t.price;
    const status    = locked
      ? `🔒 Nivel ${t.min_level} requerido`
      : free
        ? '✅ Gratis'
        : canAfford
          ? `${settings.currency_emoji} ${t.price.toLocaleString()}`
          : `❌ ${settings.currency_emoji} ${t.price.toLocaleString()} (saldo insuficiente)`;

    return [
      `${locked ? '~~' : ''}${t.emoji} **${t.name}** \`${t.slug}\`${locked ? '~~' : ''}`,
      `> ${t.description}`,
      `> ${formatPerks(t.base_stats)}`,
      `> ${status}`,
    ].join('\n');
  });

  return new EmbedBuilder()
    .setTitle(`${meta.emoji} Mascotas ${meta.label}`)
    .setDescription(lines.join('\n\n') || 'No hay mascotas en esta categoría.')
    .setColor(meta.color)
    .setFooter({
      text: `Tu nivel: ${userLevel}  •  Saldo: ${settings.currency_emoji} ${wallet.balance.toLocaleString()}  •  !adoptar <slug> <nombre>`,
    })
    .setTimestamp();
}

function buildRarityRow(active: Rarity) {
  const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    rarities.map(r =>
      new ButtonBuilder()
        .setCustomId(`adopt_${r}`)
        .setLabel(`${RARITY_META[r].emoji} ${RARITY_META[r].label}`)
        .setStyle(active === r ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );
}

// ─── Comando ──────────────────────────────────────────────────────────────────

const comando: Comando = {
  nombre: 'adoptar',
  alias: ['adopt'],
  descripcion: 'Adopta una mascota o explora las disponibles',
  uso: '!adoptar | !adoptar <slug> <nombre>',
  categoria: 'mascotas',
  ejecutar: async (message, args) => {
    const guildId  = message.guild!.id;
    const userId   = message.author.id;
    const settings = await getGuildEconomySettings(guildId);

    // ── Adoptar directamente: !adoptar <slug> <nombre> ────────────────────────
    if (args[0] && args[0].toLowerCase() !== 'ver') {
      const typeSlug = args[0].toLowerCase();
      const name     = args.slice(1).join(' ').trim();

      if (!name) {
        return message.reply(`❌ Dale un nombre a tu mascota. Ej: \`!adoptar cat Luna\``);
      }
      if (name.length > 32) {
        return message.reply('❌ El nombre no puede tener más de 32 caracteres.');
      }

      const xpData   = await xpSystem.getUserXP(userId, guildId);
      const userLevel: number = xpData.level;

      const result = await adoptPet(userId, guildId, typeSlug, name, userLevel);

      if (!result.success) {
        const reason = (result as any).reason as string;
        switch (reason) {
          case 'already_has_pet':
            return message.reply('❌ Ya tienes una mascota. Usa `!mascota` para verla.');
          case 'invalid_type': {
            return message.reply(`❌ Tipo \`${typeSlug}\` no existe. Usa \`!adoptar\` para ver los disponibles.`);
          }
          case 'level_too_low': {
            const type = await getPetType(typeSlug);
            return message.reply(
              `❌ Necesitas nivel **${type?.min_level}** para adoptar esta mascota. Tu nivel actual: **${userLevel}**.`
            );
          }
          case 'insufficient_funds': {
            const type = await getPetType(typeSlug);
            return message.reply(
              `❌ No tienes suficientes ${settings.currency_name}. Esta mascota cuesta ${settings.currency_emoji} **${type?.price.toLocaleString()}**.`
            );
          }
        }
      }

      const type = await getPetType(typeSlug);
      const meta = RARITY_META[type!.rarity];

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${type!.emoji} ¡Adoptaste a **${name}**!`)
            .setDescription(
              `Tu nueva mascota **${type!.name}** (${meta.emoji} ${meta.label}) ya está contigo.\n` +
              `Cuídala bien — aliméntala con \`!alimentar\` y juega con ella con \`!jugar\`.`
            )
            .setColor(meta.color)
            .addFields(
              { name: '🍖 Hambre',    value: '100/100', inline: true },
              { name: '😊 Felicidad', value: '100/100', inline: true },
              { name: '⭐ Nivel',     value: '1',        inline: true },
              { name: '✨ Perks',     value: formatPerks(type!.base_stats), inline: false },
            )
            .setFooter({ text: '!mascota para ver su estado • !alimentar y !jugar para cuidarla' }),
        ],
      });
    }

    // ── Explorador con botones ────────────────────────────────────────────────
    let active: Rarity = 'common';
    const embed = await buildRarityEmbed(active, guildId, userId);
    const row   = buildRarityRow(active);

    const sent = await message.reply({ embeds: [embed], components: [row] });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === userId,
      time: 120_000,
    });

    collector.on('collect', async (interaction) => {
      await interaction.deferUpdate();
      const picked = interaction.customId.replace('adopt_', '') as Rarity;
      if (picked !== active) {
        active = picked;
        const newEmbed = await buildRarityEmbed(active, guildId, userId);
        await interaction.editReply({ embeds: [newEmbed], components: [buildRarityRow(active)] });
      }
    });

    collector.on('end', async () => {
      const rarities: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        rarities.map(r =>
          new ButtonBuilder()
            .setCustomId(`adopt_${r}`)
            .setLabel(`${RARITY_META[r].emoji} ${RARITY_META[r].label}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
      );
      await sent.edit({ components: [disabledRow] }).catch(() => {});
    });
  },
};

export default comando;
