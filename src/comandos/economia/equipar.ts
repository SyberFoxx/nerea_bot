import { EmbedBuilder } from 'discord.js';
import { Comando } from '../../types';
import { equipCosmetic, unequipCosmetic, getEquipped, CosmeticSlot } from '../../sistemas/cosmetics';
import { getInventory } from '../../sistemas/inventory';

const SLOT_LABELS: Record<CosmeticSlot, string> = {
  frame: '🖼️ Marco',
  title: '🏷️ Título',
  color: '🎨 Color',
};

const comando: Comando = {
  nombre: 'equipar',
  alias: ['equip', 'usar'],
  descripcion: 'Equipa un cosmético de tu inventario',
  uso: '!equipar <slug> | !equipar ver | !equipar quitar <frame|title|color>',
  categoria: 'economia',
  ejecutar: async (message, args) => {
    const guildId = message.guild!.id;
    const userId  = message.author.id;
    const sub     = args[0]?.toLowerCase();

    // ── !equipar ver ──────────────────────────────────────────────────────
    if (!sub || sub === 'ver') {
      const equipped = await getEquipped(userId, guildId);

      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`✨ Cosméticos equipados — ${message.author.username}`)
            .setColor(0x9b59b6)
            .addFields(
              {
                name: '🖼️ Marco',
                value: equipped.equipped_frame
                  ? `\`${equipped.equipped_frame}\``
                  : '*Ninguno*',
                inline: true,
              },
              {
                name: '🏷️ Título',
                value: equipped.equipped_title
                  ? `\`${equipped.equipped_title}\``
                  : '*Ninguno*',
                inline: true,
              },
              {
                name: '🎨 Color',
                value: equipped.equipped_color
                  ? `\`${equipped.equipped_color}\``
                  : '*Ninguno (usa color del rol)*',
                inline: true,
              },
            )
            .setFooter({ text: '!equipar <slug> para equipar • !equipar quitar <slot> para desequipar' }),
        ],
      });
    }

    // ── !equipar quitar <slot> ────────────────────────────────────────────
    if (sub === 'quitar' || sub === 'remove') {
      const slot = args[1]?.toLowerCase() as CosmeticSlot;
      if (!slot || !['frame', 'title', 'color'].includes(slot)) {
        return message.reply('❌ Indica el slot: `frame`, `title` o `color`. Ej: `!equipar quitar frame`');
      }
      await unequipCosmetic(userId, guildId, slot);
      return message.reply(`✅ ${SLOT_LABELS[slot]} desequipado.`);
    }

    // ── !equipar <slug> ───────────────────────────────────────────────────
    const slug = sub;
    const result = await equipCosmetic(userId, guildId, slug);

    if (!result.success) {
      switch ((result as any).reason) {
        case 'not_owned':
          return message.reply(`❌ No tienes \`${slug}\` en tu inventario. Cómpralo en \`!tienda\`.`);
        case 'wrong_slot':
          return message.reply(`❌ \`${slug}\` no es un cosmético equipable.`);
        case 'invalid_slug':
          return message.reply(`❌ Ítem \`${slug}\` no encontrado.`);
      }
    }

    // Obtener info del ítem para el mensaje
    const inventory = await getInventory(userId, guildId);
    const entry     = inventory.find(e => e.item_slug === slug);
    const item      = entry?.shop_items;

    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✨ ¡Cosmético equipado!')
          .setDescription(
            item
              ? `${item.emoji} **${item.name}** equipado correctamente.\nSe verá en tu \`/perfil\`.`
              : `\`${slug}\` equipado correctamente.`
          )
          .setColor(0x9b59b6)
          .setFooter({ text: '!equipar ver para ver tus cosméticos activos • /perfil para verlo' }),
      ],
    });
  },
};

export default comando;
