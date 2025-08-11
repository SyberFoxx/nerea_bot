// 1. Requiere módulos
const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  registrarActividad,
} = require("./comandos/estadisticasServidor/_actividadTracking");

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
  ],
});

// 3. Carga los comandos
const comandos = new Map();
const comandosPath = path.join(__dirname, "comandos");

// 3.1 Cargar comandos normales (archivos JS en /comandos)
const archivosComandos = fs.readdirSync(comandosPath);
for (const archivo of archivosComandos) {
  const archivoPath = path.join(comandosPath, archivo);
  if (fs.statSync(archivoPath).isFile() && archivo.endsWith(".js")) {
    const comando = require(archivoPath);
    comandos.set(comando.nombre, comando.ejecutar);
  }
}

// 3.2 Cargar comandos de juegos (archivos JS en /comandos/juegos)
const juegosPath = path.join(comandosPath, "juegos");
if (fs.existsSync(juegosPath)) {
  const archivosJuegos = fs.readdirSync(juegosPath);
  for (const archivo of archivosJuegos) {
    try {
      if (!archivo.endsWith('.js')) continue;
      console.log(`Cargando comando de juegos: ${archivo}`);
      const comando = require(path.join(juegosPath, archivo));
      if (comando && comando.nombre && comando.ejecutar) {
        comandos.set(comando.nombre, comando.ejecutar);
        console.log(`Comando ${comando.nombre} cargado correctamente`);
        
        // Registrar comandos slash si existen
        if (comando.data) {
          console.log(`Registrando comando slash: ${comando.data.name}`);
        }
      } else {
        console.error(`Error: El archivo ${archivo} no exporta correctamente un comando`);
      }
    } catch (error) {
      console.error(`Error al cargar el comando ${archivo}:`, error);
    }
  }
}

// 3.3 Cargar comandos de utilidad
const utilidadesPath = path.join(__dirname, "comandos", "utilidades");
if (fs.existsSync(utilidadesPath)) {
  const archivosUtilidades = fs.readdirSync(utilidadesPath);
  for (const archivo of archivosUtilidades) {
    const comando = require(`./comandos/utilidades/${archivo}`);
    comandos.set(comando.nombre, comando.ejecutar);
  }
}

// 3.4 Cargar comandos de moderación
const moderacionPath = path.join(__dirname, "comandos", "moderacion");
if (fs.existsSync(moderacionPath)) {
  const archivosModeracion = fs.readdirSync(moderacionPath);
  for (const archivo of archivosModeracion) {
    const comando = require(`./comandos/moderacion/${archivo}`);
    comandos.set(comando.nombre, comando.ejecutar);
  }
}

// 3.5 Cargar comandos de información
const informacionPath = path.join(__dirname, "comandos", "informacion");
if (fs.existsSync(informacionPath)) {
  const archivosInformacion = fs.readdirSync(informacionPath);
  for (const archivo of archivosInformacion) {
    const comando = require(`./comandos/informacion/${archivo}`);
    comandos.set(comando.nombre, comando.ejecutar);
  }
}

// 3.6 Cargar comandos de productividad
const productividadPath = path.join(__dirname, "comandos", "productividad");
if (fs.existsSync(productividadPath)) {
  const archivosProductividad = fs.readdirSync(productividadPath);
  for (const archivo of archivosProductividad) {
    const comando = require(`./comandos/productividad/${archivo}`);
    comandos.set(comando.nombre, comando.ejecutar);
  }
}

// 3.7 Cargar comandos de estadisticasServidor
const estadisticasServidorPath = path.join(__dirname, 'comandos', 'estadisticasServidor');
if (fs.existsSync(estadisticasServidorPath)) {
  const archivosEstadisticasServidor = fs.readdirSync(estadisticasServidorPath);
  for (const archivo of archivosEstadisticasServidor) {
    const comando = require(path.join(estadisticasServidorPath, archivo));
    comandos.set(comando.nombre, comando.ejecutar);
  }
}

// 3.8 Cargar comandos de IA (Chat con Cohere)
const iaPath = path.join(__dirname, 'comandos', 'IA');
if (fs.existsSync(iaPath)) {
  const archivosIA = fs.readdirSync(iaPath);
  for (const archivo of archivosIA) {
    const comando = require(path.join(iaPath, archivo));
    comandos.set(comando.nombre, comando.ejecutar);
  }
}

// 3.9 Cargar comandos de extras creativos
const extrasCreativosPath = path.join(__dirname, 'comandos', 'extrasCreativos');
if (fs.existsSync(extrasCreativosPath)) {
  const archivosExtrasCreativos = fs.readdirSync(extrasCreativosPath);
  for (const archivo of archivosExtrasCreativos) {
    const comando = require(path.join(extrasCreativosPath, archivo));
    comandos.set(comando.nombre, comando.ejecutar);
  }
}

// 4. Cuando el bot esté listo
client.once("ready", () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

// 5. Cuando reciba un mensaje
client.on("messageCreate", async (message) => {
  if (message.author.bot) return; // Evitar que los bots interactúen

  // Registrar la actividad de los usuarios
  registrarActividad(message.author.id); // Llamamos al sistema de tracking para registrar la actividad

  if (!message.content.startsWith("!")) return; // Solo ejecutamos comandos si empiezan con "!"

  const args = message.content.slice(1).trim().split(/ +/);
  const nombreComando = args.shift().toLowerCase();

  if (comandos.has(nombreComando)) {
    try {
      await comandos.get(nombreComando)(message, args);
    } catch (error) {
      console.error(error);
      message.reply("Hubo un error al ejecutar el comando.");
    }
  }
});


// 6. Inicia sesión
client.login(process.env.DISCORD_TOKEN);
