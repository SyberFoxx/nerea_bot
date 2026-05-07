import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashComando } from '../../types';
import { DominoGame } from '../../sistemas/domino/gameLogic';
import { DominoDisplay } from '../../sistemas/domino/dominoUtils';

// Helper reutilizable
async function buildReply(gameId: string, viewerUserId: string, extraMsg?: string) {
  const game    = await DominoGame.getGame(gameId);
  const players = await DominoGame.getPlayers(gameId);
  const current = await DominoGame.getCurrentPlayer(gameId);
  const viewer  = players.find(p => p.user_id === viewerUserId);
  const isMyTurn = current?.user_id === viewerUserId;
  const canPass  = isMyTurn ? !(await DominoGame.canCurrentPlayerPlay(gameId)) : false;
  const playable = isMyTurn && viewer
    ? DominoDisplay.getPlayableTiles(viewer.tiles, game!.left_end, game!.right_end)
    : [];

  const embed      = DominoDisplay.buildGameEmbed(game!, players, viewerUserId, extraMsg);
  const components = game!.status === 'finished'
    ? []
    : DominoDisplay.buildGameComponents(gameId, isMyTurn, canPass, playable);

  const content = game!.status === 'finished'
    ? '🏁 **¡Partida terminada!**'
    : current?.is_bot
      ? `🤖 **${current.username}** está pensando...`
      : isMyTurn
        ? `🎴 **¡Es tu turno!** <@${viewerUserId}>`
        : `🎴 Turno de <@${current?.user_id}>`;

  return { embed, components, content };
}

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('domino')
    .setDescription('Juega al Dominó')
    .addSubcommand(sub => sub.setName('solo').setDescription('Juega solo contra un bot'))
    .addSubcommand(sub => sub.setName('crear').setDescription('Crea una partida multijugador'))
    .addSubcommand(sub => sub.setName('unirse').setDescription('Únete a una partida')
      .addStringOption(opt => opt.setName('id').setDescription('ID de la partida').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('iniciar').setDescription('Inicia la partida')
      .addStringOption(opt => opt.setName('id').setDescription('ID de la partida').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('jugar').setDescription('Juega una ficha')
      .addStringOption(opt => opt.setName('id').setDescription('ID de la partida').setRequired(true))
      .addIntegerOption(opt => opt.setName('ficha').setDescription('Número de ficha').setRequired(true).setMinValue(1))
      .addStringOption(opt => opt.setName('lado').setDescription('Lado del tablero').setRequired(false)
        .addChoices({ name: 'Derecha →', value: 'right' }, { name: 'Izquierda ←', value: 'left' })
      )
    )
    .addSubcommand(sub => sub.setName('pasar').setDescription('Pasa tu turno (si no puedes jugar)')
      .addStringOption(opt => opt.setName('id').setDescription('ID de la partida').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('fichas').setDescription('Ver tus fichas actuales (privado)')
      .addStringOption(opt => opt.setName('id').setDescription('ID de la partida').setRequired(true))
    ),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      if (sub === 'solo') {
        await interaction.deferReply();
        const gameId = await DominoGame.createGame(interaction.channel!.id, userId, interaction.user.username);
        await DominoGame.addPlayer(gameId, `bot-${Date.now()}`, '🤖 BOT', true);
        await DominoGame.startGame(gameId);
        const current = await DominoGame.getCurrentPlayer(gameId);
        const { embed, components, content } = await buildReply(gameId, userId);
        await interaction.editReply({
          content: current?.is_bot ? `🤖 **BOT** empieza (tiene el doble más alto).` : content,
          embeds: [embed], components,
        });
        return;
      }

      if (sub === 'crear') {
        await interaction.deferReply();
        const gameId  = await DominoGame.createGame(interaction.channel!.id, userId, interaction.user.username);
        const game    = await DominoGame.getGame(gameId);
        const players = await DominoGame.getPlayers(gameId);
        const embed   = DominoDisplay.buildGameEmbed(game!, players);
        embed.setDescription(`🁣 **¡Nueva partida creada por ${interaction.user}!**\n\nUsa los botones para unirte.`);
        await interaction.editReply({ embeds: [embed], components: [DominoDisplay.buildWaitingButtons(gameId)] });
        return;
      }

      if (sub === 'unirse') {
        const gameId = interaction.options.getString('id', true);
        await DominoGame.addPlayer(gameId, userId, interaction.user.username);
        const game    = await DominoGame.getGame(gameId);
        const players = await DominoGame.getPlayers(gameId);
        const embed   = DominoDisplay.buildGameEmbed(game!, players);
        embed.setDescription(`✅ **${interaction.user.username}** se unió. (${players.length}/4 jugadores)`);
        await interaction.reply({ embeds: [embed], components: [DominoDisplay.buildWaitingButtons(gameId)] });
        return;
      }

      if (sub === 'iniciar') {
        const gameId = interaction.options.getString('id', true);
        const game   = await DominoGame.getGame(gameId);
        if (!game) return interaction.reply({ content: '❌ Partida no encontrada.', ephemeral: true });
        if (game.creator_id !== userId) return interaction.reply({ content: '❌ Solo el creador puede iniciar.', ephemeral: true });
        await interaction.deferReply();
        await DominoGame.startGame(gameId);
        const current = await DominoGame.getCurrentPlayer(gameId);
        const { embed, components, content } = await buildReply(gameId, userId);
        await interaction.editReply({
          content: current?.is_bot ? `🤖 **BOT** empieza.` : content,
          embeds: [embed], components,
        });
        return;
      }

      if (sub === 'jugar') {
        const gameId = interaction.options.getString('id', true);
        const ficha  = interaction.options.getInteger('ficha', true) - 1;
        const lado   = (interaction.options.getString('lado') ?? 'right') as 'left' | 'right';
        await interaction.deferReply();
        const { game: ug, winner } = await DominoGame.playTile(gameId, userId, ficha, lado);
        const up = await DominoGame.getPlayers(gameId);
        if (winner) {
          const embed = DominoDisplay.buildGameEmbed(ug, up, userId, `🏆 **¡${winner.is_bot ? winner.username : `<@${winner.user_id}>`} ganó!**`);
          return interaction.editReply({ embeds: [embed], components: [] });
        }
        const { embed, components, content } = await buildReply(gameId, userId);
        await interaction.editReply({ content, embeds: [embed], components });
        return;
      }

      if (sub === 'pasar') {
        const gameId = interaction.options.getString('id', true);
        await interaction.deferReply();
        const { blocked } = await DominoGame.passTurn(gameId, userId);
        const ug = await DominoGame.getGame(gameId);
        const up = await DominoGame.getPlayers(gameId);
        if (blocked) {
          const { winner, scores } = await DominoGame.getWinnerByPoints(gameId);
          const scoreText = scores.map(s =>
            `${s.player.is_bot ? s.player.username : `<@${s.player.user_id}>`}: **${s.points}** pts`
          ).join('\n');
          const embed = DominoDisplay.buildGameEmbed(ug!, up, userId,
            `🔒 **¡Juego bloqueado!**\n🏆 Gana **${winner.is_bot ? winner.username : `<@${winner.user_id}>`}**\n\n${scoreText}`);
          return interaction.editReply({ embeds: [embed], components: [] });
        }
        const { embed, components, content } = await buildReply(gameId, userId, `⏭️ <@${userId}> pasó su turno.`);
        await interaction.editReply({ content, embeds: [embed], components });
        return;
      }

      if (sub === 'fichas') {
        const gameId = interaction.options.getString('id', true);
        const game   = await DominoGame.getGame(gameId);
        const player = await DominoGame.getPlayer(gameId, userId);
        if (!player) return interaction.reply({ content: '❌ No estás en esta partida.', ephemeral: true });
        const handText = DominoDisplay.formatHand(player.tiles, game?.left_end ?? -1, game?.right_end ?? -1);
        await interaction.reply({
          embeds: [{
            title: `🃏 Tus fichas (${player.tiles.length})`,
            description: handText || '*Sin fichas*',
            color: 0x2ecc71,
            footer: { text: '✅ = jugable  ← → indica el lado válido  ↔ = ambos lados' },
          }],
          ephemeral: true,
        });
        return;
      }

    } catch (error: any) {
      console.error('Error en /domino:', error);
      const msg = `❌ ${error.message}`;
      if (interaction.replied || interaction.deferred) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, ephemeral: true });
    }
  },
};

export default comando;
