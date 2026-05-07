import { Comando } from '../../types';
import { adoptPet, getPetTypes } from '../../sistemas/pets';

const comando: Comando = {
  nombre: 'adoptar',
  alias: ['adopt'],
  descripcion: 'Adopta una mascota',
  uso: '!adoptar <tipo> <nombre>',
  categoria: 'mascotas',
  ejecutar: async (message, args) => {
    const types = await getPetTypes();

    if (!args[0]) {
      const lista = types.map(t =>
        `${t.emoji} **${t.name}** — \`${t.slug}\`\n*${t.description}* • Bonus XP: +${(t.base_stats.xp_bonus * 100).toFixed(0)}%`
      ).join('\n\n');

      return message.reply({
        embeds: [{
          title: '🐾 Mascotas disponibles',
          description: lista,
          color: 0xe67e22,
          footer: { text: 'Uso: !adoptar <tipo> <nombre>  •  Ej: !adoptar cat Luna' },
        }],
      });
    }

    const typeSlug = args[0].toLowerCase();
    const name     = args.slice(1).join(' ').trim();

    if (!name) return message.reply('❌ Dale un nombre a tu mascota. Ej: `!adoptar cat Luna`');
    if (name.length > 32) return message.reply('❌ El nombre no puede tener más de 32 caracteres.');

    const result = await adoptPet(message.author.id, message.guild!.id, typeSlug, name);

    if (result.reason === 'already_has_pet')
      return message.reply('❌ Ya tienes una mascota. Usa `!mascota` para verla.');

    if (result.reason === 'invalid_type') {
      const slugs = types.map(t => `\`${t.slug}\``).join(', ');
      return message.reply(`❌ Tipo inválido. Tipos disponibles: ${slugs}`);
    }

    const type = types.find(t => t.slug === typeSlug)!;
    await message.reply({
      embeds: [{
        title: `${type.emoji} ¡Adoptaste a **${name}**!`,
        description: `Tu nueva mascota **${type.name}** ya está contigo.\nCuídala bien — aliméntala con \`!alimentar\` y juega con ella con \`!jugar\`.`,
        color: 0x2ecc71,
        fields: [
          { name: '🍖 Hambre',      value: '100/100', inline: true },
          { name: '😊 Felicidad',   value: '100/100', inline: true },
          { name: '⭐ Nivel',       value: '1',        inline: true },
        ],
        footer: { text: 'Usa !mascota para ver su estado en cualquier momento' },
      }],
    });
  },
};

export default comando;
