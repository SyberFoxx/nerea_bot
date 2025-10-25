const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const xpSystem = require('../../sistemas/xpSystem');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nivel')
    .setDescription('Muestra tu nivel y experiencia')
    .addUserOption(option =>
      option
        .setName('usuario')
        .setDescription('Usuario para ver el nivel (solo administradores)')
        .setRequired(false)
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('tabla')
        .setDescription('Muestra la tabla de clasificación de niveles')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('config')
        .setDescription('Configura el sistema de niveles')
        .addChannelOption(option =>
          option
            .setName('canal')
            .setDescription('Canal para los mensajes de subida de nivel')
            .setRequired(false)
        )
        .addIntegerOption(option =>
          option
            .setName('xp_por_mensaje')
            .setDescription('XP otorgada por mensaje')
            .setRequired(false)
        )
        .addStringOption(option =>
          option
            .setName('mensaje')
            .setDescription('Mensaje personalizado para subida de nivel (usa {user} y {level})')
            .setRequired(false)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('rol')
        .setDescription('Configura roles por nivel')
        .addIntegerOption(option =>
          option
            .setName('nivel')
            .setDescription('Nivel para el rol')
            .setRequired(true)
        )
        .addRoleOption(option =>
          option
            .setName('rol')
            .setDescription('Rol a asignar (deja en blanco para eliminar)')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const { options, guild, member } = interaction;
    const subcommand = options.getSubcommand();

    // Handle different subcommands
    switch (subcommand) {
      case 'tabla':
        return handleLeaderboard(interaction);
      case 'config':
        return handleConfig(interaction);
      case 'rol':
        return handleRoleConfig(interaction);
      default:
        return handleLevel(interaction);
    }
  },
};

// Show user level
async function handleLevel(interaction) {
  const targetUser = interaction.options.getUser('usuario') || interaction.user;
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);
  
  // Only allow users to check their own level or admins to check others
  if (targetUser.id !== interaction.user.id && !isAdmin) {
    return interaction.reply({
      content: '❌ Solo los administradores pueden ver el nivel de otros usuarios.',
      ephemeral: true
    });
  }

  try {
    const { xp, level, xpForNextLevel } = await xpSystem.getUserXP(
      targetUser.id,
      interaction.guild.id
    );

    const progress = Math.min(Math.floor((xp / xpForNextLevel) * 100), 100);
    const progressBar = createProgressBar(progress);

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setAuthor({ 
        name: `Nivel de ${targetUser.username}`, 
        iconURL: targetUser.displayAvatarURL() 
      })
      .addFields(
        { name: 'Nivel', value: level.toString(), inline: true },
        { name: 'XP', value: `${xp}/${xpForNextLevel}`, inline: true },
        { name: 'Progreso', value: `${progressBar} ${progress}%`, inline: false }
      )
      .setFooter({ text: 'Sistema de Niveles', iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    interaction.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error al obtener el nivel:', error);
    interaction.reply({
      content: '❌ Ocurrió un error al obtener la información del nivel.',
      ephemeral: true
    });
  }
}

// Show leaderboard
async function handleLeaderboard(interaction) {
  await interaction.deferReply();
  
  try {
    const leaderboard = await xpSystem.getLeaderboard(interaction.guild.id, 10);
    
    if (leaderboard.length === 0) {
      return interaction.editReply('No hay datos de nivel en este servidor.');
    }

    const embed = new EmbedBuilder()
      .setTitle('🏆 Tabla de Clasificación')
      .setColor('#f1c40f')
      .setDescription('Top 10 miembros por XP')
      .setFooter({ text: 'Sistema de Niveles', iconURL: interaction.client.user.displayAvatarURL() })
      .setTimestamp();

    const leaderboardText = await Promise.all(
      leaderboard.map(async (row, index) => {
        const user = await interaction.client.users.fetch(row.user_id).catch(() => ({}));
        const username = user.username || 'Usuario desconocido';
        const level = row.level;
        const xp = row.xp;
        const xpForNextLevel = xpSystem.getRequiredXP(level);
        const progress = Math.min(Math.floor((xp / xpForNextLevel) * 100), 100);
        
        return `**${index + 1}.** ${username} - Nivel ${level} (${xp}/${xpForNextLevel} XP) \`[${'█'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))}]\``;
      })
    );

    embed.addFields({
      name: 'Clasificación',
      value: leaderboardText.join('\n')
    });

    interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('Error al obtener la tabla de clasificación:', error);
    interaction.editReply({
      content: '❌ Ocurrió un error al obtener la tabla de clasificación.',
      ephemeral: true
    });
  }
}

// Configure level settings
async function handleConfig(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Necesitas permisos de administrador para configurar el sistema de niveles.',
      ephemeral: true
    });
  }

  const channel = interaction.options.getChannel('canal');
  const xpPerMessage = interaction.options.getInteger('xp_por_mensaje');
  const levelUpMessage = interaction.options.getString('mensaje');

  if (!channel && xpPerMessage === null && !levelUpMessage) {
    // Show current settings if no options provided
    const settings = await xpSystem.getGuildSettings(interaction.guild.id);
    
    const embed = new EmbedBuilder()
      .setTitle('⚙️ Configuración del Sistema de Niveles')
      .setColor('#3498db')
      .addFields(
        { name: 'XP por mensaje', value: settings.xp_per_message.toString(), inline: true },
        { name: 'Mensaje de nivel', value: settings.level_up_message, inline: true },
        { 
          name: 'Canal de notificaciones', 
          value: settings.level_up_channel_id 
            ? `<#${settings.level_up_channel_id}>` 
            : 'No configurado',
          inline: true 
        }
      )
      .setFooter({ text: 'Usa /nivel config [opciones] para cambiar la configuración' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // Update settings
  try {
    const currentSettings = await xpSystem.getGuildSettings(interaction.guild.id);
    
    const newSettings = {
      xp_per_message: xpPerMessage ?? currentSettings.xp_per_message,
      level_up_message: levelUpMessage ?? currentSettings.level_up_message,
      level_up_channel_id: channel ? channel.id : currentSettings.level_up_channel_id,
      xp_cooldown: currentSettings.xp_cooldown
    };

    await xpSystem.setGuildSettings(interaction.guild.id, newSettings);
    
    const embed = new EmbedBuilder()
      .setTitle('✅ Configuración actualizada')
      .setColor('#2ecc71')
      .setDescription('La configuración del sistema de niveles ha sido actualizada.')
      .addFields(
        { name: 'XP por mensaje', value: newSettings.xp_per_message.toString(), inline: true },
        { name: 'Mensaje de nivel', value: newSettings.level_up_message, inline: true },
        { 
          name: 'Canal de notificaciones', 
          value: newSettings.level_up_channel_id 
            ? `<#${newSettings.level_up_channel_id}>` 
            : 'No configurado',
          inline: true 
        }
      );

    interaction.reply({ embeds: [embed], ephemeral: true });
  } catch (error) {
    console.error('Error al actualizar la configuración:', error);
    interaction.reply({
      content: '❌ Ocurrió un error al actualizar la configuración.',
      ephemeral: true
    });
  }
}

// Configure level roles
async function handleRoleConfig(interaction) {
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      content: '❌ Necesitas permisos de administrador para configurar roles de nivel.',
      ephemeral: true
    });
  }

  const level = interaction.options.getInteger('nivel');
  const role = interaction.options.getRole('rol');

  if (!role) {
    // Remove role for this level
    try {
      const removed = await xpSystem.removeLevelRole(interaction.guild.id, level);
      
      if (removed) {
        await interaction.reply({
          content: `✅ Se eliminó el rol para el nivel ${level}.`,
          ephemeral: true
        });
      } else {
        await interaction.reply({
          content: `❌ No se encontró un rol configurado para el nivel ${level}.`,
          ephemeral: true
        });
      }
    } catch (error) {
      console.error('Error al eliminar rol de nivel:', error);
      interaction.reply({
        content: '❌ Ocurrió un error al eliminar el rol de nivel.',
        ephemeral: true
      });
    }
    return;
  }

  // Add/update role for this level
  try {
    await xpSystem.setLevelRole(interaction.guild.id, level, role.id);
    
    await interaction.reply({
      content: `✅ Se configuró el rol ${role} para el nivel ${level}.`,
      ephemeral: true
    });
  } catch (error) {
    console.error('Error al configurar rol de nivel:', error);
    interaction.reply({
      content: '❌ Ocurrió un error al configurar el rol de nivel.',
      ephemeral: true
    });
  }
}

// Helper function to create a progress bar
function createProgressBar(percentage) {
  const progress = Math.min(Math.max(percentage, 0), 100);
  const filledBlocks = Math.floor(progress / 10);
  const emptyBlocks = 10 - filledBlocks;
  
  return `[${'█'.repeat(filledBlocks)}${'░'.repeat(emptyBlocks)}]`;
}

// Add this to your messageCreate event handler
function setupXPEvents(client) {
  client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;
    
    try {
      await xpSystem.handleMessage(message);
    } catch (error) {
      console.error('Error in XP system event handler:', error);
    }
  });
}

// Export all functions
// Command handler for !nivel
async function handleNivelCommand(message, args) {
  const subcommand = args[0]?.toLowerCase();
  const targetUser = message.mentions.users.first() || message.author;
  
  try {
    if (!subcommand || subcommand === 'ver') {
      // Handle !nivel or !nivel @usuario
      const { xp, level, xpForNextLevel } = await xpSystem.getUserXP(
        targetUser.id,
        message.guild.id
      );

      const progress = Math.min(Math.floor((xp / xpForNextLevel) * 100), 100);
      const progressBar = createProgressBar(progress);

      const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setAuthor({ 
          name: `Nivel de ${targetUser.username}`, 
          iconURL: targetUser.displayAvatarURL() 
        })
        .addFields(
          { name: 'Nivel', value: level.toString(), inline: true },
          { name: 'XP', value: `${xp}/${xpForNextLevel}`, inline: true },
          { name: 'Progreso', value: `${progressBar} ${progress}%`, inline: false }
        )
        .setFooter({ text: 'Sistema de Niveles', iconURL: message.client.user.displayAvatarURL() })
        .setTimestamp();

      return message.channel.send({ embeds: [embed] });
    } else if (subcommand === 'tabla') {
      // Handle !nivel tabla
      const leaderboard = await xpSystem.getLeaderboard(message.guild.id, 10);
      
      if (leaderboard.length === 0) {
        return message.channel.send('No hay datos de nivel en este servidor.');
      }

      const embed = new EmbedBuilder()
        .setTitle('🏆 Tabla de Clasificación')
        .setColor('#f1c40f')
        .setDescription('Top 10 miembros por XP')
        .setFooter({ text: 'Sistema de Niveles', iconURL: message.client.user.displayAvatarURL() })
        .setTimestamp();

      const leaderboardText = [];
      
      for (let i = 0; i < leaderboard.length; i++) {
        const row = leaderboard[i];
        try {
          const user = await message.client.users.fetch(row.user_id);
          const username = user.username || 'Usuario desconocido';
          const level = row.level;
          const xp = row.xp;
          const xpForNextLevel = xpSystem.getRequiredXP(level);
          const progress = Math.min(Math.floor((xp / xpForNextLevel) * 100), 100);
          
          leaderboardText.push(`**${i + 1}.** ${username} - Nivel ${level} (${xp}/${xpForNextLevel} XP) \`[${'█'.repeat(Math.floor(progress / 10))}${'░'.repeat(10 - Math.floor(progress / 10))}]\``);
        } catch (error) {
          console.error('Error al obtener información del usuario:', error);
          leaderboardText.push(`**${i + 1}.** Usuario desconocido - Nivel ${row.level}`);
        }
      }

      embed.addFields({
        name: 'Clasificación',
        value: leaderboardText.join('\n')
      });

      return message.channel.send({ embeds: [embed] });
    } else if (subcommand === 'config' && message.member.permissions.has('ADMINISTRATOR')) {
      // Handle admin commands
      const setting = args[1]?.toLowerCase();
      const value = args.slice(2).join(' ');
      
      if (!setting) {
        // Show current settings
        const settings = await xpSystem.getGuildSettings(message.guild.id);
        const embed = new EmbedBuilder()
          .setTitle('⚙️ Configuración del Sistema de Niveles')
          .setColor('#3498db')
          .addFields(
            { name: 'XP por mensaje', value: settings.xp_per_message.toString(), inline: true },
            { name: 'Mensaje de nivel', value: settings.level_up_message, inline: true },
            { 
              name: 'Canal de notificaciones', 
              value: settings.level_up_channel_id 
                ? `<#${settings.level_up_channel_id}>` 
                : 'No configurado',
              inline: true 
            }
          )
          .setFooter({ text: 'Usa !nivel config [opción] [valor] para cambiar la configuración' });

        return message.channel.send({ embeds: [embed] });
      }
      
      // Handle specific settings
      if (setting === 'canal') {
        const channel = message.mentions.channels.first();
        if (!channel) {
          return message.channel.send('❌ Debes mencionar un canal válido.');
        }
        
        await xpSystem.setGuildSettings(message.guild.id, {
          level_up_channel_id: channel.id
        });
        
        return message.channel.send(`✅ Canal de notificaciones establecido a ${channel}`);
      } else if (setting === 'xppormensaje' && !isNaN(parseInt(value))) {
        const xp = parseInt(value);
        if (xp < 1 || xp > 100) {
          return message.channel.send('❌ La XP por mensaje debe estar entre 1 y 100.');
        }
        
        await xpSystem.setGuildSettings(message.guild.id, {
          xp_per_message: xp
        });
        
        return message.channel.send(`✅ XP por mensaje establecido a ${xp}.`);
      } else if (setting === 'mensaje' && value) {
        if (!value.includes('{user}') || !value.includes('{level}')) {
          return message.channel.send('❌ El mensaje debe incluir {user} y {level}.');
        }
        
        await xpSystem.setGuildSettings(message.guild.id, {
          level_up_message: value
        });
        
        return message.channel.send('✅ Mensaje de nivel actualizado correctamente.');
      } else {
        return message.channel.send('❌ Configuración no válida. Usa `!nivel config` para ver las opciones disponibles.');
      }
    } else if (subcommand === 'rol' && message.member.permissions.has('ADMINISTRATOR')) {
      // Handle role configuration
      const level = parseInt(args[1]);
      const role = message.mentions.roles.first();
      
      if (isNaN(level) || level < 1) {
        return message.channel.send('❌ Debes especificar un nivel válido (número mayor a 0).');
      }
      
      if (!role) {
        // Remove role for this level
        const removed = await xpSystem.removeLevelRole(message.guild.id, level);
        
        if (removed) {
          return message.channel.send(`✅ Se eliminó el rol para el nivel ${level}.`);
        } else {
          return message.channel.send(`❌ No se encontró un rol configurado para el nivel ${level}.`);
        }
      } else {
        // Add/update role for this level
        await xpSystem.setLevelRole(message.guild.id, level, role.id);
        return message.channel.send(`✅ Se configuró el rol ${role} para el nivel ${level}.`);
      }
    } else {
      // Show help
      const helpEmbed = new EmbedBuilder()
        .setTitle('❓ Ayuda del Sistema de Niveles')
        .setColor('#3498db')
        .setDescription('Sistema de niveles basado en actividad en el servidor.')
        .addFields(
          { name: 'Ver nivel', value: '`!nivel` - Muestra tu nivel y XP\n`!nivel @usuario` - Muestra el nivel de otro usuario', inline: false },
          { name: 'Tabla de clasificación', value: '`!nivel tabla` - Muestra el top 10 de usuarios por XP', inline: false },
          { name: 'Configuración (Admin)', value: '`!nivel config` - Muestra la configuración actual\n`!nivel config canal #canal` - Establece el canal de notificaciones\n`!nivel config xppormensaje [cantidad]` - Establece la XP por mensaje\n`!nivel config mensaje "[mensaje]"` - Establece el mensaje de nivel (usa {user} y {level})\n`!nivel rol [nivel] @rol` - Asigna un rol al alcanzar un nivel\n`!nivel rol [nivel]` - Elimina el rol de un nivel', inline: false }
        )
        .setFooter({ text: 'Sistema de Niveles', iconURL: message.client.user.displayAvatarURL() });
      
      return message.channel.send({ embeds: [helpEmbed] });
    }
  } catch (error) {
    console.error('Error en el comando de nivel:', error);
    message.channel.send('❌ Ocurrió un error al procesar el comando.');
  }
}

// Command export
module.exports = {
  nombre: 'nivel',
  alias: ['level', 'xp', 'rank'],
  categoria: 'utilidades',
  descripcion: 'Muestra tu nivel y experiencia en el servidor',
  permisos: [],
  ejecutar: handleNivelCommand,
  setupXPEvents,
  handleMessage: xpSystem.handleMessage,
  getRequiredXP: xpSystem.getRequiredXP,
  addXP: xpSystem.addXP,
  getUserXP: xpSystem.getUserXP,
  getLeaderboard: xpSystem.getLeaderboard,
  setLevelRole: xpSystem.setLevelRole,
  getLevelRole: xpSystem.getLevelRole,
  getAllLevelRoles: xpSystem.getAllLevelRoles,
  removeLevelRole: xpSystem.removeLevelRole,
  setGuildSettings: xpSystem.setGuildSettings,
  getGuildSettings: xpSystem.getGuildSettings
};
