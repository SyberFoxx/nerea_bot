import { Comando } from '../../types';
import { renamePet } from '../../sistemas/pets';

const comando: Comando = {
  nombre: 'renombrar',
  alias: ['rename-pet'],
  descripcion: 'Cambia el nombre de tu mascota',
  uso: '!renombrar <nuevo nombre>',
  categoria: 'mascotas',
  ejecutar: async (message, args) => {
    const newName = args.join(' ').trim();
    if (!newName) return message.reply('❌ Indica el nuevo nombre. Ej: `!renombrar Luna`');
    if (newName.length > 32) return message.reply('❌ El nombre no puede tener más de 32 caracteres.');

    const ok = await renamePet(message.author.id, message.guild!.id, newName);
    if (!ok) return message.reply('❌ No tienes mascota. Usa `!adoptar` para conseguir una.');

    await message.reply(`✅ Tu mascota ahora se llama **${newName}**.`);
  },
};

export default comando;
