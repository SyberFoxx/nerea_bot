import { Comando } from '../types';
import { getCommand } from '../index';

const comando: Comando = {
  nombre: 'ayuda',
  alias: ['help', 'commands'],
  descripcion: 'Muestra todos los comandos disponibles',
  categoria: 'utilidades',
  ejecutar: async (message) => {
    try {
      const comandos = getCommand('comandos');
      if (comandos) {
        return comandos.ejecutar(message, []);
      }
    } catch (error) {
      console.error('Error al cargar el comando de comandos:', error);
      return message.reply('❌ Ocurrió un error al cargar los comandos.');
    }
  },
};

export default comando;
