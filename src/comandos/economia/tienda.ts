import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';
import { Comando } from '../../types';
import { getShopItems, buyItem, ShopItem } from '../../sistemas/inventory';
import { getWallet, getGuildEconomySettings } from '../../sistemas/economy';

// ─── Categorías ───────────────────────────────────────────────────────────────

type Category = 'all' | 'pet_food' | 'pet_toy' | 'consumable' | 'cosmetic';

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'all',        label: 'Todo',       emoji: '🏪' },
  { id: 'pet_food',   label: 'Comida',     emoji: '🍖' },
  { id: 'pet_toy',    label: 'Juguetes',   emoji: '🎾' },
  { id: 'consumable', label: 'Boosts',     emoji: '⚡' },
  { id: 'cosmetic',   label: 'Cosméticos', emoji: '🎨' },
];

// ─── Builders ─────────────────────────────────────────────────────────────────

async function buildShopEmbed(
  guildId: string,
  userId: string,
  category: Category,
  guildName: string,
): Promise<EmbedBuilder> {
  const [allItems, wallet, settings] = await Promise.all([
    getShopItems(category === 'all' ? undefined : category),
    getWallet(userId, guildId),
    getGuildEconomySettings(guildId),
  ]);

  const cat = CATEGORIES.find(c => c.id === category)!;

  if (allItems.length === 0) {
    return new EmbedBuilder()
      .setTitle(`${cat.emoji} Tienda — ${cat.label}`)
      .setDescription('No hay ítems en esta categoría por ahora.')
      .setColor(0x3498db);
  }

  const itemLines = allItems.map((item: ShopItem) =>
    [
      `${item.emoji} **${item.name}** — ${settings.currency_emoji} **${item.price.toLocaleString()}**`,
      `> ${item.description}`,
      `> Comprar: \`!tienda comprar ${item.slug}\``,
    ].join('\n')
  );

  return new EmbedBuilder()
    .setTitle(`${cat.emoji} Tienda — ${cat.label} | ${guildName}`)
    .setDescription(itemLines.join('\n\n'))
    .setColor(0x3498db)
    .setFooter({
      text: `Tu saldo: ${settings.currency_emoji} ${wallet.balance.toLocaleString()} ${settings.currency_name}  •  !tienda comprar <slug>`,
    })
    .setTimestamp();
}

function buildRow(active: Category) {
  // Discord permite máx 5 botones por fila
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...CATEGORIES.map(cat =>
      new ButtonBuilder()
        .setCustomId(`shop_${cat.id}`)
        .setLabel(`${cat.emoji} ${cat.label}`)
        .setStyle(active === cat.id ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );
}

// ─── Comando ──────────────────────────────────────────────────────────────────

const comando: Comando = {
  nombre: 'tienda',
  alias: ['shop', 'store'],
  descripcion: 'Explora la tienda por categorías o compra un ítem',
  uso: '!tienda | !tienda comprar <slug> [cantidad]',
  categoria: 'economia',
  ejecutar: async (message, args) => {
    const guildId   = message.guild!.id;
    const guildName = message.guild!.name;
    const settings  = await getGuildEconomySettings(guildId);

    // ── Subcomando comprar ────────────────────────────────────────────────────
    if (args[0]?.toLowerCase() === 'comprar') {
      const slug     = args[1];
      const quantity = Math.max(1, parseInt(args[2] ?? '1') || 1);

      if (!slug) {
        return message.reply('❌ Indica el slug del ítem. Ej: `!tienda comprar pet_food_basic`');
      }

      const result = await buyItem(message.author.id, guildId, slug, quantity);

      if (result.reason === 'not_found') {
        return message.reply(`❌ Ítem \`${slug}\` no encontrado. Usa \`!tienda\` para ver los disponibles.`);
      }
      if (result.reason === 'insufficient_funds') {
        return message.reply(`❌ No tienes suficientes ${settings.currency_name}. Usa \`!balance\` para ver tu saldo.`);
      }

      const totalCost = result.item!.price * quantity;
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle('🛒 ¡Compra exitosa!')
            .setDescription(
              `Compraste **${result.item!.emoji} ${result.item!.name}** ×${quantity}\n` +
              `Costo: ${settings.currency_emoji} **${totalCost.toLocaleString()}** ${settings.currency_name}`
            )
            .setColor(0x2ecc71)
            .setFooter({ text: '!inventario para ver tus ítems' }),
        ],
      });
    }

    // ── Vista de tienda con botones ───────────────────────────────────────────
    let active: Category = 'all';
    const embed = await buildShopEmbed(guildId, message.author.id, active, guildName);
    const row   = buildRow(active);

    const sent = await message.reply({ embeds: [embed], components: [row] });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === message.author.id,
      time: 120_000,
    });

    collector.on('collect', async (interaction) => {
      await interaction.deferUpdate();

      const picked = interaction.customId.replace('shop_', '') as Category;
      if (picked !== active) {
        active = picked;
        const newEmbed = await buildShopEmbed(guildId, message.author.id, active, guildName);
        await interaction.editReply({ embeds: [newEmbed], components: [buildRow(active)] });
      }
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        ...CATEGORIES.map(cat =>
          new ButtonBuilder()
            .setCustomId(`shop_${cat.id}`)
            .setLabel(`${cat.emoji} ${cat.label}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
      );
      await sent.edit({ components: [disabledRow] }).catch(() => {});
    });
  },
};

export default comando;
