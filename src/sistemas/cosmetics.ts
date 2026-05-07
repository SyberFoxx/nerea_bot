/**
 * Sistema de cosméticos equipados — Supabase
 * Gestiona qué marco, título y color tiene activo cada usuario.
 */
import { supabase } from '../lib/supabase';
import { hasItem } from './inventory';

export interface EquippedCosmetics {
  equipped_frame: string | null;
  equipped_title: string | null;
  equipped_color: string | null;
}

export type CosmeticSlot = 'frame' | 'title' | 'color';

// Metadatos visuales de cada marco para el canvas
export const FRAME_STYLES: Record<string, {
  borderColor:  string;
  glowColor:    string;
  glowBlur:     number;
  borderWidth:  number;
  style:        'solid' | 'double' | 'glow' | 'gradient' | 'ornate';
}> = {
  frame_basic:      { borderColor: '#95a5a6', glowColor: '#95a5a6', glowBlur: 0,  borderWidth: 4,  style: 'solid'    },
  frame_gold:       { borderColor: '#f1c40f', glowColor: '#f1c40f', glowBlur: 8,  borderWidth: 6,  style: 'double'   },
  frame_neon_blue:  { borderColor: '#00d2ff', glowColor: '#00d2ff', glowBlur: 20, borderWidth: 5,  style: 'glow'     },
  frame_neon_pink:  { borderColor: '#ff6b9d', glowColor: '#ff6b9d', glowBlur: 20, borderWidth: 5,  style: 'glow'     },
  frame_fire:       { borderColor: '#e74c3c', glowColor: '#ff6b35', glowBlur: 25, borderWidth: 6,  style: 'glow'     },
  frame_ice:        { borderColor: '#00d2ff', glowColor: '#a8edff', glowBlur: 18, borderWidth: 5,  style: 'glow'     },
  frame_galaxy:     { borderColor: '#9b59b6', glowColor: '#c39bd3', glowBlur: 22, borderWidth: 6,  style: 'gradient' },
  frame_dragon:     { borderColor: '#c0392b', glowColor: '#e74c3c', glowBlur: 20, borderWidth: 7,  style: 'ornate'   },
  frame_celestial:  { borderColor: '#ffd700', glowColor: '#fffacd', glowBlur: 25, borderWidth: 6,  style: 'glow'     },
  frame_void:       { borderColor: '#8e44ad', glowColor: '#6c3483', glowBlur: 30, borderWidth: 7,  style: 'glow'     },
  frame_legendary:  { borderColor: '#ffd700', glowColor: '#ffd700', glowBlur: 35, borderWidth: 8,  style: 'ornate'   },
};

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getEquipped(userId: string, guildId: string): Promise<EquippedCosmetics> {
  const { data, error } = await supabase
    .from('user_cosmetics')
    .select('equipped_frame, equipped_title, equipped_color')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  if (error && error.code === 'PGRST116') {
    return { equipped_frame: null, equipped_title: null, equipped_color: null };
  }
  if (error) throw error;
  return data ?? { equipped_frame: null, equipped_title: null, equipped_color: null };
}

export type EquipResult =
  | { success: true }
  | { success: false; reason: 'not_owned' | 'wrong_slot' | 'invalid_slug' };

/** Equipa un cosmético. Verifica que el usuario lo tenga en el inventario. */
export async function equipCosmetic(
  userId:  string,
  guildId: string,
  slug:    string,
): Promise<EquipResult> {
  // Verificar que existe en la tienda y obtener su tipo
  const { data: item } = await supabase
    .from('shop_items')
    .select('type, slug')
    .eq('slug', slug)
    .single();

  if (!item) return { success: false, reason: 'invalid_slug' };

  const validTypes = ['frame', 'title', 'color', 'cosmetic'];
  if (!validTypes.includes(item.type)) return { success: false, reason: 'wrong_slot' };

  // Verificar que lo tiene en el inventario
  const qty = await hasItem(userId, guildId, slug);
  if (qty === 0) return { success: false, reason: 'not_owned' };

  // Determinar el slot
  const slot: CosmeticSlot = item.type === 'cosmetic' ? 'frame'
    : item.type as CosmeticSlot;

  const column = `equipped_${slot}`;

  // Upsert en user_cosmetics
  const { error } = await supabase
    .from('user_cosmetics')
    .upsert(
      { user_id: userId, guild_id: guildId, [column]: slug, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,guild_id' }
    );

  if (error) throw error;
  return { success: true };
}

/** Desequipa un slot (frame, title o color). */
export async function unequipCosmetic(
  userId:  string,
  guildId: string,
  slot:    CosmeticSlot,
): Promise<void> {
  const column = `equipped_${slot}`;
  await supabase
    .from('user_cosmetics')
    .upsert(
      { user_id: userId, guild_id: guildId, [column]: null, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,guild_id' }
    );
}
