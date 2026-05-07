/**
 * Sistema de mascotas — Supabase
 */
import { supabase } from '../lib/supabase';
import { consumeItem } from './inventory';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PetType {
  slug:        string;
  name:        string;
  emoji:       string;
  description: string;
  base_stats:  { max_hunger: number; max_happiness: number; xp_bonus: number };
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

// XP necesario para subir de nivel la mascota
export function petXpRequired(level: number): number {
  return 50 * level + 100;
}

// ─── Decay pasivo ─────────────────────────────────────────────────────────────
// Hambre y felicidad bajan con el tiempo aunque no interactúes

function applyDecay(pet: UserPet): { hunger: number; happiness: number } {
  const now        = Date.now();
  const fedAgo     = now - new Date(pet.last_fed_at).getTime();
  const playedAgo  = now - new Date(pet.last_played_at).getTime();

  // -1 de hambre cada 30 min, -1 de felicidad cada 45 min
  const hungerLoss    = Math.floor(fedAgo    / (30 * 60 * 1000));
  const happinessLoss = Math.floor(playedAgo / (45 * 60 * 1000));

  return {
    hunger:    Math.max(0, pet.hunger    - hungerLoss),
    happiness: Math.max(0, pet.happiness - happinessLoss),
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getPetTypes(): Promise<PetType[]> {
  const { data, error } = await supabase
    .from('pet_types')
    .select('*')
    .order('slug');
  if (error) throw error;
  return data ?? [];
}

export async function getPetType(slug: string): Promise<PetType | null> {
  const { data, error } = await supabase
    .from('pet_types')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
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

  // Aplicar decay y actualizar en DB si cambió algo
  const decayed = applyDecay(data);
  if (decayed.hunger !== data.hunger || decayed.happiness !== data.happiness) {
    await supabase
      .from('user_pets')
      .update({ hunger: decayed.hunger, happiness: decayed.happiness, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('guild_id', guildId);
    data.hunger    = decayed.hunger;
    data.happiness = decayed.happiness;
  }

  return data;
}

// ─── Adoptar ──────────────────────────────────────────────────────────────────

export async function adoptPet(
  userId: string,
  guildId: string,
  typeSlug: string,
  name: string,
): Promise<{ success: boolean; reason?: 'already_has_pet' | 'invalid_type' }> {
  const existing = await getUserPet(userId, guildId);
  if (existing) return { success: false, reason: 'already_has_pet' };

  const type = await getPetType(typeSlug);
  if (!type) return { success: false, reason: 'invalid_type' };

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

export interface InteractResult {
  success:   boolean;
  reason?:   'no_pet' | 'no_item' | 'already_full';
  pet?:      UserPet;
  levelUp?:  boolean;
}

export async function feedPet(
  userId: string,
  guildId: string,
  foodSlug: string,
): Promise<InteractResult> {
  const pet = await getUserPet(userId, guildId);
  if (!pet) return { success: false, reason: 'no_pet' };

  if (pet.hunger >= 100) return { success: false, reason: 'already_full' };

  // Consumir ítem del inventario
  const consumed = await consumeItem(userId, guildId, foodSlug);
  if (!consumed) return { success: false, reason: 'no_item' };

  // Obtener cuánto restaura el ítem
  const { data: itemData } = await supabase
    .from('shop_items')
    .select('effect')
    .eq('slug', foodSlug)
    .single();

  const restore = (itemData?.effect as any)?.hunger_restore ?? 30;
  const newHunger = Math.min(100, pet.hunger + restore);

  // Dar XP a la mascota por ser alimentada
  const xpGain  = 10;
  const newXp   = pet.xp + xpGain;
  const needed  = petXpRequired(pet.level);
  const levelUp = newXp >= needed;
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
  return { success: true, pet: updated, levelUp };
}

// ─── Jugar ────────────────────────────────────────────────────────────────────

export async function playWithPet(
  userId: string,
  guildId: string,
  toySlug: string,
): Promise<InteractResult> {
  const pet = await getUserPet(userId, guildId);
  if (!pet) return { success: false, reason: 'no_pet' };

  if (pet.happiness >= 100) return { success: false, reason: 'already_full' };

  const consumed = await consumeItem(userId, guildId, toySlug);
  if (!consumed) return { success: false, reason: 'no_item' };

  const { data: itemData } = await supabase
    .from('shop_items')
    .select('effect')
    .eq('slug', toySlug)
    .single();

  const restore = (itemData?.effect as any)?.happiness_restore ?? 30;
  const newHappiness = Math.min(100, pet.happiness + restore);

  const xpGain  = 15;
  const newXp   = pet.xp + xpGain;
  const needed  = petXpRequired(pet.level);
  const levelUp = newXp >= needed;
  const newLevel = levelUp ? pet.level + 1 : pet.level;

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
  return { success: true, pet: updated, levelUp };
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

// ─── Bonus de XP de la mascota ────────────────────────────────────────────────

/** Retorna el multiplicador de XP que da la mascota (ej: 1.05 = +5%). */
export async function getPetXpBonus(userId: string, guildId: string): Promise<number> {
  const pet = await getUserPet(userId, guildId);
  if (!pet || !pet.pet_types) return 1;

  // Si la mascota está triste o hambrienta, no da bonus
  if (pet.hunger < 20 || pet.happiness < 20) return 1;

  const base  = pet.pet_types.base_stats.xp_bonus ?? 0;
  const bonus = base * pet.level; // escala con el nivel
  return 1 + Math.min(bonus, 0.5); // máximo +50%
}
