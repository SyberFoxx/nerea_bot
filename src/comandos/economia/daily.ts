import { Comando } from '../../types';
import { claimReward, getGuildEconomySettings, updateBalance } from '../../sistemas/economy';
import { getPetDailyBonus, getUserPet } from '../../sistemas/pets';

function msToHuman(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return [h && `${h}h`, m && `${m}m`, s && `${s}s`].filter(Boolean).join(' ');
}

const comando: Comando = {
  nombre: 'daily',
  alias: ['diario'],
  descripcion: 'Reclama tu recompensa diaria de monedas',
  uso: '!daily',
  categoria: 'economia',
  ejecutar: async (message) => {
    const guildId  = message.guild!.id;
    const userId   = message.author.id;
    const settings = await getGuildEconomySettings(guildId);
    const result   = await claimReward(userId, guildId, 'daily');

    if (!result.success) {
      return message.reply({
        embeds: [{
          title: '⏳ Ya reclamaste tu daily',
          description: `Vuelve en **${msToHuman(result.msRemaining)}**`,
          color: 0xe74c3c,
        }],
      });
    }

    // Aplicar bonus de mascota
    const petMultiplier = await getPetDailyBonus(userId, guildId);
    const bonusAmount   = Math.floor(result.amount * (petMultiplier - 1));

    if (bonusAmount > 0) {
      await updateBalance(userId, guildId, bonusAmount, 'reward', 'Bonus mascota (daily)');
    }

    const pet         = bonusAmount > 0 ? await getUserPet(userId, guildId) : null;
    const petLine     = pet ? `\n${pet.pet_types?.emoji} **${pet.name}** te dio un bonus de ${settings.currency_emoji} **+${bonusAmount.toLocaleString()}**!` : '';
    const totalAmount = result.amount + bonusAmount;

    await message.reply({
      embeds: [{
        title: '🎁 ¡Recompensa diaria reclamada!',
        description:
          `Recibiste ${settings.currency_emoji} **${result.amount.toLocaleString()}** ${settings.currency_name}` +
          petLine +
          `\n\n💰 **Total: ${settings.currency_emoji} ${totalAmount.toLocaleString()}**`,
        color: 0x2ecc71,
        footer: { text: 'Vuelve mañana para tu próxima recompensa • !weekly para la semanal' },
      }],
    });
  },
};

export default comando;
