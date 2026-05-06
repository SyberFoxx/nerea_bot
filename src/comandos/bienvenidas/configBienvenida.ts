import { PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { Comando } from '../../types';

const configPath = path.join(__dirname, '../../../configBienvenidas.json');

interface BienvenidaConfig {
  canalId: string;
  mensaje: string;
  rolId: string | null;
  habilitado: boolean;
  fondo?: string;
}

export function saveConfig(guildId: string, config: BienvenidaConfig): BienvenidaConfig {
  let configs: Record<string, BienvenidaConfig> = {};
  if (fs.existsSync(configPath)) configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  configs[guildId] = config;
  fs.writeFileSync(configPath, JSON.stringify(configs, null, 2));
  return config;
}

export function getConfig(guildId: string): BienvenidaConfig | null {
  if (!fs.existsSync(configPath)) return null;
  try {
    const configs: Record<string, BienvenidaConfig> = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return configs[guildId] ?? null;
  } catch { return null; }
}

const comando: Comando = {
  nombre: 'configbienvenida',
  descripcion: 'Configura los mensajes de bienvenida',
  uso: '!configbienvenida #canal "Mensaje" [@rol]',
  ejecutar: async (message, args) => {
    if (!message.member?.permissions.has(PermissionFlagsBits.Administrator))
      return message.reply('❌ Necesitas permisos de administrador.');

    // Cambiar fondo
    if (args[0] === 'fondo' && args[1]) {
      if (!args[1].match(/\.(jpeg|jpg|gif|png)$/i))
        return message.reply('❌ URL de imagen no válida (JPEG, JPG, GIF o PNG).');
      const cfg = getConfig(message.guild!.id) ?? {} as any;
      cfg.fondo = args[1];
      saveConfig(message.guild!.id, cfg);
      return message.reply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle('✅ Fondo actualizado').setImage(args[1])] });
    }

    // Mostrar config actual
    if (args.length === 0) {
      const cfg = getConfig(message.guild!.id);
      if (!cfg) return message.reply('ℹ️ No hay configuración. Usa `!configbienvenida #canal "Mensaje"`.');
      const canal = message.guild!.channels.cache.get(cfg.canalId) ?? 'No encontrado';
      const rol = cfg.rolId ? (message.guild!.roles.cache.get(cfg.rolId)?.toString() ?? 'No encontrado') : 'Ninguno';
      return message.reply({ embeds: [new EmbedBuilder().setColor('#3498db').setTitle('⚙️ Config de bienvenidas')
        .addFields(
          { name: 'Canal', value: String(canal), inline: true },
          { name: 'Mensaje', value: cfg.mensaje ?? 'No definido', inline: true },
          { name: 'Rol', value: rol, inline: true },
          { name: 'Estado', value: cfg.habilitado ? '✅ Activo' : '❌ Inactivo', inline: true }
        )] });
    }

    const canalMencionado = message.mentions.channels.first();
    if (!canalMencionado) return message.reply('❌ Menciona un canal. Ej: `!configbienvenida #bienvenidas "¡Hola {usuario}!"`');

    const mensajeMatch = message.content.match(/"([^"]*)"/) ?? message.content.match(/'([^']*)'/);
    if (!mensajeMatch) return message.reply('❌ Incluye un mensaje entre comillas. Ej: `"¡Bienvenido {usuario}!"`');

    const rolMencionado = message.mentions.roles.first();
    const cfg: BienvenidaConfig = {
      canalId: canalMencionado.id,
      mensaje: mensajeMatch[1],
      rolId: rolMencionado?.id ?? null,
      habilitado: true,
    };
    saveConfig(message.guild!.id, cfg);

    await message.reply({ embeds: [new EmbedBuilder().setColor('#2ecc71').setTitle('✅ Bienvenida configurada')
      .addFields(
        { name: 'Canal', value: String(canalMencionado), inline: true },
        { name: 'Mensaje', value: cfg.mensaje, inline: true },
        { name: 'Rol', value: rolMencionado?.toString() ?? 'Ninguno', inline: true }
      ).setFooter({ text: 'Usa !simular para probar' })] });

    setTimeout(() => message.delete().catch(() => {}), 5000);
  },
};

export default comando;
