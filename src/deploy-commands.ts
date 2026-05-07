/**
 * Script para registrar los slash commands en Discord.
 * Ejecutar con: npx ts-node src/deploy-commands.ts
 *
 * - Sin argumentos: registra en todos los servidores (global, tarda ~1 hora en propagarse)
 * - Con --guild: registra solo en el servidor de prueba (instantáneo)
 *
 * Ejemplo: npx ts-node src/deploy-commands.ts --guild 123456789
 */

import { REST, Routes } from 'discord.js';
import dotenv from 'dotenv';
import { slashCommands } from './slash/index';

dotenv.config();

const token     = process.env.DISCORD_TOKEN!;
const clientId  = process.env.CLIENT_ID!;
const guildArg  = process.argv.indexOf('--guild');
const guildId   = guildArg !== -1 ? process.argv[guildArg + 1] : process.env.GUILD_ID;

if (!token || !clientId) {
  console.error('❌ Faltan DISCORD_TOKEN o CLIENT_ID en el .env');
  process.exit(1);
}

const commands = [...slashCommands.values()].map(cmd => cmd.data.toJSON());
const rest     = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log(`📤 Registrando ${commands.length} slash commands...`);

    if (guildId) {
      // Registro instantáneo en un servidor específico (ideal para desarrollo)
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
      console.log(`✅ Slash commands registrados en el servidor ${guildId} (instantáneo)`);
    } else {
      // Registro global (tarda ~1 hora en propagarse a todos los servidores)
      await rest.put(Routes.applicationCommands(clientId), { body: commands });
      console.log('✅ Slash commands registrados globalmente (puede tardar hasta 1 hora)');
    }

    console.log('\nComandos registrados:');
    commands.forEach(cmd => console.log(`  /${cmd.name} — ${cmd.description}`));
  } catch (error) {
    console.error('❌ Error al registrar slash commands:', error);
  }
})();
