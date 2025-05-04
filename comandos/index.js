// Bot de Discord usando Discord.js

const { Client, GatewayIntentBits } = require("discord.js");
require("dotenv").config();

// Almacena listas de nombres por servidor
const listasDeNombres = new Map();

// Crea una instancia del cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Evento cuando el bot está listo
client.once("ready", () => {
  console.log(`Bot conectado como ${client.user.tag}`);
});

// Evento al recibir un mensaje
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // Comando básico
  if (message.content === "!ping") {
    message.reply("Pong!");
  }

  // Comando para mostrar los comandos disponibles
  if (message.content === "!comandos") {
    message.reply(
      "**Comandos disponibles:**\n" +
        "`!ping` - Verifica que el bot esté activo\n" +
        "`!agregar nombre1 nombre2 ...` - Agrega nombres para sorteo\n" +
        "`!sortear` - Realiza un sorteo con los nombres agregados\n" +
        "`!reiniciar` - Borra todos los nombres guardados\n" +
        "`!lista` - Muestra los nombres actualmente agregados\n" +
        "`!comandos` - Muestra esta lista de comandos"
    );
  }

  // Comando para agregar nombres a la lista del servidor
  if (message.content.startsWith("!agregar")) {
    const nombres = message.content.split(" ").slice(1);
    if (nombres.length === 0) {
      message.reply(
        "Debes agregar al menos un nombre. Ejemplo: !agregar Ana Pedro"
      );
      return;
    }

    const idServidor = message.guild.id;
    if (!listasDeNombres.has(idServidor)) {
      listasDeNombres.set(idServidor, []);
    }

    const lista = listasDeNombres.get(idServidor);
    lista.push(...nombres);
    message.reply(`Nombres agregados: ${nombres.join(", ")}`);
  }

  // Comando para realizar sorteo desde la lista almacenada
  if (message.content === "!sortear") {
    const idServidor = message.guild.id;
    const lista = listasDeNombres.get(idServidor) || [];

    if (lista.length < 2) {
      message.reply(
        "Necesitas al menos dos nombres en la lista para sortear. Usa !agregar para añadir."
      );
      return;
    }

    const ganador = lista[Math.floor(Math.random() * lista.length)];
    message.reply(`🎉 El ganador del coñazo es: **${ganador}**`);
  }

  // Comando para reiniciar la lista
  if (message.content === "!reiniciar") {
    const idServidor = message.guild.id;
    listasDeNombres.set(idServidor, []);
    message.reply("La lista de nombres ha sido reiniciada.");
  }

  // Comando para mostrar la lista actual
  if (message.content === "!lista") {
    const idServidor = message.guild.id;
    const lista = listasDeNombres.get(idServidor) || [];

    if (lista.length === 0) {
      message.reply(
        "No hay nombres en la lista actualmente. Usa !agregar para añadir."
      );
    } else {
      message.reply(`Nombres actuales en la lista: **${lista.join(", ")}** `);
    }
  }
});

// Inicia sesión con el token del bot
client.login(process.env.DISCORD_TOKEN);
