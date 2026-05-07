import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';
import { Comando } from '../../types';
import { getShopItems, getCosmeticItems, buyItem, ShopItem } from '../../sistemas/inventory';
import { getWallet, getGuildEconomySettings } from '../../sistemas/economy';

// ─── Categorías ───────────────────────────────────────────────────────────────

type Category = 'all' | 'pet_food' | 'pet_toy' | 'consumable' | 'cosmetic';

const CATEGORIES: { id: Category; label: string; emoji: string }[] = [
  { id: 'all',        label: 'Resumen',    emoji: '🏪' },
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
  const [wallet, settings] = await Promise.all([
    getWallet(userId, guildId),
    getGuildEconomySettings(guildId),
  ]);

  const cat = CATEGORIES.find(c => c.id === category)!;
  const footerText = `Tu saldo: ${settings.currency_emoji} ${wallet.balance.toLocaleString()} ${settings.currency_name}  •  !tienda comprar <slug>`;

  // ── Pestaña Resumen: muestra conteo por categoría ─────────────────────────
  if (category === 'all') {
    const [foods, toys, boosts, cosmetics] = await Promise.all([
      getShopItems('pet_food'),
      getShopItems('pet_toy'),
      getShopItems('consumable'),
      getCosmeticItems(),
    ]);

    return new EmbedBuilder()
      .setTitle(`🏪 Tienda — ${guildName}`)
      .setDescription('Selecciona una categoría con los botones para ver los ítems disponibles.')
      .setColor(0x3498db)
      .addFields(
        { name: '🍖 Comida para mascotas', value: `${foods.length} ítems disponibles`, inline: true },
        { name: '🎾 Juguetes para mascotas', value: `${toys.length} ítems disponibles`, inline: true },
        { name: '⚡ Boosts de XP/juegos', value: `${boosts.length} ítems disponibles`, inline: true },
        { name: '🎨 Cosméticos', value: `${cosmetics.length} ítems (colores, títulos, marcos)`, inline: true },
      )
      .setFooter({ text: footerText })
      .setTimestamp();
  }

  // ── Categorías específicas ────────────────────────────────────────────────
  const allItems = category === 'cosmetic'
    ? await getCosmeticItems()
    : await getShopItems(category);

  if (allItems.length === 0) {
    return new EmbedBuilder()
      .setTitle(`${cat.emoji} Tienda — ${cat.label}`)
      .setDescription('No hay ítems en esta categoría por ahora.')
      .setColor(0x3498db)
      .setFooter({ text: footerText });
  }

  // Agrupar cosméticos por subtipo para mejor presentación
  if (category === 'cosmetic') {
    const colors  = allItems.filter((i: ShopItem) => i.type === 'color');
    const titles  = allItems.filter((i: ShopItem) => i.type === 'title');
    const frames  = allItems.filter((i: ShopItem) => i.type === 'frame');
    const other   = allItems.filter((i: ShopItem) => !['color','title','frame'].includes(i.type));

    const fields: { name: string; value: string; inline: boolean }[] = [];

    if (colors.length) fields.push({
      name: '🎨 Colores de perfil',
      value: colors.map((i: ShopItem) => `${i.emoji} **${i.name}** — ${settings.currency_emoji} ${i.price.toLocaleString()} \`${i.slug}\``).join('\n'),
      inline: false,
    });
    if (titles.length) fields.push({
      name: '🏷️ Títulos',
      value: titles.map((i: ShopItem) => `${i.emoji} **${i.name}** — ${settings.currency_emoji} ${i.price.toLocaleString()} \`${i.slug}\`\n*${i.description}*`).join('\n'),
      inline: false,
    });
    if (frames.length) fields.push({
      name: '🖼️ Marcos de perfil',
      value: frames.map((i: ShopItem) => `${i.emoji} **${i.name}** — ${settings.currency_emoji} ${i.price.toLocaleString()} \`${i.slug}\`\n*${i.description}*`).join('\n'),
      inline: false,
    });
    if (other.length) fields.push({
      name: '📦 Otros',
      value: other.map((i: ShopItem) => `${i.emoji} **${i.name}** — ${settings.currency_emoji} ${i.price.toLocaleString()} \`${i.slug}\``).join('\n'),
      inline: false,
    });

    // Truncar fields que superen 1024 chars
    const safeFields = fields.map(f => ({
      ...f,
      value: f.value.length > 1024 ? f.value.slice(0, 1020) + '...' : f.value,
    }));

    return new EmbedBuilder()
      .setTitle(`${cat.emoji} Tienda — ${cat.label} | ${guildName}`)
      .setColor(0x9b59b6)
      .addFields(safeFields)
      .setFooter({ text: footerText })
      .setTimestamp();
  }

  // Otras categorías: lista simple
  const lines = allItems.map((item: ShopItem) =>
    `${item.emoji} **${item.name}** — ${settings.currency_emoji} ${item.price.toLocaleString()} \`${item.slug}\`\n*${item.description}*`
  ).join('\n\n');

  return new EmbedBuilder()
    .setTitle(`${cat.emoji} Tienda — ${cat.label} | ${guildName}`)
    .setDescription(lines.length > 4096 ? lines.slice(0, 4090) + '...' : lines)
    .setColor(0x3498db)
    .setFooter({ text: footerText })
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
