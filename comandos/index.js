const fs = require('fs');
const path = require('path');

/**
 * Manejador de comandos dinámicos
 * 
 * Este módulo se encarga de cargar y gestionar todos los comandos
 * de forma dinámica desde las subcarpetas de comandos.
 * 
 * Estructura esperada:
 * comandos/
 *   ├── index.js         (este archivo)
 *   ├── moderacion/      (comandos de moderación)
 *   ├── utilidades/      (comandos de utilidad)
 *   └── ...              (otras categorías)
 */

// Mapa para almacenar comandos y alias
const commands = new Map();
const aliases = new Map();

/**
 * Carga todos los comandos de forma recursiva
 * @param {string} dir - Directorio a escanear
 * @param {Array} filelist - Lista de archivos (usado en la recursión)
 * @returns {Array} Lista de comandos cargados
 */
function loadCommands(dir = __dirname, filelist = []) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // Si es un directorio, cargar recursivamente
            loadCommands(fullPath, filelist);
        } else if (file !== 'index.js' && file.endsWith('.js')) {
            try {
                // Cargar el comando
                const command = require(fullPath);
                
                // Verificar que el comando tenga las propiedades requeridas
                if (command.nombre && command.ejecutar) {
                    // Agregar a la lista de comandos
                    commands.set(command.nombre, command);
                    filelist.push({
                        name: command.nombre,
                        path: fullPath,
                        category: path.basename(path.dirname(fullPath))
                    });

                    // Registrar alias si existen
                    if (command.alias && Array.isArray(command.alias)) {
                        command.alias.forEach(alias => {
                            aliases.set(alias, command.nombre);
                        });
                    }

                    console.log(`✅ Comando cargado: ${command.nombre} (${fullPath})`);
                }
            } catch (error) {
                console.error(`❌ Error al cargar el comando ${file}:`, error);
            }
        }
    });

    return filelist;
}

/**
 * Obtiene un comando por su nombre o alias
 * @param {string} name - Nombre o alias del comando
 * @returns {Object|null} El comando o null si no se encuentra
 */
function getCommand(name) {
    return commands.get(name) || 
           (aliases.has(name) ? commands.get(aliases.get(name)) : null);
}

/**
 * Obtiene todos los comandos agrupados por categoría
 * @returns {Object} Comandos agrupados por categoría
 */
function getCommandsByCategory() {
    const categories = {};

    commands.forEach((command, name) => {
        const category = command.categoria || 'sin-categoria';
        if (!categories[category]) {
            categories[category] = [];
        }
        categories[category].push({
            name,
            description: command.descripcion || 'Sin descripción',
            aliases: command.alias || [],
            permissions: command.permisos || []
        });
    });

    return categories;
}

// Cargar comandos al iniciar
const loadedCommands = loadCommands();
console.log(`\n📊 Estadísticas de comandos:`);
console.log(`✅ ${loadedCommands.length} comandos cargados`);
console.log(`🔤 ${aliases.size} alias registrados\n`);

// Exportar funcionalidades
module.exports = {
    commands,
    aliases,
    getCommand,
    getCommandsByCategory,
    loadCommands
};
