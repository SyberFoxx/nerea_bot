module.exports = {
    nombre: 'perfil',
    ejecutar: async (message) => {
      const miembro = message.guild.members.cache.get(message.author.id);
      const fechaUnion = miembro.joinedAt.toLocaleDateString();
  
      const roles = miembro.roles.cache
        .map(role => role.name)
        .join(', ')
        .replace('@everyone', 'ninguno');
  
      message.reply(`**Perfil de ${message.author.tag}**:
      - Fecha de unión: ${fechaUnion}
      - Roles: ${roles}`);
    }
  };
  