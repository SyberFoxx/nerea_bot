import { Client, GatewayIntentBits, Message } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Configurar FFmpeg
try {
  const ffmpeg = require('ffmpeg-static');
  process.env.FFMPEG_PATH = ffmpeg;
  console.log('FFmpeg configurado correctamente');
} catch { console.log('ffmpeg-static no encontrado, usando FFmpeg del sistema'); }

// Crear cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: ['MESSAGE' as any, 'CHANNEL' as any, 'REACTION' as any],
});

// Prefijo para comandos legacy (!)
const prefix = process.env.PREFIX ?? '!';

// ── Cargar comandos de prefijo ─────────────────────────────────────────────
const { getCommand, getCommandsByCategory } = require('./index');
const categorias = getCommandsByCategory();
console.log('\n📂 Categorías de comandos cargadas:');
Object.keys(categorias).forEach((cat: string) => {
  console.log(`  - ${cat}: ${categorias[cat].length} comandos`);
});

// ── Cargar slash commands ──────────────────────────────────────────────────
const { slashCommands } = require('./slash/index');

// ── Registrar actividad y XP ───────────────────────────────────────────────
const { registrarActividad } = require('./comandos/estadisticasServidor/_actividadTracking');
const { setupXPEvents }      = require('./comandos/utilidades/nivel');
setupXPEvents(client);

// ── Manejador de comandos con prefijo (!) ──────────────────────────────────
async function manejarComando(message: Message): Promise<void> {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args         = message.content.slice(prefix.length).trim().split(/ +/);
  const nombreComando = args.shift()!.toLowerCase();
  const comando       = getCommand(nombreComando);
  if (!comando) return;

  try {
    if (comando.permisos && !(message.member as any)?.permissions.has(comando.permisos))
      return void message.reply('❌ No tienes permisos para usar este comando.');
    if (comando.soloServidor && !message.guild)
      return void message.reply('❌ Este comando solo puede usarse en servidores.');
    if (comando.nsfw && !(message.channel as any).nsfw)
      return void message.reply('❌ Este comando solo puede usarse en canales NSFW.');

    await comando.ejecutar(message, args);
  } catch (error) {
    console.error(`Error al ejecutar ${nombreComando}:`, error);
    message.reply('❌ Hubo un error al ejecutar el comando.');
  }
}

client.on('messageCreate', manejarComando);

// Evento ready
client.once('ready', () => {
  console.log(`✅ ${client.user!.tag} está en línea!`);
  console.log(`📊 Comandos (!): ${Object.values(categorias).reduce((a: number, c: any) => a + c.length, 0)}`);
  console.log(`⚡ Slash commands: ${slashCommands.size}`);
  console.log(`🔄 Prefijo: ${prefix}`);
  client.user!.setActivity(`/ayuda | ${prefix}ayuda`);
  registrarActividad(client.user!.id);
});

// Manejo de errores globales
process.on('unhandledRejection', (error) => console.error('Promesa no manejada:', error));
process.on('uncaughtException', (error) => console.error('Excepción no capturada:', error));

// Cargar eventos desde src/eventos
const eventosPath = path.join(__dirname, 'eventos');
if (fs.existsSync(eventosPath)) {
  const archivos = fs.readdirSync(eventosPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
  for (const archivo of archivos) {
    const evento = require(path.join(eventosPath, archivo));
    if (evento.once) client.once(evento.name, (...args) => evento.execute(...args));
    else client.on(evento.name, (...args) => evento.execute(...args));
    console.log(`Evento cargado: ${evento.name}`);
  }
}

// Iniciar sesión
client.login(process.env.DISCORD_TOKEN);
