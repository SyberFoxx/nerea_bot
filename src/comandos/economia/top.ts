import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
} from 'discord.js';
import { Comando } from '../../types';
import { getLeaderboard, getGuildEconomySettings } from '../../sistemas/economy';
import { supabase } from '../../lib/supabase';

const xpSystem = require('../../sistemas/xpSystem');

const MEDALS = ['🥇', '🥈', '🥉'];

// ─── Builders de cada pestaña ─────────────────────────────────────────────────

async function buildRiquezaEmbed(guildId: string, guildName: string): Promise<EmbedBuilder> {
  const [rows, settings] = await Promise.all([
    getLeaderboard(guildId, 10),
    getGuildEconomySettings(guildId),
  ]);

  if (rows.length === 0) {
    return new EmbedBuilder()
      .setTitle(`💰 Top Riqueza — ${guildName}`)
      .setDescription('Nadie tiene monedas todavía. ¡Usa `!daily` para empezar!')
      .setColor(0xf1c40f);
  }

  const lines = rows.map((row, i) => {
    const medal = MEDALS[i] ?? `**${i + 1}.**`;
    return `${medal} <@${row.user_id}> — ${settings.currency_emoji} **${row.balance.toLocaleString()}**`;
  });

  return new EmbedBuilder()
    .setTitle(`💰 Top Riqueza — ${guildName}`)
    .setDescription(lines.join('\n'))
    .setColor(0xf1c40f)
    .setFooter({ text: `${settings.currency_name} • !daily y !weekly para ganar monedas` })
    .setTimestamp();
}

async function buildNivelEmbed(guildId: string, guildName: string, client: any): Promise<EmbedBuilder> {
  const rows: any[] = await xpSystem.getLeaderboard(guildId, 10);

  if (!rows.length) {
    return new EmbedBuilder()
      .setTitle(`⭐ Top Niveles — ${guildName}`)
      .setDescription('Nadie tiene XP todavía. ¡Escribe mensajes para ganar experiencia!')
      .setColor(0x9b59b6);
  }

  const lines: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row  = rows[i];
    const user = await client.users.fetch(row.user_id).catch(() => null);
    const name = user ? `<@${row.user_id}>` : `\`${row.user_id}\``;
    const xpNext = xpSystem.getRequiredXP(row.level);
    const pct  = Math.min(Math.floor((row.xp / xpNext) * 100), 100);
    const bar  = `${'█'.repeat(Math.floor(pct / 10))}${'░'.repeat(10 - Math.floor(pct / 10))}`;
    const medal = MEDALS[i] ?? `**${i + 1}.**`;
    lines.push(`${medal} ${name} — Nv.**${row.level}** \`${bar}\` ${pct}%`);
  }

  return new EmbedBuilder()
    .setTitle(`⭐ Top Niveles — ${guildName}`)
    .setDescription(lines.join('\n'))
    .setColor(0x9b59b6)
    .setFooter({ text: 'XP se gana enviando mensajes' })
    .setTimestamp();
}

async function buildMascotasEmbed(guildId: string, guildName: string): Promise<EmbedBuilder> {
  const { data: rows } = await supabase
    .from('user_pets')
    .select('user_id, name, level, pet_type_slug, pet_types(emoji, name)')
    .eq('guild_id', guildId)
    .order('level', { ascending: false })
    .limit(10);

  if (!rows || rows.length === 0) {
    return new EmbedBuilder()
      .setTitle(`🐾 Top Mascotas — ${guildName}`)
      .setDescription('Nadie ha adoptado una mascota todavía. ¡Usa `!adoptar` para empezar!')
      .setColor(0xe67e22);
  }

  const lines = rows.map((row: any, i: number) => {
    const medal   = MEDALS[i] ?? `**${i + 1}.**`;
    const petType = row.pet_types as any;
    const emoji   = petType?.emoji ?? '🐾';
    return `${medal} <@${row.user_id}> — ${emoji} **${row.name}** (Nv. ${row.level})`;
  });

  return new EmbedBuilder()
    .setTitle(`🐾 Top Mascotas — ${guildName}`)
    .setDescription(lines.join('\n'))
    .setColor(0xe67e22)
    .setFooter({ text: 'Cuida tu mascota para subirla de nivel • !mascota' })
    .setTimestamp();
}

// ─── Botones ──────────────────────────────────────────────────────────────────

function buildRow(active: 'riqueza' | 'nivel' | 'mascotas') {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('top_riqueza')
      .setLabel('💰 Riqueza')
      .setStyle(active === 'riqueza' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('top_nivel')
      .setLabel('⭐ Niveles')
      .setStyle(active === 'nivel' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('top_mascotas')
      .setLabel('🐾 Mascotas')
      .setStyle(active === 'mascotas' ? ButtonStyle.Primary : ButtonStyle.Secondary),
  );
}

// ─── Comando ──────────────────────────────────────────────────────────────────

const comando: Comando = {
  nombre: 'top',
  alias: ['ranking', 'ricos', 'leaderboard'],
  descripcion: 'Ranking del servidor — riqueza, niveles y mascotas',
  uso: '!top',
  categoria: 'economia',
  ejecutar: async (message) => {
    const guildId   = message.guild!.id;
    const guildName = message.guild!.name;
    const client    = message.client;

    // Pestaña inicial: riqueza
    let active: 'riqueza' | 'nivel' | 'mascotas' = 'riqueza';
    const embed = await buildRiquezaEmbed(guildId, guildName);
    const row   = buildRow(active);

    const sent = await message.reply({ embeds: [embed], components: [row] });

    // Collector — solo el autor puede cambiar de pestaña
    const collector = sent.createMessageComponentCollector({
      componentType: ComponentType.Button,
      filter: (i) => i.user.id === message.author.id,
      time: 120_000, // 2 minutos
    });

    collector.on('update', () => {});

    collector.on('collect', async (interaction) => {
      await interaction.deferUpdate();

      if (interaction.customId === 'top_riqueza')  active = 'riqueza';
      if (interaction.customId === 'top_nivel')    active = 'nivel';
      if (interaction.customId === 'top_mascotas') active = 'mascotas';

      let newEmbed: EmbedBuilder;
      if (active === 'riqueza')  newEmbed = await buildRiquezaEmbed(guildId, guildName);
      else if (active === 'nivel') newEmbed = await buildNivelEmbed(guildId, guildName, client);
      else                       newEmbed = await buildMascotasEmbed(guildId, guildName);

      await interaction.editReply({ embeds: [newEmbed], components: [buildRow(active)] });
    });

    collector.on('end', async () => {
      // Deshabilitar botones al expirar
      const disabled = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('top_riqueza').setLabel('💰 Riqueza').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('top_nivel').setLabel('⭐ Niveles').setStyle(ButtonStyle.Secondary).setDisabled(true),
        new ButtonBuilder().setCustomId('top_mascotas').setLabel('🐾 Mascotas').setStyle(ButtonStyle.Secondary).setDisabled(true),
      );
      await sent.edit({ components: [disabled] }).catch(() => {});
    });
  },
};

export default comando;
