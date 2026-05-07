import { Comando } from '../../types';
import { playWithPet } from '../../sistemas/pets';

const TOY_SLUGS = ['pet_toy_ball', 'pet_toy_premium'];

const comando: Comando = {
  nombre: 'jugar',
  alias: ['play', 'jugar-mascota'],
  descripcion: 'Juega con tu mascota usando un juguete del inventario',
  uso: '!jugar <pet_toy_ball|pet_toy_premium>',
  categoria: 'mascotas',
  ejecutar: async (message, args) => {
    const slug = args[0]?.toLowerCase();

    if (!slug || !TOY_SLUGS.includes(slug)) {
      return message.reply({
        embeds: [{
          title: '🎾 ¿Qué juguete usar?',
          description: TOY_SLUGS.map(s => `\`${s}\``).join('\n'),
          color: 0x3498db,
          footer: { text: 'Compra juguetes en !tienda • Ej: !jugar pet_toy_ball' },
        }],
      });
    }

    const result = await playWithPet(message.author.id, message.guild!.id, slug);

    if (result.reason === 'no_pet')
      return message.reply('❌ No tienes mascota. Usa `!adoptar` para conseguir una.');

    if (result.reason === 'no_item')
      return message.reply(`❌ No tienes \`${slug}\` en tu inventario. Cómpralo en \`!tienda\`.`);

    if (result.reason === 'already_full')
      return message.reply('✅ Tu mascota ya está al máximo de felicidad. ¡Está muy contenta!');

    const pet  = result.pet!;
    const type = pet.pet_types!;

    await message.reply({
      embeds: [{
        title: `${type.emoji} ¡${pet.name} jugó contigo!`,
        description: result.levelUp
          ? `🎉 ¡**${pet.name}** subió al nivel **${pet.level}**!`
          : `Felicidad actual: **${pet.happiness}/100**`,
        color: 0x3498db,
        footer: { text: '!mascota para ver el estado completo' },
      }],
    });
  },
};

export default comando;
