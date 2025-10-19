const { EmbedBuilder } = require('discord.js');

module.exports = {
    nombre: 'comandos',
    alias: ['cmds', 'commands'],
    descripcion: 'Muestra todos los comandos disponibles organizados por categorías',
    categoria: 'utilidades',
    permisos: [],
    
    async ejecutar(message) {
        // Crear el embed principal
        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('📋 LISTA DE COMANDOS')
            .setDescription('> Aquí tienes todos los comandos disponibles organizados por categorías.\n> Usa `!ayuda [comando]` para más información sobre un comando específico.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
            .setThumbnail(message.client.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setFooter({ 
                text: `Solicitado por ${message.author.username}`, 
                iconURL: message.author.displayAvatarURL() 
            })
            .setTimestamp();

        // Definir las categorías y sus comandos
        const categorias = [
            {
                nombre: '🛡️ Moderación',
                color: '#e74c3c',
                comandos: [
                    { nombre: '`!limpiar [cantidad]`', descripcion: 'Elimina mensajes del canal' },
                    { nombre: '`!ban [@usuario] [razón]`', descripcion: 'Banea a un usuario' },
                    { nombre: '`!kick [@usuario] [razón]`', descripcion: 'Expulsa a un usuario' },
                    { nombre: '`!mute [@usuario] [tiempo]`', descripcion: 'Silencia a un usuario' },
                    { nombre: '`!advertencia [@usuario] [razón]`', descripcion: 'Envía una advertencia' },
                    { nombre: '`!deshacer [cantidad]`', descripcion: 'Deshace acciones de moderación' }
                ]
            },
            {
                nombre: '👋 Bienvenidas',
                color: '#3498db',
                comandos: [
                    { nombre: '`!configbienvenida #canal "mensaje"`', descripcion: 'Configura el mensaje de bienvenida' },
                    { nombre: '`!configbienvenida fondo [URL]`', descripcion: 'Establece la imagen de fondo' },
                    { nombre: '`!simularentrada [@usuario]`', descripcion: 'Prueba la bienvenida' }
                ]
            },
            {
                nombre: '🔧 Utilidades',
                color: '#2ecc71',
                comandos: [
                    { nombre: '`!avatar [@usuario]`', descripcion: 'Muestra el avatar' },
                    { nombre: '`!serverinfo`', descripcion: 'Información del servidor' },
                    { nombre: '`!userinfo [@usuario]`', descripcion: 'Información de usuario' },
                    { nombre: '`!ping`', descripcion: 'Muestra la latencia' },
                    { nombre: '`!ayuda`', descripcion: 'Muestra la ayuda detallada' }
                ]
            },
            {
                nombre: '🎮 Juegos',
                color: '#9b59b6',
                comandos: [
                    { nombre: '`!pregunta [texto]`', descripcion: 'Haz una pregunta' },
                    { nombre: '`!rps [piedra/papel/tijera]`', descripcion: 'Piedra, papel o tijera' },
                    { nombre: '`!dado [caras]`', descripcion: 'Tira un dado' },
                    { nombre: '`!moneda`', descripcion: 'Lanza una moneda' },
                    { nombre: '`!trivia`', descripcion: 'Juego de preguntas' }
                ]
            },
            {
                nombre: '🎨 Creativos',
                color: '#e67e22',
                comandos: [
                    { nombre: '`!meme`', descripcion: 'Muestra un meme' },
                    { nombre: '`!chiste`', descripcion: 'Cuenta un chiste' },
                    { nombre: '`!gif [término]`', descripcion: 'Busca un GIF' },
                    { nombre: '`!frasemotivadora`', descripcion: 'Frase motivadora' }
                ]
            }
        ];

        // Agregar cada categoría como un campo separado
        for (const categoria of categorias) {
            let comandosText = '';
            
            // Agregar cada comando con formato
            for (const cmd of categoria.comandos) {
                comandosText += `\n**${cmd.nombre}**
${cmd.descripcion}\n`;
            }
            
            // Agregar la categoría al embed
            embed.addFields({
                name: `\n${categoria.nombre}`,
                value: `\`\`\`\`${comandosText}\`\`\`\n`,
                inline: false
            });
        }

        // Agregar nota final
        embed.addFields({
            name: '\n📝 ¿Necesitas ayuda adicional?',
            value: '\n> • Usa `!ayuda [comando]` para ver información detallada de un comando.\n> • Los parámetros entre `[]` son opcionales.\n> • Los parámetros entre `<>` son requeridos.\n',
            inline: false
        });

        // Enviar el mensaje
        try {
            await message.channel.send({ embeds: [embed] });
        } catch (error) {
            console.error('Error al enviar el mensaje de comandos:', error);
            message.reply('❌ Ocurrió un error al mostrar los comandos. Por favor, inténtalo de nuevo.');
        }
    }
};
