import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, EmbedBuilder } from 'discord.js';
import { Comando } from '../../types';
import { getInventory, ShopItem } from '../../sistemas/inventory';
import { getEquipped } from '../../sistemas/cosmetics';

// Tipos que se pueden equipar y en qué slot
const EQUIP_SLOT: Record<string, string> = {
  frame:    'marco',
  title:    'título',
  color:    'color',
  cosmetic: 'marco',
};

function getEquipHint(item: ShopItem): string | null {
  const slot = EQUIP_SLOT[item.type];
  if (!slot) return null;
  return `\`!equipar ${item.slug}\` para equipar como ${slot}`;
}

function getUseHint(item: ShopItem): string | null {
  if (item.type === 'pet_food')   return `\`!alimentar ${item.slug}\` para darle de comer a tu mascota`;
  if (item.type === 'pet_toy')    return `\`!jugar ${item.slug}\` para jugar con tu mascota`;
  if (item.type === 'consumable') return `\`!usar ${item.slug}\` para activar el boost`;
  return null;
}

type Category = 'all' | 'cosmetic' | 'pet' | 'consumable';

const CATS: { id: Category; label: string; emoji: string }[] = [
  { id: 'all',        label: 'Todo',       emoji: '🎒' },
  { id: 'cosmetic',   label: 'Cosméticos', emoji: '✨' },
  { id: 'pet',        label: 'Mascotas',   emoji: '🐾' },
  { id: 'consumable', label: 'Boosts',     emoji: '⚡' },
];

function filterItems(items: ReturnType<typeof getInventory> extends Promise<infer T> ? T : never, cat: Category) {
  if (cat === 'all') return items;
  if (cat === 'cosmetic') return items.filter(e => ['frame','title','color','cosmetic'].includes(e.shop_items.type));
  if (cat === 'pet')      return items.filter(e => ['pet_food','pet_toy'].includes(e.shop_items.type));
  if (cat === 'consumable') return items.filter(e => e.shop_items.type === 'consumable');
  return items;
}

async function buildInventoryEmbed(
  userId: string,
  guildId: string,
  username: string,
  avatarUrl: string,
  cat: Category,
): Promise<EmbedBuilder> {
  const [allItems, equipped] = await Promise.all([
    getInventory(userId, guildId),
    getEquipped(userId, guildId),
  ]);

  const items = filterItems(allItems, cat);
  const catMeta = CATS.find(c => c.id === cat)!;

  if (allItems.length === 0) {
    return new EmbedBuilder()
      .setTitle('🎒 Inventario vacío')
      .setDescription('No tienes ningún ítem todavía.\nVisita la `!tienda` para comprar.')
      .setColor(0x95a5a6)
      .setThumbnail(avatarUrl);
  }

  if (items.length === 0) {
    return new EmbedBuilder()
      .setTitle(`${catMeta.emoji} Inventario — ${catMeta.label}`)
      .setDescription('No tienes ítems en esta categoría.')
      .setColor(0x95a5a6)
      .setThumbnail(avatarUrl);
  }

  const lines = items.map(entry => {
    const item     = entry.shop_items;
    const equipHint = getEquipHint(item);
    const useHint   = getUseHint(item);
    const hint      = equipHint ?? useHint ?? '';

    // Marcar si está equipado actualmente
    const isEquipped =
      equipped.equipped_frame === item.slug ||
      equipped.equipped_title === item.slug ||
      equipped.equipped_color === item.slug;

    const equippedTag = isEquipped ? ' ✅ **[EQUIPADO]**' : '';

    return [
      `${item.emoji} **${item.name}** ×${entry.quantity}${equippedTag}`,
      `> *${item.description}*`,
      hint ? `> 💡 ${hint}` : '',
    ].filter(Boolean).join('\n');
  });

  // Cosméticos equipados actualmente
  const equippedLines: string[] = [];
  if (equipped.equipped_frame) equippedLines.push(`🖼️ Marco: \`${equipped.equipped_frame}\``);
  if (equipped.equipped_title) equippedLines.push(`🏷️ Título: \`${equipped.equipped_title}\``);
  if (equipped.equipped_color) equippedLines.push(`🎨 Color: \`${equipped.equipped_color}\``);

  const embed = new EmbedBuilder()
    .setTitle(`${catMeta.emoji} Inventario de ${username} — ${catMeta.label}`)
    .setDescription(lines.join('\n\n'))
    .setColor(0x9b59b6)
    .setThumbnail(avatarUrl);

  if (equippedLines.length > 0 && (cat === 'all' || cat === 'cosmetic')) {
    embed.addFields({
      name: '✨ Cosméticos activos',
      value: equippedLines.join('\n') + '\n\n`!equipar quitar <frame|title|color>` para desequipar',
      inline: false,
    });
  }

  embed.setFooter({
    text: [
      '💡 Cómo usar tus ítems:',
      '  Cosméticos → !equipar <slug>',
      '  Comida mascota → !alimentar <slug>',
      '  Juguete mascota → !jugar <slug>',
      '  Ver equipado → !equipar ver',
    ].join('\n'),
  });

  return embed;
}

function buildRow(active: Category) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    CATS.map(c =>
      new ButtonBuilder()
        .setCustomId(`inv_${c.id}`)
        .setLabel(`${c.emoji} ${c.label}`)
        .setStyle(active === c.id ? ButtonStyle.Primary : ButtonStyle.Secondary)
    )
  );
}

const comando: Comando = {
  nombre: 'inventario',
  alias: ['inv', 'mochila'],
  descripcion: 'Muestra tu inventario con instrucciones de uso',
  uso: '!inventario',
  categoria: 'economia',
  ejecutar: async (message) => {
    const guildId   = message.guild!.id;
    const userId    = message.author.id;
    const username  = message.author.username;
    const avatarUrl = message.author.displayAvatarURL({ size: 64 });

    let active: Category = 'all';
    const embed = await buildInventoryEmbed(userId, guildId, username, avatarUrl, active);
    const row   = buildRow(active);

    const sent = await message.reply({ embeds: [embed], components: [row] });

    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === userId,
      time: 120_000,
    });

    collector.on('collect', async (interaction) => {
      await interaction.deferUpdate();
      const picked = interaction.customId.replace('inv_', '') as Category;
      if (picked !== active) {
        active = picked;
        const newEmbed = await buildInventoryEmbed(userId, guildId, username, avatarUrl, active);
        await interaction.editReply({ embeds: [newEmbed], components: [buildRow(active)] });
      }
    });

    collector.on('end', async () => {
      const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        CATS.map(c =>
          new ButtonBuilder()
            .setCustomId(`inv_${c.id}`)
            .setLabel(`${c.emoji} ${c.label}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        )
      );
      await sent.edit({ components: [disabledRow] }).catch(() => {});
    });
  },
};

export default comando;
