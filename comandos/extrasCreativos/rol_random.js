message.guild.roles.fetch()
  .then(() => {
    const roles = message.guild.roles.cache.filter(role => role.name !== "@everyone");
    const randomRole = roles.random();

    if (randomRole) {
      message.member.roles.add(randomRole)
        .then(() => message.reply(`¡Se te ha asignado el rol ${randomRole.name}!`))
        .catch(err => {
          console.error(err); 
          message.reply('Hubo un error al asignar el rol.');
        });
    } else {
      message.reply('No hay roles disponibles.');
    }
  })
  .catch(err => {
    console.error('Error al actualizar la caché de roles:', err);
    message.reply('Hubo un error al intentar acceder a los roles.');
  });
