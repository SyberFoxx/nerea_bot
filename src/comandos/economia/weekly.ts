import { Comando } from '../../types';
import { claimReward, getGuildEconomySettings, updateBalance } from '../../sistemas/economy';
import { getPetDailyBonus, getUserPet } from '../../sistemas/pets';

function msToHuman(ms: number): string {
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean).join(' ');
}

const comando: Comando = {
  nombre: 'weekly',
  alias: ['semanal'],
  descripcion: 'Reclama tu recompensa semanal de monedas',
  uso: '!weekly',
  categoria: 'economia',
  ejecutar: async (message) => {
    const guildId  = message.guild!.id;
    const userId   = message.author.id;
    const settings = await getGuildEconomySettings(guildId);
    const result   = await claimReward(userId, guildId, 'weekly');

    if (!result.success) {
      return message.reply({
        embeds: [{
          title: '⏳ Ya reclamaste tu weekly',
          description: `Vuelve en **${msToHuman(result.msRemaining)}**`,
          color: 0xe74c3c,
        }],
      });
    }

    // Aplicar bonus de mascota
    const petMultiplier = await getPetDailyBonus(userId, guildId);
    const bonusAmount   = Math.floor(result.amount * (petMultiplier - 1));

    if (bonusAmount > 0) {
      await updateBalance(userId, guildId, bonusAmount, 'reward', 'Bonus mascota (weekly)');
    }

    const pet         = bonusAmount > 0 ? await getUserPet(userId, guildId) : null;
    const petLine     = pet ? `\n${pet.pet_types?.emoji} **${pet.name}** te dio un bonus de ${settings.currency_emoji} **+${bonusAmount.toLocaleString()}**!` : '';
    const totalAmount = result.amount + bonusAmount;

    await message.reply({
      embeds: [{
        title: '🎁 ¡Recompensa semanal reclamada!',
        description:
          `Recibiste ${settings.currency_emoji} **${result.amount.toLocaleString()}** ${settings.currency_name}` +
          petLine +
          `\n\n💰 **Total: ${settings.currency_emoji} ${totalAmount.toLocaleString()}**`,
        color: 0x9b59b6,
        footer: { text: 'Vuelve en 7 días para tu próxima recompensa semanal' },
      }],
    });
  },
};

export default comando;
