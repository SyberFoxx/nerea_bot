const { Events, ButtonInteraction, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, EmbedBuilder } = require('discord.js');
const DominoGame = require('../sistemas/domino/gameLogic');

// Mapa para almacenar temporizadores de inicio de partida
const gameTimeouts = new Map();

// Función para iniciar la cuenta regresiva de la partida
async function startGameCountdown(interaction, gameId) {
    // Cancelar cualquier temporizador existente para este juego
    if (gameTimeouts.has(gameId)) {
        clearTimeout(gameTimeouts.get(gameId));
        gameTimeouts.delete(gameId);
    }

    // Obtener información actualizada del juego
    const game = await DominoGame.getGame(gameId);
    const players = await DominoGame.getPlayers(gameId);

    // Si hay 4 jugadores, iniciar inmediatamente
    if (players.length === 4) {
        await startGame(interaction, gameId);
        return;
    }

    // Actualizar mensaje con la cuenta regresiva
    let countdown = 5;
    let message = interaction;
    
    // Si es una interacción de botón, actualizamos el mensaje
    if (interaction.isButton()) {
        try {
            message = await interaction.update({
                content: `⏳ La partida comenzará en ${countdown} segundos...`,
                components: [],
                fetchReply: true
            });
        } catch (error) {
            console.error('Error al actualizar mensaje de cuenta regresiva:', error);
            return;
        }
    }

    const updateMessage = async () => {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`domino_join_${gameId}`)
                    .setLabel('Unirse a la partida')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(true),
                new ButtonBuilder()
                    .setLabel(`Iniciando en ${countdown}...`)
                    .setCustomId('countdown')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

        try {
            await message.edit({
                content: `⏳ La partida comenzará en ${countdown} segundos...`,
                components: [row]
            });

            countdown--;

            if (countdown >= 0) {
                setTimeout(updateMessage, 1000);
            } else {
                await startGame(interaction, gameId);
            }
        } catch (error) {
            console.error('Error al actualizar mensaje de cuenta regresiva:', error);
        }
    };

    updateMessage();
}

// Función para iniciar la partida
async function startGame(interaction, gameId) {
    try {
        // Iniciar el juego y obtener el estado actualizado
        const gameData = await DominoGame.startGame(gameId);
        console.log('Game Data:', JSON.stringify(gameData, null, 2)); // Debug
        
        const { game, players, currentPlayer } = gameData;
        
        // Verificar que los datos del jugador actual sean válidos
        if (!currentPlayer) {
            console.error('No se pudo determinar el jugador actual');
            throw new Error('No se pudo determinar el jugador actual');
        }

        // Asegurarse de que players sea un array
        if (!Array.isArray(players)) {
            console.error('Players no es un array:', players);
            throw new Error('Error al obtener la lista de jugadores');
        }

        console.log('Players:', players); // Debug
        console.log('Current Player ID:', currentPlayer); // Debug
        
        // Obtener información del jugador actual
        const currentPlayerObj = players.find(p => {
            console.log('Checking player:', p);
            return p && p.id && p.id === currentPlayer;
        });
        
        if (!currentPlayerObj) {
            console.error('Jugador actual no encontrado. Jugadores disponibles:', players);
            throw new Error('No se pudo encontrar la información del jugador actual');
        }

        // Crear embed para mostrar el estado del juego
        const embed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('🎲 Partida de Dominó')
            .setDescription('¡La partida ha comenzado!')
            .addFields(
                { name: 'Estado', value: 'En progreso', inline: true },
                { name: 'Jugadores', value: players.length.toString(), inline: true },
                { name: 'Turno actual', value: `<@${currentPlayer}>`, inline: true },
                { name: 'Fichas por jugador', value: '7', inline: true },
                { name: 'Fichas en el pozo', value: '14', inline: true }
            )
            .setFooter({ text: `ID de partida: ${gameId} | Usa los botones para jugar` })
            .setTimestamp();

        // Crear fila de botones para las acciones del juego
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`domino_play_${gameId}`)
                    .setLabel('Jugar ficha')
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(currentPlayer !== interaction.user.id),
                new ButtonBuilder()
                    .setCustomId(`domino_pass_${gameId}`)
                    .setLabel('Pasar turno')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(currentPlayer !== interaction.user.id),
                new ButtonBuilder()
                    .setCustomId(`domino_status_${gameId}`)
                    .setLabel('Ver estado')
                    .setStyle(ButtonStyle.Success)
            );

        // Enviar mensaje de inicio con el tablero
        const messageContent = `🎲 **¡La partida ha comenzado!**\n` +
            `Jugadores: ${players.map(p => `<@${p.id}>`).join(', ')}\n` +
            `Es el turno de <@${currentPlayer}>`;

        await interaction.editReply({
            content: messageContent,
            embeds: [embed],
            components: [row]
        });

        // Notificar a los jugadores
        for (const player of players) {
            if (!player.id) continue;
            
            try {
                const user = await interaction.client.users.fetch(player.id);
                if (user) {
                    const playerHand = await DominoGame.getPlayerTiles(gameId, player.id);
                    const playerEmbed = new EmbedBuilder()
                        .setColor('#00ff00')
                        .setTitle('Tus fichas')
                        .setDescription(playerHand.map(tile => `[${tile[0]}|${tile[1]}]`).join(' '))
                        .setFooter({ text: `Jugador: ${player.id === currentPlayer ? 'Es tu turno' : 'Esperando...'}` });

                    await user.send({
                        content: `### ¡La partida de dominó ha comenzado!\n` +
                                `**Jugadores:** ${players.length}/4\n` +
                                `**Turno actual:** <@${currentPlayer}>`,
                        embeds: [playerEmbed]
                    });
                }
            } catch (error) {
                console.error(`No se pudo enviar DM al jugador ${player.id}:`, error.message);
                // No detenemos la ejecución si falla el envío de DM
            }
        }

    } catch (error) {
        console.error('Error al iniciar el juego:', error);
        interaction.followUp({
            content: '❌ Ocurrió un error al iniciar la partida: ' + error.message,
            flags: 1 << 6
        });
    }
}

module.exports = {
    name: Events.InteractionCreate,
    /**
     * @param {ButtonInteraction} interaction 
     */
    async execute(interaction) {
        // Manejar botones de dominó
        if (interaction.isButton() && interaction.customId.startsWith('domino_')) {
            // Botón de unirse a partida
            if (interaction.customId.startsWith('domino_join_')) {
                try {
                    // Extraer el ID del juego del customId
                    const gameId = interaction.customId.replace('domino_join_', '');

                    // Verificar si el usuario ya está en la partida
                    const existingPlayer = await DominoGame.getPlayer(gameId, interaction.user.id);
                    if (existingPlayer) {
                        return interaction.reply({
                            content: '❌ Ya estás en esta partida de dominó.',
                            ephemeral: true
                        });
                    }

                    // Verificar si la partida ya comenzó
                    const game = await DominoGame.getGame(gameId);
                    if (game.status !== 'waiting') {
                        return interaction.reply({
                            content: '❌ Esta partida ya ha comenzado.',
                            ephemeral: true
                        });
                    }

                    // Verificar si hay espacio
                    const players = await DominoGame.getPlayers(gameId);
                    if (players.length >= 4) {
                        return interaction.reply({
                            content: '❌ La partida ya está llena (máx. 4 jugadores).',
                            ephemeral: true
                        });
                    }

                    // Añadir al jugador a la partida
                    await DominoGame.addPlayer(gameId, interaction.user.id);
                    const updatedPlayers = await DominoGame.getPlayers(gameId);

                    // Crear una nueva fila de botones
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId(`domino_join_${gameId}`)
                                .setLabel('Unirse a la partida')
                                .setStyle(ButtonStyle.Primary)
                                .setDisabled(updatedPlayers.length >= 4) // Deshabilitar si ya hay 4 jugadores
                        );

                    // Agregar botón de iniciar si hay al menos 2 jugadores
                    if (updatedPlayers.length >= 2) {
                        // Cualquier jugador puede iniciar la partida si hay al menos 2 jugadores
                        row.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`domino_start_${gameId}`)
                                .setLabel('Iniciar partida')
                                .setStyle(ButtonStyle.Success)
                        );
                    }

                    // Actualizar el mensaje de la partida
                    const embed = new EmbedBuilder()
                        .setColor('#0099ff')
                        .setTitle('🎲 Partida de Dominó')
                        .setDescription('¡Únete a la partida de dominó!')
                        .addFields(
                            { name: 'Jugadores', value: updatedPlayers.length > 0 ? updatedPlayers.map(p => `<@${p.id}>`).join('\n') : 'Ningún jugador aún' },
                            { name: 'Estado', value: 'Esperando jugadores...', inline: true },
                            { name: 'Creador', value: `<@${game.creator_id}>`, inline: true }
                        )
                        .setTimestamp();

                    await interaction.update({
                        embeds: [embed],
                        components: [row]
                    });

                    // Confirmar la unión al jugador
                    await interaction.followUp({
                        content: `✅ Te has unido a la partida de dominó. Jugadores: ${updatedPlayers.length}/4`,
                        ephemeral: true
                    });

                } catch (error) {
                    console.error('Error al unirse a la partida:', error);
                    const errorMessage = '❌ Ocurrió un error al unirte a la partida: ' + error.message;
                    
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({
                            content: errorMessage,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: errorMessage,
                            ephemeral: true
                        });
                    }
                }
            }
            // Botón de iniciar partida
            else if (interaction.customId.startsWith('domino_start_')) {
                try {
                    const gameId = interaction.customId.replace('domino_start_', '');
                    const players = await DominoGame.getPlayers(gameId);

                    // Verificar que el que inicia sea el creador o un admin
                    const gameInfo = await DominoGame.getGame(gameId);
                    const member = await interaction.guild.members.fetch(interaction.user.id);

                    if (gameInfo.creator_id !== interaction.user.id && !member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                        return interaction.reply({
                            content: '❌ Solo el creador de la partida o un administrador puede iniciar el juego.',
                            flags: 1 << 6,
                            ephemeral: true
                        });
                    }

                    // Verificar que haya al menos 2 jugadores
                    if (players.length < 2) {
                        return interaction.reply({
                            content: '❌ Se necesitan al menos 2 jugadores para comenzar.',
                            flags: 1 << 6,
                            ephemeral: true
                        });
                    }

                    // Deshabilitar todos los botones
                    const row = new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setCustomId('domino_loading')
                                .setLabel('Iniciando...')
                                .setStyle(ButtonStyle.Secondary)
                                .setDisabled(true)
                        );

                    await interaction.update({ components: [row] });

                    // Iniciar cuenta regresiva
                    await startGameCountdown(interaction, gameId);

                } catch (error) {
                    console.error('Error al iniciar partida:', error);
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({
                            content: '❌ Ocurrió un error al iniciar la partida: ' + error.message,
                            flags: 1 << 6,
                            ephemeral: true
                        });
                    } else {
                        await interaction.reply({
                            content: '❌ Ocurrió un error al iniciar la partida: ' + error.message,
                            flags: 1 << 6,
                            ephemeral: true
                        });
                    }
                }
            }
        }
    }
};
