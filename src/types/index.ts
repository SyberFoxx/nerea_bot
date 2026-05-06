import { Message, PermissionResolvable, TextBasedChannel } from 'discord.js';

// Canal que soporta envío de mensajes
export type TextChannel = Extract<TextBasedChannel, { send: (...args: any[]) => any }>;

// Interfaz base para todos los comandos
export interface Comando {
  nombre: string;
  alias?: string[];
  descripcion?: string;
  uso?: string;
  categoria?: string;
  permisos?: PermissionResolvable;
  soloServidor?: boolean;
  nsfw?: boolean;
  ejecutar: (message: Message, args: string[]) => Promise<any> | any;
}
