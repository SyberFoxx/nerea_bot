import { Comando } from '../../types';

const comando: Comando = {
  nombre: 'mute',
  descripcion: 'Silencia a un usuario por un tiempo determinado',
  uso: '!mute @usuario <minutos>',
  categoria: 'moderacion',
  ejecutar: async (message, args) => {
    if (!message.member?.permissions.has('MuteMembers'))
      return message.reply('No tienes permisos para silenciar usuarios.');

    const usuario = message.mentions.members?.first();
    if (!usuario) return message.reply('Por favor menciona al usuario que quieres silenciar.');

    const tiempo = args[1] ? parseInt(args[1], 10) : 0;
    if (!tiempo) return message.reply('Por favor proporciona un tiempo válido (en minutos).');

    try {
      await usuario.timeout(tiempo * 60000);
      message.reply(`¡${usuario.user.tag} ha sido silenciado por ${tiempo} minuto(s)!`);

      setTimeout(async () => {
        await usuario.timeout(null);
        (message.channel as any).send(`El silencio de ${usuario.user.tag} ha sido levantado.`);
      }, tiempo * 60000);
    } catch (error) {
      console.error(error);
      message.reply('Hubo un error al intentar silenciar al usuario.');
    }
  },
};

export default comando;
