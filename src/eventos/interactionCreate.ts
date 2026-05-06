import { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, EmbedBuilder } from 'discord.js';
import { DominoGame } from '../sistemas/domino/gameLogic';

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction: any) {
    if (!interaction.isButton() || !interaction.customId.startsWith('domino_')) return;

    // Unirse a partida
    if (interaction.customId.startsWith('domino_join_')) {
      const gameId = interaction.customId.replace('domino_join_', '');
      try {
        const existing = await DominoGame.getPlayer(gameId, interaction.user.id);
        if (existing) return interaction.reply({ content: '❌ Ya estás en esta partida.', ephemeral: true });

        const game = await DominoGame.getGame(gameId);
        if (game.status !== 'waiting') return interaction.reply({ content: '❌ La partida ya comenzó.', ephemeral: true });

        const players = await DominoGame.getPlayers(gameId);
        if (players.length >= 4) return interaction.reply({ content: '❌ La partida está llena.', ephemeral: true });

        await DominoGame.addPlayer(gameId, interaction.user.id);
        const updated = await DominoGame.getPlayers(gameId);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`domino_join_${gameId}`).setLabel('Unirse').setStyle(ButtonStyle.Primary).setDisabled(updated.length >= 4)
        );
        if (updated.length >= 2) {
          (row as any).addComponents(
            new ButtonBuilder().setCustomId(`domino_start_${gameId}`).setLabel('Iniciar partida').setStyle(ButtonStyle.Success)
          );
        }

        const embed = new EmbedBuilder()
          .setColor('#0099ff').setTitle('🎲 Partida de Dominó')
          .addFields(
            { name: 'Jugadores', value: updated.map((p: any) => `<@${p.id}>`).join('\n') || 'Ninguno' },
            { name: 'Estado', value: 'Esperando jugadores...', inline: true }
          ).setTimestamp();

        await interaction.update({ embeds: [embed], components: [row] });
        await interaction.followUp({ content: `✅ Te uniste. Jugadores: ${updated.length}/4`, ephemeral: true });
      } catch (error: any) {
        const msg = `❌ Error al unirte: ${error.message}`;
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: msg, ephemeral: true });
        else await interaction.reply({ content: msg, ephemeral: true });
      }
    }

    // Iniciar partida
    else if (interaction.customId.startsWith('domino_start_')) {
      const gameId = interaction.customId.replace('domino_start_', '');
      try {
        const gameInfo = await DominoGame.getGame(gameId);
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator);

        if (gameInfo.creator_id !== interaction.user.id && !isAdmin)
          return interaction.reply({ content: '❌ Solo el creador puede iniciar la partida.', ephemeral: true });

        const players = await DominoGame.getPlayers(gameId);
        if (players.length < 2)
          return interaction.reply({ content: '❌ Se necesitan al menos 2 jugadores.', ephemeral: true });

        const loadingRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('loading').setLabel('Iniciando...').setStyle(ButtonStyle.Secondary).setDisabled(true)
        );
        await interaction.update({ components: [loadingRow] });

        const gameData = await DominoGame.startGame(gameId);
        const { currentPlayer } = gameData;

        const embed = new EmbedBuilder()
          .setColor('#0099ff').setTitle('🎲 Partida de Dominó — En progreso')
          .addFields(
            { name: 'Turno actual', value: `<@${currentPlayer}>`, inline: true },
            { name: 'Jugadores', value: String(players.length), inline: true }
          ).setTimestamp();

        const gameRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`domino_play_${gameId}`).setLabel('Jugar ficha').setStyle(ButtonStyle.Primary).setDisabled(currentPlayer !== interaction.user.id),
          new ButtonBuilder().setCustomId(`domino_status_${gameId}`).setLabel('Ver estado').setStyle(ButtonStyle.Success)
        );

        await interaction.editReply({
          content: `🎲 **¡La partida comenzó!** Turno de <@${currentPlayer}>`,
          embeds: [embed], components: [gameRow],
        });
      } catch (error: any) {
        const msg = `❌ Error al iniciar: ${error.message}`;
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content: msg, ephemeral: true });
        else await interaction.reply({ content: msg, ephemeral: true });
      }
    }
  },
};
