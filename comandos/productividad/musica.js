const { EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');

// Lista de radios populares
const radioStations = {
    'lofi': 'http://stream.laut.fm/lofi',
    'rock': 'http://stream.laut.fm/rockantenne',
    'pop': 'http://stream.laut.fm/popradio',
    'electronic': 'http://stream.laut.fm/electronic',
    'jazz': 'http://stream.laut.fm/jazz',
    'classical': 'http://stream.laut.fm/classical',
    'chill': 'http://stream.laut.fm/chillout',
    'reggae': 'http://stream.laut.fm/reggae',
    'country': 'http://stream.laut.fm/country',
    'latin': 'http://stream.laut.fm/latin'
};

// Mapa para almacenar las conexiones activas por servidor
const activeConnections = new Map();

module.exports = {
    nombre: 'radio',
    descripcion: 'Reproduce radios online',
    uso: '!radio <estación> | !radio list | !radio stop',
    
    async ejecutar(message, args) {
        const voiceChannel = message.member?.voice?.channel;
        
        if (!voiceChannel) {
            return message.reply('❌ Debes estar en un canal de voz para usar la radio!');
        }

        if (!args.length || args[0] === 'list') {
            return showRadioList(message);
        }

        if (args[0] === 'stop') {
            return stopRadio(message);
        }

        const station = args[0].toLowerCase();
        
        if (!radioStations[station]) {
            return message.reply(`❌ Estación no encontrada. Usa \`!radio list\` para ver las disponibles.`);
        }

        return playRadio(message, voiceChannel, station);
    }
};

async function showRadioList(message) {
    const stationList = Object.keys(radioStations).map(station => 
        `🎵 **${station}** - \`!radio ${station}\``
    ).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle('📻 Estaciones de Radio Disponibles')
        .setDescription(stationList)
        .addFields(
            { name: '🎛️ Comandos', value: '`!radio <estación>` - Reproducir\n`!radio stop` - Detener\n`!radio list` - Ver lista', inline: false }
        )
        .setFooter({ text: 'Radios 24/7 sin interrupciones' })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

async function playRadio(message, voiceChannel, station) {
    try {
        // Detener radio anterior si existe
        const existingConnection = activeConnections.get(message.guild.id);
        if (existingConnection) {
            existingConnection.player.stop();
            existingConnection.connection.destroy();
        }

        // Crear nueva conexión
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const resource = createAudioResource(radioStations[station]);

        player.play(resource);
        connection.subscribe(player);

        // Guardar conexión activa
        activeConnections.set(message.guild.id, { connection, player });

        const embed = new EmbedBuilder()
            .setColor('#00ff00')
            .setTitle('📻 Radio Iniciada')
            .setDescription(`Reproduciendo: **${station.toUpperCase()}**`)
            .addFields(
                { name: '🎵 Canal', value: voiceChannel.name, inline: true },
                { name: '⏹️ Detener', value: '`!radio stop`', inline: true }
            )
            .setThumbnail('https://cdn.discordapp.com/emojis/🎵.png')
            .setTimestamp();

        message.reply({ embeds: [embed] });

        // Manejar errores
        player.on('error', error => {
            console.error('Error en la radio:', error);
            message.channel.send('❌ Error al reproducir la radio.');
            activeConnections.delete(message.guild.id);
        });

        player.on(AudioPlayerStatus.Idle, () => {
            // La radio no debería terminar, pero si pasa, reconectar
            setTimeout(() => {
                if (activeConnections.has(message.guild.id)) {
                    const newResource = createAudioResource(radioStations[station]);
                    player.play(newResource);
                }
            }, 1000);
        });

    } catch (error) {
        console.error('Error al iniciar radio:', error);
        message.reply('❌ Error al conectar a la radio.');
    }
}

async function stopRadio(message) {
    const connection = activeConnections.get(message.guild.id);
    
    if (!connection) {
        return message.reply('❌ No hay radio reproduciéndose.');
    }

    connection.player.stop();
    connection.connection.destroy();
    activeConnections.delete(message.guild.id);

    const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('⏹️ Radio Detenida')
        .setDescription('La radio se ha detenido correctamente.')
        .addFields({ name: '👤 Detenida por', value: message.author.tag, inline: true })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

// Exportar comandos adicionales
module.exports.stop = {
    nombre: 'radiostop',
    descripcion: 'Detiene la radio',
    uso: '!radiostop',
    async ejecutar(message, args) {
        return stopRadio(message);
    }
};
