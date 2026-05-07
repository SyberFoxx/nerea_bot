/**
 * Sistema de mascotas — Supabase
 */
import { supabase } from '../lib/supabase';
import { consumeItem } from './inventory';
import { updateBalance } from './economy';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface PetStats {
  max_hunger:    number;
  max_happiness: number;
  xp_bonus:      number;   // 0.10 = +10% XP por mensaje
  daily_bonus:   number;   // 0.10 = +10% en daily/weekly
  game_bonus:    number;   // 0.10 = +10% ganancias en juegos
  lucky:         number;   // 0.10 = 10% chance de no gastar ítem
  mute_shield:   boolean;  // protección anti-mute
}

export interface PetType {
  slug:        string;
  name:        string;
  emoji:       string;
  description: string;
  rarity:      Rarity;
  min_level:   number;
  price:       number;
  base_stats:  PetStats;
}

export interface UserPet {
  user_id:        string;
  guild_id:       string;
  pet_type_slug:  string;
  name:           string;
  level:          number;
  xp:             number;
  hunger:         number;
  happiness:      number;
  last_fed_at:    string;
  last_played_at: string;
  pet_types?:     PetType;
}

export interface InteractResult {
  success:  boolean;
  reason?:  'no_pet' | 'no_item' | 'already_full';
  pet?:     UserPet;
  levelUp?: boolean;
}

export type AdoptResult =
  | { success: true }
  | { success: false; reason: 'already_has_pet' | 'invalid_type' | 'level_too_low' | 'insufficient_funds' };

// ─── Constantes ───────────────────────────────────────────────────────────────

export const RARITY_META: Record<Rarity, { label: string; emoji: string; color: number }> = {
  common:    { label: 'Común',        emoji: '🟢', color: 0x2ecc71 },
  uncommon:  { label: 'Poco común',   emoji: '🔵', color: 0x3498db },
  rare:      { label: 'Raro',         emoji: '🟣', color: 0x9b59b6 },
  epic:      { label: 'Épico',        emoji: '🟠', color: 0xe67e22 },
  legendary: { label: 'Legendario',   emoji: '🔴', color: 0xe74c3c },
};

export function petXpRequired(level: number): number {
  return 50 * level + 100;
}

/** Verifica si la mascota está en buen estado (hambre y felicidad > 50). */
export function isPetHealthy(pet: UserPet): boolean {
  return pet.hunger > 50 && pet.happiness > 50;
}

// ─── Decay pasivo ─────────────────────────────────────────────────────────────

function applyDecay(pet: UserPet): { hunger: number; happiness: number } {
  const now        = Date.now();
  const fedAgo     = now - new Date(pet.last_fed_at).getTime();
  const playedAgo  = now - new Date(pet.last_played_at).getTime();

  // -1 hambre cada 30 min, -1 felicidad cada 45 min
  const hungerLoss    = Math.floor(fedAgo    / (30 * 60 * 1000));
  const happinessLoss = Math.floor(playedAgo / (45 * 60 * 1000));

  return {
    hunger:    Math.max(0, pet.hunger    - hungerLoss),
    happiness: Math.max(0, pet.happiness - happinessLoss),
  };
}

// ─── Queries base ─────────────────────────────────────────────────────────────

export async function getPetTypes(rarity?: Rarity): Promise<PetType[]> {
  let query = supabase
    .from('pet_types')
    .select('*')
    .order('min_level', { ascending: true });

  if (rarity) query = query.eq('rarity', rarity);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as PetType[];
}

export async function getPetType(slug: string): Promise<PetType | null> {
  const { data, error } = await supabase
    .from('pet_types')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data as PetType;
}

export async function getUserPet(userId: string, guildId: string): Promise<UserPet | null> {
  const { data, error } = await supabase
    .from('user_pets')
    .select('*, pet_types(*)')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  if (!data) return null;

  // Aplicar decay
  const decayed = applyDecay(data as UserPet);
  if (decayed.hunger !== data.hunger || decayed.happiness !== data.happiness) {
    await supabase
      .from('user_pets')
      .update({ hunger: decayed.hunger, happiness: decayed.happiness, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('guild_id', guildId);
    data.hunger    = decayed.hunger;
    data.happiness = decayed.happiness;
  }

  return data as UserPet;
}

// ─── Adoptar ──────────────────────────────────────────────────────────────────

export async function adoptPet(
  userId:    string,
  guildId:   string,
  typeSlug:  string,
  name:      string,
  userLevel: number,
): Promise<AdoptResult> {
  const existing = await getUserPet(userId, guildId);
  if (existing) return { success: false, reason: 'already_has_pet' };

  const type = await getPetType(typeSlug);
  if (!type) return { success: false, reason: 'invalid_type' };

  // Verificar nivel mínimo
  if (userLevel < type.min_level) return { success: false, reason: 'level_too_low' };

  // Cobrar si no es gratis
  if (type.price > 0) {
    try {
      await updateBalance(userId, guildId, -type.price, 'shop', `Adopción: ${type.name}`);
    } catch {
      return { success: false, reason: 'insufficient_funds' };
    }
  }

  const { error } = await supabase.from('user_pets').insert({
    user_id:        userId,
    guild_id:       guildId,
    pet_type_slug:  typeSlug,
    name:           name.slice(0, 32),
    level:          1,
    xp:             0,
    hunger:         100,
    happiness:      100,
    last_fed_at:    new Date().toISOString(),
    last_played_at: new Date().toISOString(),
  });

  if (error) throw error;
  return { success: true };
}

// ─── Alimentar ────────────────────────────────────────────────────────────────

export async function feedPet(
  userId:   string,
  guildId:  string,
  foodSlug: string,
): Promise<InteractResult> {
  const pet = await getUserPet(userId, guildId);
  if (!pet) return { success: false, reason: 'no_pet' };
  if (pet.hunger >= 100) return { success: false, reason: 'already_full' };

  // Lucky: chance de no gastar el ítem
  const lucky = (pet.pet_types?.base_stats.lucky ?? 0);
  const skipConsume = lucky > 0 && Math.random() < lucky;

  if (!skipConsume) {
    const consumed = await consumeItem(userId, guildId, foodSlug);
    if (!consumed) return { success: false, reason: 'no_item' };
  }

  const { data: itemData } = await supabase
    .from('shop_items').select('effect').eq('slug', foodSlug).single();

  const restore  = (itemData?.effect as any)?.hunger_restore ?? 30;
  const newHunger = Math.min(100, pet.hunger + restore);
  const xpGain   = 10;
  const newXp    = pet.xp + xpGain;
  const needed   = petXpRequired(pet.level);
  const levelUp  = newXp >= needed;
  const newLevel = levelUp ? pet.level + 1 : pet.level;

  const { data: updated, error } = await supabase
    .from('user_pets')
    .update({
      hunger:      newHunger,
      xp:          levelUp ? newXp - needed : newXp,
      level:       newLevel,
      last_fed_at: new Date().toISOString(),
      updated_at:  new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .select('*, pet_types(*)')
    .single();

  if (error) throw error;
  return { success: true, pet: updated as UserPet, levelUp };
}

// ─── Jugar ────────────────────────────────────────────────────────────────────

export async function playWithPet(
  userId:  string,
  guildId: string,
  toySlug: string,
): Promise<InteractResult> {
  const pet = await getUserPet(userId, guildId);
  if (!pet) return { success: false, reason: 'no_pet' };
  if (pet.happiness >= 100) return { success: false, reason: 'already_full' };

  const lucky = (pet.pet_types?.base_stats.lucky ?? 0);
  const skipConsume = lucky > 0 && Math.random() < lucky;

  if (!skipConsume) {
    const consumed = await consumeItem(userId, guildId, toySlug);
    if (!consumed) return { success: false, reason: 'no_item' };
  }

  const { data: itemData } = await supabase
    .from('shop_items').select('effect').eq('slug', toySlug).single();

  const restore      = (itemData?.effect as any)?.happiness_restore ?? 30;
  const newHappiness = Math.min(100, pet.happiness + restore);
  const xpGain       = 15;
  const newXp        = pet.xp + xpGain;
  const needed       = petXpRequired(pet.level);
  const levelUp      = newXp >= needed;
  const newLevel     = levelUp ? pet.level + 1 : pet.level;

  const { data: updated, error } = await supabase
    .from('user_pets')
    .update({
      happiness:      newHappiness,
      xp:             levelUp ? newXp - needed : newXp,
      level:          newLevel,
      last_played_at: new Date().toISOString(),
      updated_at:     new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .select('*, pet_types(*)')
    .single();

  if (error) throw error;
  return { success: true, pet: updated as UserPet, levelUp };
}

// ─── Renombrar ────────────────────────────────────────────────────────────────

export async function renamePet(userId: string, guildId: string, newName: string): Promise<boolean> {
  const pet = await getUserPet(userId, guildId);
  if (!pet) return false;
  await supabase
    .from('user_pets')
    .update({ name: newName.slice(0, 32), updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('guild_id', guildId);
  return true;
}

// ─── Bonus getters ────────────────────────────────────────────────────────────

/** Multiplicador de XP por mensaje (ej: 1.10 = +10%). Solo si mascota sana. */
export async function getPetXpBonus(userId: string, guildId: string): Promise<number> {
  const pet = await getUserPet(userId, guildId);
  if (!pet?.pet_types || !isPetHealthy(pet)) return 1;
  const bonus = pet.pet_types.base_stats.xp_bonus * pet.level;
  return 1 + Math.min(bonus, 0.5);
}

/** Multiplicador de daily/weekly. Solo si mascota sana. */
export async function getPetDailyBonus(userId: string, guildId: string): Promise<number> {
  const pet = await getUserPet(userId, guildId);
  if (!pet?.pet_types || !isPetHealthy(pet)) return 1;
  return 1 + (pet.pet_types.base_stats.daily_bonus ?? 0);
}

/** Multiplicador de ganancias en juegos. Solo si mascota sana. */
export async function getPetGameBonus(userId: string, guildId: string): Promise<number> {
  const pet = await getUserPet(userId, guildId);
  if (!pet?.pet_types || !isPetHealthy(pet)) return 1;
  return 1 + (pet.pet_types.base_stats.game_bonus ?? 0);
}

/** Tiene mute_shield activo. */
export async function hasMuteShield(userId: string, guildId: string): Promise<boolean> {
  const pet = await getUserPet(userId, guildId);
  if (!pet?.pet_types || !isPetHealthy(pet)) return false;
  return pet.pet_types.base_stats.mute_shield === true;
}
