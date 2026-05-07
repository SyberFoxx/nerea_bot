import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { SlashComando } from '../../types';
import { BlackjackGame } from '../../sistemas/blackjack/gameLogic';
import { dbRun } from '../../sistemas/blackjack/db';

const comando: SlashComando = {
  data: new SlashCommandBuilder()
    .setName('blackjack')
    .setDescription('Juega al Blackjack')
    .addSubcommand(sub => sub.setName('solo').setDescription('Juega solo contra un bot'))
    .addSubcommand(sub => sub.setName('crear').setDescription('Crea una partida multijugador'))
    .addSubcommand(sub => sub.setName('unirse').setDescription('Únete a una partida')
      .addStringOption(opt => opt.setName('id').setDescription('ID de la partida').setRequired(true))
    )
    .addSubcommand(sub => sub.setName('apostar').setDescription('Establece tu apuesta')
      .addStringOption(opt => opt.setName('id').setDescription('ID de la partida').setRequired(true))
      .addIntegerOption(opt => opt.setName('cantidad').setDescription('Cantidad a apostar').setRequired(true).setMinValue(1))
    )
    .addSubcommand(sub => sub.setName('iniciar').setDescription('Inicia la partida')
      .addStringOption(opt => opt.setName('id').setDescription('ID de la partida').setRequired(true))
    ),

  ejecutar: async (interaction: ChatInputCommandInteraction) => {
    const sub    = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const ch     = interaction.channel as any;

    try {
      if (sub === 'solo') {
        await interaction.deferReply();
        const gameId = await BlackjackGame.createGame(interaction.channel!.id, userId);
        await dbRun('UPDATE players SET username = ? WHERE user_id = ? AND game_id = ?', [interaction.user.username, userId, gameId]);
        await BlackjackGame.startGame(gameId);

        const game    = await BlackjackGame.getGame(gameId);
        const players = await BlackjackGame.getPlayers(gameId);
        const current = players.find(p => p.status === 'playing' && !p.is_bot);
        const embed   = BlackjackGame.buildEmbed(game!, players);
        embed.setDescription('🎰 **Tú vs 🤖 BOT** — Usa los botones para jugar.');
        const rows = BlackjackGame.buildButtons(game!, players, current?.user_id);

        const msg = await interaction.editReply({
          content: current ? `🎲 **¡La partida comenzó!** Es tu turno <@${userId}>` : '🎲 **¡La partida comenzó!**',
          embeds: [embed], components: rows,
        });
        await dbRun('UPDATE games SET message_id = ? WHERE game_id = ?', [(msg as any).id, gameId]);
        return;
      }

      if (sub === 'crear') {
        await interaction.deferReply();
        const gameId = await BlackjackGame.createGame(interaction.channel!.id, userId);
        await dbRun('UPDATE players SET username = ? WHERE user_id = ? AND game_id = ?', [interaction.user.username, userId, gameId]);

        const game    = await BlackjackGame.getGame(gameId);
        const players = await BlackjackGame.getPlayers(gameId);
        const embed   = BlackjackGame.buildEmbed(game!, players);
        embed.setDescription(`🎰 **¡Nueva partida creada por ${interaction.user}!**\n\nApuesta mínima: **$100**\nUsa los botones para unirte y apostar.`);
        const rows = BlackjackGame.buildButtons(game!, players);

        const msg = await interaction.editReply({ embeds: [embed], components: rows });
        await dbRun('UPDATE games SET message_id = ? WHERE game_id = ?', [(msg as any).id, gameId]);
        return;
      }

      if (sub === 'unirse') {
        const gameId = interaction.options.getString('id', true);
        if (await BlackjackGame.getPlayer(gameId, userId))
          return interaction.reply({ content: '❌ Ya estás en esta partida.', ephemeral: true });

        await BlackjackGame.addPlayer(gameId, userId, false, interaction.user.username);
        const game    = await BlackjackGame.getGame(gameId);
        const players = await BlackjackGame.getPlayers(gameId);
        const embed   = BlackjackGame.buildEmbed(game!, players);
        embed.setDescription(`✅ **${interaction.user.username}** se unió. (${players.filter(p => !p.is_bot).length}/4 jugadores)`);

        await interaction.reply({ embeds: [embed], components: BlackjackGame.buildButtons(game!, players) });
        return;
      }

      if (sub === 'apostar') {
        const gameId   = interaction.options.getString('id', true);
        const cantidad = interaction.options.getInteger('cantidad', true);
        await BlackjackGame.placeBet(gameId, userId, cantidad);
        await interaction.reply({ content: `💰 Apuesta de **$${cantidad}** registrada.`, ephemeral: true });
        return;
      }

      if (sub === 'iniciar') {
        const gameId = interaction.options.getString('id', true);
        const game   = await BlackjackGame.getGame(gameId);
        if (!game) return interaction.reply({ content: '❌ Partida no encontrada.', ephemeral: true });
        if (game.creator_id !== userId) return interaction.reply({ content: '❌ Solo el creador puede iniciar.', ephemeral: true });

        await interaction.deferReply();
        await BlackjackGame.startGame(gameId);

        const ug      = await BlackjackGame.getGame(gameId);
        const up      = await BlackjackGame.getPlayers(gameId);
        const current = up.find(p => p.status === 'playing' && !p.is_bot);
        const embed   = BlackjackGame.buildEmbed(ug!, up);
        const rows    = BlackjackGame.buildButtons(ug!, up, current?.user_id);

        const msg = await interaction.editReply({
          content: current ? `🎲 Turno de <@${current.user_id}>` : '🎲 **¡La partida comenzó!**',
          embeds: [embed], components: rows,
        });
        await dbRun('UPDATE games SET message_id = ? WHERE game_id = ?', [(msg as any).id, gameId]);
        return;
      }

    } catch (error: any) {
      console.error('Error en /blackjack:', error);
      const msg = `❌ ${error.message}`;
      if (interaction.replied || interaction.deferred) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, ephemeral: true });
    }
  },
};

export default comando;
