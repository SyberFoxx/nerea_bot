const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const BlackjackGame = require('../../sistemas/blackjack/gameLogic');
const { dbRun } = require('../../sistemas/blackjack/db');

module.exports = {
    nombre: 'blackjack',
    alias: ['bj', 'veintiuno'],
    descripcion: 'Juega una partida de Blackjack',
    categoria: 'juegos',
    permisos: [],

    async ejecutar(message, args) {
        const subcommand = args[0]?.toLowerCase();
        const userId = message.author.id;
        const channelId = message.channel.id;
        const gameId = args[1]; // ID de la partida (para unirse/iniciar/apostar)

        try {
            if (!subcommand) {
                return message.channel.send('❌ Uso correcto: `!blackjack crear` o `!blackjack unirse [id]` o `!blackjack iniciar [id]` o `!blackjack apostar [id] [cantidad]`');
            }

            switch (subcommand) {
                case 'crear':
                    await handleCreateGame(message, userId, channelId);
                    break;
                case 'unirse':
                    if (!gameId) return message.channel.send('❌ Debes especificar un ID de partida. Ejemplo: `!blackjack unirse 12345`');
                    await handleJoinGame(message, userId, gameId);
                    break;
                case 'iniciar':
                    if (!gameId) return message.channel.send('❌ Debes especificar un ID de partida. Ejemplo: `!blackjack iniciar 12345`');
                    await handleStartGame(message, userId, gameId);
                    break;
                case 'apostar':
                    const amount = parseInt(args[2]);
                    if (!gameId || isNaN(amount)) {
                        return message.channel.send('❌ Uso correcto: `!blackjack apostar [id] [cantidad]`');
                    }
                    await handlePlaceBet(message, userId, gameId, amount);
                    break;
                default:
                    await message.channel.send('❌ Comando no reconocido. Usa `!blackjack crear`, `!blackjack unirse [id]`, `!blackjack iniciar [id]` o `!blackjack apostar [id] [cantidad]`');
            }
        } catch (error) {
            console.error('Error en comando blackjack:', error);
            await message.channel.send(`❌ Ocurrió un error: ${error.message}`);
        }
    },
};

// Handle game creation
async function handleCreateGame(message, userId, channelId) {
    try {
        const gameId = await BlackjackGame.createGame(channelId, userId);
        
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎰 Nueva Partida de Blackjack')
            .setDescription('¡Se ha creado una nueva partida de Blackjack!')
            .addFields(
                { name: 'ID de la partida', value: `\`${gameId}\`` },
                { name: 'Creador', value: `<@${userId}>` },
                { name: 'Estado', value: '🔄 Esperando jugadores...' },
                { name: 'Cómo unirse', value: `Escribe \`!blackjack unirse ${gameId}\` o haz clic en el botón de abajo` }
            )
            .setFooter({ text: `Solicitado por ${message.author.tag}`, iconURL: message.author.displayAvatarURL() })
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`blackjack_join_${gameId}`)
                    .setLabel('Unirse a la partida')
                    .setStyle(ButtonStyle.Primary)
            );

        const msg = await message.channel.send({ 
            content: `🎰 <@${userId}> ha creado una partida de Blackjack. ¡Únete!`, 
            embeds: [embed], 
            components: [row] 
        });
        
        // Guardar el ID del mensaje en el juego para futuras actualizaciones
        await dbRun(
            'UPDATE games SET message_id = ? WHERE game_id = ?',
            [msg.id, gameId]
        );
        
    } catch (error) {
        console.error('Error al crear partida de Blackjack:', error);
        await message.channel.send(`❌ No se pudo crear la partida: ${error.message}`);
    }
}

// Handle joining a game
async function handleJoinGame(message, userId, gameId) {
    try {
        const game = await BlackjackGame.getGame(gameId);
        
        // Check if user is already in the game
        const players = await BlackjackGame.getPlayers(gameId);
        const isAlreadyInGame = players.some(p => p.user_id === userId);
        
        if (isAlreadyInGame) {
            return message.channel.send(`ℹ️ Ya estás en esta partida de Blackjack. Usa \`!blackjack iniciar ${gameId}\` para comenzar.`);
        }
        
        // Add player to the game
        await BlackjackGame.addPlayer(gameId, userId);
        const updatedPlayers = await BlackjackGame.getPlayers(gameId);
        
        // If only one player, add a bot
        if (updatedPlayers.length === 1) {
            await BlackjackGame.addPlayer(gameId, 'bot-1', true);
            await message.channel.send('🤖 Se ha unido un bot a la partida. ¡Puedes jugar contra él!');
        }
        
        const embed = BlackjackGame.createGameEmbed(game, updatedPlayers);
        const row = BlackjackGame.createGameButtons(game);
        
        // Update the game message if it exists
        if (game.message_id) {
            try {
                const gameMessage = await message.channel.messages.fetch(game.message_id);
                if (gameMessage) {
                    await gameMessage.edit({ 
                        content: `🎰 <@${game.creator_id}> ha creado una partida de Blackjack. ¡Únete! (${updatedPlayers.length}/4 jugadores)`,
                        embeds: [embed], 
                        components: [row] 
                    });
                }
            } catch (error) {
                console.error('Error al actualizar mensaje de juego:', error);
            }
        }
        
        await message.channel.send(`✅ <@${userId}> se ha unido a la partida de Blackjack (${updatedPlayers.length}/4 jugadores)`);
    } catch (error) {
        console.error('Error al unirse a partida de Blackjack:', error);
        await message.channel.send(`❌ No se pudo unir a la partida: ${error.message}`);
    }
}

// Handle starting the game
async function handleStartGame(message, userId, gameId) {
    try {
        const game = await BlackjackGame.getGame(gameId);
        if (!game) {
            return message.channel.send('❌ No se encontró la partida');
        }
        
        // Get current players
        let players = await BlackjackGame.getPlayers(gameId);
        
        // Check if user is in the game
        const player = players.find(p => p.user_id === userId);
        if (!player) {
            return message.channel.send('❌ Debes estar en la partida para iniciarla');
        }
        
        // If only one human player, add a bot
        const humanPlayers = players.filter(p => !p.is_bot);
        if (humanPlayers.length === 1 && !players.some(p => p.is_bot)) {
            await message.channel.send('🤖 Se ha unido un bot a la partida. ¡Buena suerte!');
        }
        
        // Start the game
        await BlackjackGame.startGame(gameId);
        
        // Get updated game state
        const updatedGame = await BlackjackGame.getGame(gameId);
        const updatedPlayers = await BlackjackGame.getPlayers(gameId);
        
        // Create and send game embed
        const embed = BlackjackGame.createGameEmbed(updatedGame, updatedPlayers, userId);
        const row = BlackjackGame.createGameButtons(updatedGame, userId);
        
        // Update the game message
        if (game.message_id) {
            try {
                const gameMessage = await message.channel.messages.fetch(game.message_id);
                if (gameMessage) {
                    await gameMessage.edit({ 
                        content: `🎲 **Partida de Blackjack en progreso** - Turno de <@${userId}>`,
                        embeds: [embed], 
                        components: [row] 
                    });
                }
            } catch (error) {
                console.error('Error al actualizar mensaje de juego:', error);
            }
        }
        
        // Get the current player (first player in the list with 'playing' status)
        const currentPlayer = updatedPlayers.find(p => p.status === 'playing');
        
        // Send DM to each human player with their cards
        for (const player of updatedPlayers) {
            try {
                // Skip bots
                if (player.is_bot) continue;
                
                const user = await message.client.users.fetch(player.user_id);
                if (user) {
                    // Use the parsed hand from the player object
                    const playerHand = Array.isArray(player.hand) ? player.hand : [];
                    const handValue = BlackjackGame.calculateHandValue(playerHand);
                    
                    // Create a clean embed for DMs
                    const dmEmbed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('🃏 Tus cartas en la partida de Blackjack')
                        .setDescription(`📜 Mano: ${BlackjackGame.formatHand(playerHand)}\n💯 Valor: ${handValue}`);
                    
                    await user.send({
                        embeds: [dmEmbed],
                        components: [row]
                    }).catch(error => {
                        console.error(`No se pudo enviar DM a ${user.tag}:`, error);
                    });
                }
            } catch (error) {
                console.error('Error al enviar DM al jugador:', error);
            }
        }
        
        // Send a message to the channel
        try {
            const startMessage = await message.channel.send({
                content: `🎰 **¡La partida ha comenzado!**\n` +
                         `Jugadores: ${updatedPlayers.filter(p => !p.is_bot).map(p => `<@${p.user_id}>`).join(', ')}\n` +
                         `Turno actual: <@${currentPlayer?.user_id || 'N/A'}>`,
                embeds: [embed],
                components: [row]
            });
            
            // Update the game message ID if this is the first message
            if (game && !game.message_id) {
                await dbRun(
                    'UPDATE games SET message_id = ? WHERE game_id = ?',
                    [startMessage.id, gameId]
                );
            }
        } catch (error) {
            console.error('Error al enviar mensaje de inicio:', error);
        }
        
    } catch (error) {
        console.error('Error al iniciar partida de Blackjack:', error);
        await message.channel.send(`❌ No se pudo iniciar la partida: ${error.message}`);
    }
}

// Handle placing a bet
async function handlePlaceBet(message, userId, gameId, amount) {
    try {
        const player = await BlackjackGame.getPlayer(gameId, userId);
        if (!player) {
            throw new Error('No estás en esta partida');
        }
        
        if (player.balance < amount) {
            throw new Error('No tienes suficiente saldo para esta apuesta');
        }
        
        if (amount <= 0) {
            throw new Error('La apuesta debe ser mayor a 0');
        }
        
        // Update player's bet
        await dbRun(
            'UPDATE players SET current_bet = ? WHERE user_id = ? AND game_id = ?',
            [amount, userId, gameId]
        );
        
        await message.channel.send(`✅ <@${userId}> ha apostado $${amount}. ¡Buena suerte!`);
        
    } catch (error) {
        console.error('Error al realizar apuesta:', error);
        await message.channel.send(`❌ No se pudo realizar la apuesta: ${error.message}`);
    }
}
