import fs from 'fs';
import path from 'path';
import { Comando } from './types';

// Mapas para almacenar comandos y alias
const commands = new Map<string, Comando>();
const aliases = new Map<string, string>();

interface ComandoCargado {
  name: string;
  path: string;
  category: string;
}

/**
 * Carga todos los comandos de forma recursiva desde un directorio
 */
function loadCommands(dir: string = __dirname, filelist: ComandoCargado[] = []): ComandoCargado[] {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      loadCommands(fullPath, filelist);
    } else if (file !== 'index.ts' && file !== 'index.js' && (file.endsWith('.ts') || file.endsWith('.js'))) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod = require(fullPath);
        const command: Comando = mod.default ?? mod;

        if (command.nombre && command.ejecutar) {
          commands.set(command.nombre, command);
          filelist.push({
            name: command.nombre,
            path: fullPath,
            category: path.basename(path.dirname(fullPath)),
          });

          if (command.alias && Array.isArray(command.alias)) {
            for (const alias of command.alias) {
              aliases.set(alias, command.nombre);
            }
          }

          console.log(`✅ Comando cargado: ${command.nombre} (${fullPath})`);
        }
      } catch (error) {
        console.error(`❌ Error al cargar el comando ${file}:`, error);
      }
    }
  }

  return filelist;
}

/**
 * Obtiene un comando por su nombre o alias
 */
function getCommand(name: string): Comando | null {
  return commands.get(name) ?? (aliases.has(name) ? commands.get(aliases.get(name)!) ?? null : null);
}

/**
 * Obtiene todos los comandos agrupados por categoría
 */
function getCommandsByCategory(): Record<string, Array<{ name: string; description: string; aliases: string[] }>> {
  const categories: Record<string, Array<{ name: string; description: string; aliases: string[] }>> = {};

  commands.forEach((command, name) => {
    const category = command.categoria ?? 'sin-categoria';
    if (!categories[category]) {
      categories[category] = [];
    }
    categories[category].push({
      name,
      description: command.descripcion ?? 'Sin descripción',
      aliases: command.alias ?? [],
    });
  });

  return categories;
}

// Cargar comandos al iniciar — solo desde src/comandos/
const comandosDir = path.join(__dirname, 'comandos');
const loadedCommands = loadCommands(comandosDir);
console.log(`\n📊 Estadísticas de comandos:`);
console.log(`✅ ${loadedCommands.length} comandos cargados`);
console.log(`🔤 ${aliases.size} alias registrados\n`);

export { commands, aliases, getCommand, getCommandsByCategory, loadCommands };
