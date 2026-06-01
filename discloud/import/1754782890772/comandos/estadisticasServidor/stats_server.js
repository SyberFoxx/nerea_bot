module.exports = {
  nombre: "stats",
  ejecutar: async (message) => {
    const { guild } = message;
    if (!guild)
      return message.reply("Este comando solo se puede usar en un servidor.");

    const miembros = guild.memberCount;
    const canales = guild.channels.cache.size;
    const roles = guild.roles.cache.size;

    message.reply(
      `📊 Estadísticas del servidor:\n👥 Miembros: ${miembros}\n📁 Canales: ${canales}\n🎭 Roles: ${roles}`
    );
  },
};
