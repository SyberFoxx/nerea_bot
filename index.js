// 1. Requiere módulos
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  registrarActividad,
} = require("./comandos/estadisticasServidor/_actividadTracking");
const xpSystem = require("./sistemas/xpSystem");
const { setupXPEvents } = require("./comandos/utilidades/nivel");

// Configurar FFmpeg estático
try {
  const ffmpeg = require('ffmpeg-static');
  process.env.FFMPEG_PATH = ffmpeg;
  console.log('FFmpeg configurado correctamente');
} catch (error) {
  console.log('ffmpeg-static no encontrado, usando FFmpeg del sistema');
}

// 2. Crea el cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers, // Necesario para los eventos de miembros
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});

// 3. Cargar comandos usando el nuevo cargador
const { getCommand, getCommandsByCategory } = require('./comandos');

// 3.1 Obtener comandos por categoría para uso futuro
const comandosPorCategoria = getCommandsByCategory();
console.log('\n📂 Categorías de comandos cargadas:');
Object.keys(comandosPorCategoria).forEach(categoria => {
  console.log(`  - ${categoria}: ${comandosPorCategoria[categoria].length} comandos`);
});

// 3.2 Función para manejar comandos
async function manejarComando(message) {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const nombreComando = args.shift().toLowerCase();

  const comando = getCommand(nombreComando);
  if (!comando) return;

  try {
    // Verificar permisos si es necesario
    if (comando.permisos && !message.member.permissions.has(comando.permisos)) {
      return message.reply('❌ No tienes permisos para usar este comando.');
    }

    // Verificar si es solo para servidores
    if (comando.soloServidor && !message.guild) {
      return message.reply('❌ Este comando solo puede usarse en servidores.');
    }

    // Verificar si es solo para NSFW
    if (comando.nsfw && !message.channel.nsfw) {
      return message.reply('❌ Este comando solo puede usarse en canales NSFW.');
    }

    // Ejecutar el comando
    await comando.ejecutar(message, args);
  } catch (error) {
    console.error(`Error al ejecutar el comando ${nombreComando}:`, error);
    message.reply('❌ Hubo un error al ejecutar el comando.');
  }
}

// 3.3 Configurar el manejador de mensajes
client.on('messageCreate', manejarComando);

// 3.4 Configurar el prefijo del bot
const prefix = process.env.PREFIX || '!';

// 4. Inicializar el sistema de XP
setupXPEvents(client);

// 4. Eventos del bot
client.once('ready', () => {
  console.log(`✅ ${client.user.tag} está en línea y listo para funcionar!`);
  console.log(`📊 Comandos cargados: ${Object.values(getCommandsByCategory()).reduce((acc, cat) => acc + cat.length, 0)}`);
  console.log(`🔄 Prefijo configurado: ${prefix}`);
  
  // Establecer estado del bot
  client.user.setActivity(`Usa ${prefix}ayuda para ver comandos`, { type: 'PLAYING' });
  
  // Registrar actividad del bot
  registrarActividad(client.user.id);
});

// 5. Manejo de errores
process.on('unhandledRejection', error => {
  console.error('Error no manejado en una promesa:', error);
});

process.on('uncaughtException', error => {
  console.error('Excepción no capturada:', error);
});

// 6. Cargar eventos
const eventosPath = path.join(__dirname, 'eventos');
const archivosEventos = fs.readdirSync(eventosPath).filter(archivo => archivo.endsWith('.js'));

for (const archivo of archivosEventos) {
    const rutaArchivo = path.join(eventosPath, archivo);
    const evento = require(rutaArchivo);
    if (evento.once) {
        client.once(evento.name, (...args) => evento.execute(...args));
    } else {
        client.on(evento.name, (...args) => evento.execute(...args));
    }
    console.log(`Evento cargado: ${evento.name}`);
}

// 7. Inicia sesión
client.login(process.env.DISCORD_TOKEN);
