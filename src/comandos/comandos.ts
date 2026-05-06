import { EmbedBuilder } from 'discord.js';
import { Comando } from '../types';

interface CategoriaComando {
  nombre: string;
  descripcion: string;
}

interface Categoria {
  nombre: string;
  comandos: CategoriaComando[];
}

const comando: Comando = {
  nombre: 'comandos',
  alias: ['cmds'],
  descripcion: 'Muestra todos los comandos disponibles organizados por categorías',
  categoria: 'utilidades',
  ejecutar: async (message) => {
    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle('📋 LISTA DE COMANDOS')
      .setDescription(
        '> Aquí tienes todos los comandos disponibles organizados por categorías.\n' +
        '> Usa `!ayuda [comando]` para más información sobre un comando específico.\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
      )
      .setThumbnail(message.client.user?.displayAvatarURL({ size: 512 }) ?? null)
      .setFooter({
        text: `Solicitado por ${message.author.username}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp();

    const categorias: Categoria[] = [
      {
        nombre: '🛡️ Moderación',
        comandos: [
          { nombre: '`!limpiar <cantidad>`', descripcion: 'Elimina mensajes del canal' },
          { nombre: '`!ban [@usuario] [razón]`', descripcion: 'Banea a un usuario' },
          { nombre: '`!kick [@usuario] [razón]`', descripcion: 'Expulsa a un usuario' },
          { nombre: '`!mute [@usuario] [tiempo]`', descripcion: 'Silencia a un usuario' },
          { nombre: '`!avisar [@usuario] [razón]`', descripcion: 'Envía una advertencia' },
        ],
      },
      {
        nombre: '👋 Bienvenidas',
        comandos: [
          { nombre: '`!configbienvenida #canal "mensaje"`', descripcion: 'Configura el mensaje de bienvenida' },
          { nombre: '`!simular [@usuario]`', descripcion: 'Prueba la bienvenida' },
        ],
      },
      {
        nombre: '🔧 Utilidades',
        comandos: [
          { nombre: '`!nivel`', descripcion: 'Muestra tu nivel y experiencia' },
          { nombre: '`!perfil`', descripcion: 'Muestra tu perfil' },
          { nombre: '`!encuesta <pregunta>`', descripcion: 'Crea una encuesta' },
          { nombre: '`!recordatorio <tiempo> <mensaje>`', descripcion: 'Crea un recordatorio' },
          { nombre: '`!cumpleaños <fecha>`', descripcion: 'Registra tu cumpleaños' },
        ],
      },
      {
        nombre: '🎮 Juegos',
        comandos: [
          { nombre: '`!blackjack crear`', descripcion: 'Crea una partida de Blackjack' },
          { nombre: '`!domino crear`', descripcion: 'Crea una partida de dominó' },
          { nombre: '`!trivia`', descripcion: 'Juego de preguntas' },
          { nombre: '`!ahorcado`', descripcion: 'Juego del ahorcado' },
          { nombre: '`!rps <piedra|papel|tijeras>`', descripcion: 'Piedra, papel o tijeras' },
          { nombre: '`!8ball <pregunta>`', descripcion: 'La bola mágica responde' },
        ],
      },
      {
        nombre: '🎨 Creativos & Info',
        comandos: [
          { nombre: '`!meme`', descripcion: 'Muestra un meme aleatorio' },
          { nombre: '`!chiste`', descripcion: 'Cuenta un chiste' },
          { nombre: '`!gif <término>`', descripcion: 'Busca un GIF' },
          { nombre: '`!clima <ciudad>`', descripcion: 'Consulta el clima' },
          { nombre: '`!dolar`', descripcion: 'Precio del dólar en Venezuela' },
          { nombre: '`!wiki <término>`', descripcion: 'Busca en Wikipedia' },
        ],
      },
      {
        nombre: '🎵 Productividad',
        comandos: [
          { nombre: '`!radio <estación>`', descripcion: 'Reproduce una radio' },
          { nombre: '`!timer <tiempo>`', descripcion: 'Inicia un temporizador' },
          { nombre: '`!notas`', descripcion: 'Gestiona tus notas' },
          { nombre: '`!tareas`', descripcion: 'Gestiona tus tareas' },
        ],
      },
    ];

    for (const categoria of categorias) {
      const texto = categoria.comandos
        .map(cmd => `**${cmd.nombre}** — ${cmd.descripcion}`)
        .join('\n');

      embed.addFields({
        name: categoria.nombre,
        value: texto,
        inline: false,
      });
    }

    embed.addFields({
      name: '📝 Ayuda adicional',
      value: '> Los parámetros entre `[]` son opcionales. Los de `<>` son requeridos.',
      inline: false,
    });

    try {
      await (message.channel as any).send({ embeds: [embed] });
    } catch (error) {
      console.error('Error al enviar el mensaje de comandos:', error);
      message.reply('❌ Ocurrió un error al mostrar los comandos.');
    }
  },
};

export default comando;
