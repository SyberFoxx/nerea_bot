import { Comando } from '../../types';
import { feedPet } from '../../sistemas/pets';

const FOOD_SLUGS = ['pet_food_basic', 'pet_food_premium'];

const comando: Comando = {
  nombre: 'alimentar',
  alias: ['feed'],
  descripcion: 'Alimenta a tu mascota con comida de tu inventario',
  uso: '!alimentar <pet_food_basic|pet_food_premium>',
  categoria: 'mascotas',
  ejecutar: async (message, args) => {
    const slug = args[0]?.toLowerCase();

    if (!slug || !FOOD_SLUGS.includes(slug)) {
      return message.reply({
        embeds: [{
          title: '🍖 ¿Qué comida usar?',
          description: FOOD_SLUGS.map(s => `\`${s}\``).join('\n'),
          color: 0xe67e22,
          footer: { text: 'Compra comida en !tienda • Ej: !alimentar pet_food_basic' },
        }],
      });
    }

    const result = await feedPet(message.author.id, message.guild!.id, slug);

    if (result.reason === 'no_pet')
      return message.reply('❌ No tienes mascota. Usa `!adoptar` para conseguir una.');

    if (result.reason === 'no_item')
      return message.reply(`❌ No tienes \`${slug}\` en tu inventario. Cómpralo en \`!tienda\`.`);

    if (result.reason === 'already_full')
      return message.reply('✅ Tu mascota ya tiene el hambre al máximo. ¡No necesita comer ahora!');

    const pet  = result.pet!;
    const type = pet.pet_types!;

    await message.reply({
      embeds: [{
        title: `${type.emoji} ¡${pet.name} comió!`,
        description: result.levelUp
          ? `🎉 ¡**${pet.name}** subió al nivel **${pet.level}**!`
          : `Hambre actual: **${pet.hunger}/100**`,
        color: 0x2ecc71,
        footer: { text: '!mascota para ver el estado completo' },
      }],
    });
  },
};

export default comando;
