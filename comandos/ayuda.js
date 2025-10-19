const { EmbedBuilder } = require('discord.js');

module.exports = {
    nombre: 'ayuda',
    alias: ['help', 'commands'],
    descripcion: 'Muestra todos los comandos disponibles organizados por categorías',
    categoria: 'utilidades',
    permisos: [],
    
    async ejecutar(message) {
        // Redirigir al comando de comandos principal
        try {
            const comandos = require('./comandos');
            return comandos.ejecutar(message);
        } catch (error) {
            console.error('Error al cargar el comando de comandos:', error);
            return message.reply('❌ Ocurrió un error al cargar los comandos. Por favor, inténtalo de nuevo más tarde.');
        }
    }
};
