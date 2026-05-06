import { EmbedBuilder } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import { Comando } from '../../types';

const radioStations: Record<string, string> = {
  lofi: 'http://stream.laut.fm/lofi',
  rock: 'http://stream.laut.fm/rockantenne',
  pop: 'http://stream.laut.fm/popradio',
  electronic: 'http://stream.laut.fm/electronic',
  jazz: 'http://stream.laut.fm/jazz',
  classical: 'http://stream.laut.fm/classical',
  chill: 'http://stream.laut.fm/chillout',
  reggae: 'http://stream.laut.fm/reggae',
  country: 'http://stream.laut.fm/country',
  latin: 'http://stream.laut.fm/latin',
};

interface ActiveConnection {
  connection: ReturnType<typeof joinVoiceChannel>;
  player: ReturnType<typeof createAudioPlayer>;
}

const activeConnections = new Map<string, ActiveConnection>();

async function showRadioList(message: any): Promise<void> {
  const lista = Object.keys(radioStations).map(s => `🎵 **${s}** — \`!radio ${s}\``).join('\n');
  const embed = new EmbedBuilder()
    .setColor('#ff6b6b')
    .setTitle('📻 Estaciones de Radio Disponibles')
    .setDescription(lista)
    .addFields({ name: '🎛️ Comandos', value: '`!radio <estación>` — Reproducir\n`!radio stop` — Detener\n`!radio list` — Ver lista' })
    .setTimestamp();
  message.reply({ embeds: [embed] });
}

async function stopRadio(message: any): Promise<void> {
  const conn = activeConnections.get(message.guild.id);
  if (!conn) return message.reply('❌ No hay radio reproduciéndose.');

  conn.player.stop();
  conn.connection.destroy();
  activeConnections.delete(message.guild.id);

  const embed = new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle('⏹️ Radio Detenida')
    .setDescription('La radio se ha detenido correctamente.')
    .addFields({ name: '👤 Detenida por', value: message.author.tag, inline: true })
    .setTimestamp();
  message.reply({ embeds: [embed] });
}

async function playRadio(message: any, voiceChannel: any, station: string): Promise<void> {
  try {
    const existing = activeConnections.get(message.guild.id);
    if (existing) { existing.player.stop(); existing.connection.destroy(); }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer();
    const resource = createAudioResource(radioStations[station]);
    player.play(resource);
    connection.subscribe(player);
    activeConnections.set(message.guild.id, { connection, player });

    const embed = new EmbedBuilder()
      .setColor('#00ff00')
      .setTitle('📻 Radio Iniciada')
      .setDescription(`Reproduciendo: **${station.toUpperCase()}**`)
      .addFields(
        { name: '🎵 Canal', value: voiceChannel.name, inline: true },
        { name: '⏹️ Detener', value: '`!radio stop`', inline: true }
      )
      .setTimestamp();
    message.reply({ embeds: [embed] });

    player.on('error', (err: Error) => {
      console.error('Error en la radio:', err);
      (message.channel as any).send('❌ Error al reproducir la radio.');
      activeConnections.delete(message.guild.id);
    });

    player.on(AudioPlayerStatus.Idle, () => {
      if (activeConnections.has(message.guild.id)) {
        setTimeout(() => {
          const newResource = createAudioResource(radioStations[station]);
          player.play(newResource);
        }, 1000);
      }
    });
  } catch (error) {
    console.error('Error al iniciar radio:', error);
    message.reply('❌ Error al conectar a la radio.');
  }
}

const comando: Comando = {
  nombre: 'radio',
  descripcion: 'Reproduce radios online en un canal de voz',
  uso: '!radio <estación> | !radio list | !radio stop',
  ejecutar: async (message, args) => {
    const voiceChannel = (message.member as any)?.voice?.channel;
    if (!voiceChannel) return message.reply('❌ Debes estar en un canal de voz.');

    if (!args.length || args[0] === 'list') return showRadioList(message);
    if (args[0] === 'stop') return stopRadio(message);

    const station = args[0].toLowerCase();
    if (!radioStations[station])
      return message.reply(`❌ Estación no encontrada. Usa \`!radio list\` para ver las disponibles.`);

    return playRadio(message, voiceChannel, station);
  },
};

export default comando;
