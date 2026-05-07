import fs from 'fs';
import path from 'path';
import { SlashComando } from '../types';

const slashCommands = new Map<string, SlashComando>();

function loadSlashCommands(dir: string = __dirname): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      loadSlashCommands(fullPath);
    } else if (entry.name !== 'index.ts' && entry.name !== 'index.js' && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      try {
        const mod: SlashComando = require(fullPath).default ?? require(fullPath);
        if (mod?.data && mod?.ejecutar) {
          slashCommands.set(mod.data.name, mod);
          console.log(`✅ Slash cargado: /${mod.data.name}`);
        }
      } catch (error) {
        console.error(`❌ Error cargando slash ${entry.name}:`, error);
      }
    }
  }
}

loadSlashCommands();
console.log(`📊 ${slashCommands.size} slash commands cargados\n`);

export { slashCommands };
