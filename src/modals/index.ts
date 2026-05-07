import {
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ActionRowBuilder, ModalSubmitInteraction,
} from 'discord.js';
import { BlackjackGame } from '../sistemas/blackjack/gameLogic';

// ─── Constructores de modals ───────────────────────────────────────────────────

export function buildBetModal(gameId: string, balance: number): ModalBuilder {
  return new ModalBuilder()
    .setCustomId(`modal_bet_${gameId}`)
    .setTitle('💰 Realizar Apuesta')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('cantidad')
          .setLabel(`Cantidad a apostar (Saldo: $${balance})`)
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: 250')
          .setMinLength(1)
          .setMaxLength(6)
          .setRequired(true)
      )
    );
}

export function buildEncuestaModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('modal_encuesta')
    .setTitle('📊 Crear Encuesta')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('pregunta')
          .setLabel('Pregunta')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('¿Cuál es tu color favorito?')
          .setMaxLength(200)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('opciones')
          .setLabel('Opciones (una por línea, mín. 2, máx. 5)')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Rojo\nAzul\nVerde\nAmarillo')
          .setMinLength(3)
          .setMaxLength(500)
          .setRequired(true)
      )
    );
}

export function buildRecordatorioModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('modal_recordatorio')
    .setTitle('⏰ Nuevo Recordatorio')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('mensaje')
          .setLabel('¿Qué quieres recordar?')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ej: Revisar el servidor de Discord')
          .setMaxLength(300)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('tiempo')
          .setLabel('¿Cuándo? (Ej: 30m, 2h, 1d)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('30m / 2h / 1d')
          .setMinLength(2)
          .setMaxLength(5)
          .setRequired(true)
      )
    );
}

export function buildSugerenciaModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('modal_sugerencia')
    .setTitle('💡 Enviar Sugerencia')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('titulo')
          .setLabel('Título de la sugerencia')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: Agregar un canal de música')
          .setMaxLength(100)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('descripcion')
          .setLabel('Descripción detallada')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Explica tu sugerencia con más detalle...')
          .setMaxLength(1000)
          .setRequired(true)
      )
    );
}

export function buildReporteModal(): ModalBuilder {
  return new ModalBuilder()
    .setCustomId('modal_reporte')
    .setTitle('🚨 Reportar Usuario')
    .addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('usuario')
          .setLabel('Usuario a reportar (nombre o ID)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ej: usuario#1234 o 123456789')
          .setMaxLength(100)
          .setRequired(true)
      ),
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('razon')
          .setLabel('Razón del reporte')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Describe qué ocurrió...')
          .setMaxLength(1000)
          .setRequired(true)
      )
    );
}

// ─── Manejador de submissions ──────────────────────────────────────────────────

const EMOJIS = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣'];

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId } = interaction;

  // ── Apuesta de Blackjack ─────────────────────────────────────────────────
  if (customId.startsWith('modal_bet_')) {
    const gameId   = customId.replace('modal_bet_', '');
    const rawInput = interaction.fields.getTextInputValue('cantidad').trim();
    const cantidad = parseInt(rawInput);

    if (isNaN(cantidad) || cantidad <= 0) {
      await interaction.reply({ content: '❌ Ingresa un número válido mayor a 0.', ephemeral: true });
      return;
    }

    try {
      await BlackjackGame.placeBet(gameId, interaction.user.id, cantidad);

      const game    = await BlackjackGame.getGame(gameId);
      const players = await BlackjackGame.getPlayers(gameId);
      const embed   = BlackjackGame.buildEmbed(game!, players);
      const humanList = players
        .filter(p => !p.is_bot)
        .map(p => `👤 ${p.username} — Apuesta: **$${p.current_bet}**`)
        .join('\n');
      embed.setDescription(`🎰 **Partida de Blackjack**\n\n${humanList}`);

      // Los modals no pueden hacer update, hay que reply
      await interaction.reply({
        content: `✅ Apuesta de **$${cantidad}** registrada.`,
        ephemeral: true,
      });
    } catch (error: any) {
      await interaction.reply({ content: `❌ ${error.message}`, ephemeral: true });
    }
    return;
  }

  // ── Encuesta ─────────────────────────────────────────────────────────────
  if (customId === 'modal_encuesta') {
    const pregunta = interaction.fields.getTextInputValue('pregunta').trim();
    const rawOpts  = interaction.fields.getTextInputValue('opciones').trim();
    const opciones = rawOpts.split('\n').map(o => o.trim()).filter(Boolean).slice(0, 5);

    if (opciones.length < 2) {
      await interaction.reply({ content: '❌ Necesitas al menos 2 opciones (una por línea).', ephemeral: true });
      return;
    }

    const descripcion = opciones.map((op, i) => `${EMOJIS[i]} **${op}**`).join('\n\n');

    await interaction.reply({
      embeds: [{
        title: `📊 ${pregunta}`,
        description: descripcion,
        color: 0x3498db,
        fields: [{ name: '📝 Instrucciones', value: 'Reacciona con el emoji correspondiente a tu opción favorita.', inline: false }],
        footer: { text: `Encuesta creada por ${interaction.user.username} • ${opciones.length} opciones` },
        timestamp: new Date().toISOString(),
      }],
    });

    const msg = await interaction.fetchReply();
    for (let i = 0; i < opciones.length; i++) {
      await (msg as any).react(EMOJIS[i]).catch(() => {});
    }
    return;
  }

  // ── Recordatorio ─────────────────────────────────────────────────────────
  if (customId === 'modal_recordatorio') {
    const mensaje = interaction.fields.getTextInputValue('mensaje').trim();
    const tiempo  = interaction.fields.getTextInputValue('tiempo').trim().toLowerCase();

    const match = tiempo.match(/^(\d+)(m|h|d)$/);
    if (!match) {
      await interaction.reply({ content: '❌ Formato de tiempo inválido. Usa: `30m`, `2h`, `1d`', ephemeral: true });
      return;
    }

    const cantidad = parseInt(match[1]);
    const unidad   = match[2];
    const ms       = unidad === 'm' ? cantidad * 60_000
                   : unidad === 'h' ? cantidad * 3_600_000
                   : cantidad * 86_400_000;

    if (ms > 7 * 86_400_000) {
      await interaction.reply({ content: '❌ El máximo es 7 días.', ephemeral: true });
      return;
    }

    const timestamp = Math.floor((Date.now() + ms) / 1000);

    await interaction.reply({
      embeds: [{
        title: '⏰ Recordatorio programado',
        description: `> ${mensaje}`,
        color: 0xe67e22,
        fields: [
          { name: '🕐 Te avisaré', value: `<t:${timestamp}:R>`, inline: true },
          { name: '📅 Fecha exacta', value: `<t:${timestamp}:F>`, inline: true },
        ],
        footer: { text: `Recibirás un DM cuando llegue el momento` },
        timestamp: new Date().toISOString(),
      }],
      ephemeral: true,
    });

    setTimeout(async () => {
      try {
        await interaction.user.send({
          embeds: [{
            title: '⏰ ¡Recordatorio!',
            description: `> ${mensaje}`,
            color: 0xe67e22,
            footer: { text: 'Nerea Bot — Recordatorio' },
            timestamp: new Date().toISOString(),
          }],
        });
      } catch {
        await interaction.followUp({
          content: `⏰ <@${interaction.user.id}> ¡Recordatorio!\n> ${mensaje}`,
        }).catch(() => {});
      }
    }, ms);
    return;
  }

  // ── Sugerencia ────────────────────────────────────────────────────────────
  if (customId === 'modal_sugerencia') {
    const titulo      = interaction.fields.getTextInputValue('titulo').trim();
    const descripcion = interaction.fields.getTextInputValue('descripcion').trim();

    const canalSugerencias = (interaction.guild?.channels.cache.find(
      c => c.name === 'sugerencias' || c.name === 'suggestions'
    ) as any);

    const embed = {
      title: `💡 ${titulo}`,
      description: descripcion,
      color: 0xf1c40f,
      author: {
        name: interaction.user.username,
        icon_url: interaction.user.displayAvatarURL(),
      },
      footer: { text: `ID: ${interaction.user.id}` },
      timestamp: new Date().toISOString(),
    };

    if (canalSugerencias) {
      const msg = await canalSugerencias.send({ embeds: [embed] });
      await msg.react('👍').catch(() => {});
      await msg.react('👎').catch(() => {});
      await interaction.reply({
        content: `✅ Tu sugerencia fue enviada a ${canalSugerencias}.`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        embeds: [embed],
        content: '💡 **Tu sugerencia** (no se encontró canal de sugerencias):',
      });
    }
    return;
  }

  // ── Reporte ───────────────────────────────────────────────────────────────
  if (customId === 'modal_reporte') {
    const usuario     = interaction.fields.getTextInputValue('usuario').trim();
    const razon       = interaction.fields.getTextInputValue('razon').trim();

    const canalReportes = (interaction.guild?.channels.cache.find(
      c => c.name === 'reportes' || c.name === 'reports' || c.name === 'moderacion'
    ) as any);

    const embed = {
      title: '🚨 Nuevo Reporte',
      color: 0xe74c3c,
      fields: [
        { name: '👤 Reportado', value: usuario, inline: true },
        { name: '📢 Reportado por', value: `<@${interaction.user.id}>`, inline: true },
        { name: '📝 Razón', value: razon, inline: false },
      ],
      footer: { text: `Canal: ${(interaction.channel as any)?.name ?? 'Desconocido'}` },
      timestamp: new Date().toISOString(),
    };

    if (canalReportes) {
      await canalReportes.send({ embeds: [embed] });
      await interaction.reply({ content: '✅ Tu reporte fue enviado a los moderadores.', ephemeral: true });
    } else {
      await interaction.reply({ content: '✅ Reporte recibido. Un moderador lo revisará pronto.', ephemeral: true });
    }
    return;
  }
}
