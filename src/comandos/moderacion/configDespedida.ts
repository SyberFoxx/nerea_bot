import { PermissionFlagsBits } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { Comando } from '../../types';

const configPath = path.join(__dirname, '../../../config/despedidas.json');
if (!fs.existsSync(configPath)) fs.writeFileSync(configPath, JSON.stringify({}), 'utf8');

interface DespedidaConfig { canalId: string | null; mensaje: string; habilitado: boolean; }

function getConfig(guildId: string): Record<string, DespedidaConfig> {
  try {
    const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (!data[guildId]) {
      data[guildId] = { canalId: null, mensaje: '{usuario} ha abandonado el servidor. ¡Hasta pronto! 👋', habilitado: false };
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
    }
    return data;
  } catch { return {}; }
}

async function saveConfig(config: Record<string, DespedidaConfig>): Promise<void> {
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2));
}

const comando: Comando = {
  nombre: 'configdespedida',
  alias: ['setfarewell', 'despedida'],
  descripcion: 'Configura los mensajes de despedida',
  categoria: 'moderacion',
  permisos: [PermissionFlagsBits.ManageGuild],
  ejecutar: async (message, args) => {
    const sub = args[0]?.toLowerCase();
    const guildId = message.guild!.id;
    const config = getConfig(guildId);

    try {
      switch (sub) {
        case 'canal': {
          const canal = message.mentions.channels.first();
          if (!canal) return message.reply('❌ Menciona un canal. Ej: `!configdespedida canal #despedidas`');
          config[guildId].canalId = canal.id;
          config[guildId].habilitado = true;
          await saveConfig(config);
          return message.reply(`✅ Canal de despedidas: ${canal}`);
        }
        case 'mensaje': {
          const msg = args.slice(1).join(' ');
          if (!msg) return message.reply('❌ Escribe el mensaje. Variables: `{usuario}`, `{servidor}`, `{miembros}`');
          config[guildId].mensaje = msg;
          await saveConfig(config);
          return message.reply('✅ Mensaje de despedida actualizado.');
        }
        case 'on': case 'activar':
          config[guildId].habilitado = true;
          await saveConfig(config);
          return message.reply('✅ Despedidas activadas.');
        case 'off': case 'desactivar':
          config[guildId].habilitado = false;
          await saveConfig(config);
          return message.reply('❌ Despedidas desactivadas.');
        case 'ver': case 'config': {
          const c = config[guildId];
          return message.reply(
            `⚙️ **Config despedidas**\n` +
            `Canal: ${c.canalId ? `<#${c.canalId}>` : 'No configurado'}\n` +
            `Estado: ${c.habilitado ? '✅ Activo' : '❌ Inactivo'}\n` +
            `Mensaje: \`${c.mensaje}\``
          );
        }
        default:
          return message.reply(
            '**Uso:** `!configdespedida canal #canal` | `!configdespedida mensaje <texto>` | `!configdespedida on/off` | `!configdespedida ver`'
          );
      }
    } catch (error) {
      console.error('Error en configDespedida:', error);
      return message.reply('❌ Ocurrió un error al procesar el comando.');
    }
  },
};

export default comando;
