import { Comando } from '../../types';
import { getUserPet, petXpRequired } from '../../sistemas/pets';

function bar(value: number, max = 100, length = 10): string {
  const filled = Math.round((value / max) * length);
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

function moodEmoji(hunger: number, happiness: number): string {
  if (hunger < 20 || happiness < 20) return '😢';
  if (hunger < 50 || happiness < 50) return '😐';
  if (hunger >= 80 && happiness >= 80) return '😍';
  return '😊';
}

const comando: Comando = {
  nombre: 'mascota',
  alias: ['pet', 'mi-mascota'],
  descripcion: 'Muestra el estado de tu mascota',
  uso: '!mascota',
  categoria: 'mascotas',
  ejecutar: async (message) => {
    const pet = await getUserPet(message.author.id, message.guild!.id);

    if (!pet) {
      return message.reply({
        embeds: [{
          title: '🐾 No tienes mascota',
          description: 'Usa `!adoptar` para ver los tipos disponibles y adoptar una.',
          color: 0x95a5a6,
        }],
      });
    }

    const type    = pet.pet_types!;
    const xpNeeded = petXpRequired(pet.level);
    const mood    = moodEmoji(pet.hunger, pet.happiness);

    await message.reply({
      embeds: [{
        title: `${type.emoji} ${pet.name} ${mood}`,
        description: `*${type.name}* de ${message.author}`,
        color: pet.hunger < 20 || pet.happiness < 20 ? 0xe74c3c : 0x2ecc71,
        fields: [
          {
            name: '🍖 Hambre',
            value: `${bar(pet.hunger)} ${pet.hunger}/100`,
            inline: false,
          },
          {
            name: '😊 Felicidad',
            value: `${bar(pet.happiness)} ${pet.happiness}/100`,
            inline: false,
          },
          {
            name: '⭐ Nivel',
            value: `**${pet.level}** (${pet.xp}/${xpNeeded} XP)`,
            inline: true,
          },
          {
            name: '🎁 Bonus XP',
            value: pet.hunger >= 20 && pet.happiness >= 20
              ? `+${((type.base_stats.xp_bonus * pet.level) * 100).toFixed(0)}%`
              : '❌ (triste/hambrienta)',
            inline: true,
          },
        ],
        footer: { text: '!alimentar <comida> • !jugar <juguete> • !tienda para comprar ítems' },
        timestamp: new Date().toISOString(),
      }],
    });
  },
};

export default comando;
