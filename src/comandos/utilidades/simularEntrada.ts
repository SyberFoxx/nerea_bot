import { Events } from 'discord.js';
import { Comando } from '../../types';

// Importación dinámica para evitar dependencia circular
let getConfig: ((guildId: string) => any) | null = null;
try {
  getConfig = require('../../comandos/bienvenidas/configBienvenida').getConfig;
} catch {
  console.warn('configBienvenida no disponible en src todavía');
}

const comando: Comando = {
  nombre: 'simular',
  descripcion: 'Simula la entrada de un nuevo miembro al servidor',
  uso: '!simular [@usuario]',
  ejecutar: async (message) => {
    if (!message.member?.permissions.has('Administrator'))
      return message.reply('❌ Necesitas permisos de administrador.');

    const usuario = message.mentions.users.first() ?? message.author;
    const miembro = message.guild?.members.cache.get(usuario.id);
    if (!miembro) return message.reply('❌ No se pudo encontrar al miembro.');

    const config = getConfig ? getConfig(message.guild!.id) : null;
    if (!config) return message.reply('❌ No hay configuración de bienvenida. Configúrala primero.');

    const canal = message.guild?.channels.cache.get(config.canalId) as any;
    if (!canal) return message.reply(`❌ No se encontró el canal de bienvenida (ID: ${config.canalId})`);

    const respuesta = await message.reply(`🔹 **Simulando entrada de ${miembro}...**`);
    message.client.emit(Events.GuildMemberAdd, miembro);
    await respuesta.edit(`✅ Simulación completada. Mensaje enviado a ${canal}.`);

    setTimeout(() => {
      message.delete().catch(() => {});
      respuesta.delete().catch(() => {});
    }, 10_000);
  },
};

export default comando;
