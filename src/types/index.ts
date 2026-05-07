import { Message, PermissionResolvable, TextBasedChannel, ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

// Canal que soporta envío de mensajes
export type TextChannel = Extract<TextBasedChannel, { send: (...args: any[]) => any }>;

// Interfaz base para comandos de prefijo (!)
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

// Interfaz para slash commands (/)
export interface SlashComando {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>;
  ejecutar: (interaction: ChatInputCommandInteraction) => Promise<any> | any;
}
