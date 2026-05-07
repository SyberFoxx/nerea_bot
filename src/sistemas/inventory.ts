/**
 * Sistema de inventario y tienda — Supabase
 */
import { supabase } from '../lib/supabase';
import { updateBalance } from './economy';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ShopItem {
  id:          number;
  slug:        string;
  name:        string;
  description: string;
  emoji:       string;
  price:       number;
  type:        'consumable' | 'cosmetic' | 'role' | 'pet_food' | 'pet_toy';
  effect:      Record<string, any> | null;
  is_active:   boolean;
}

export interface InventoryEntry {
  item_slug:   string;
  quantity:    number;
  shop_items:  ShopItem;
}

// ─── Tienda ───────────────────────────────────────────────────────────────────

export async function getShopItems(type?: string): Promise<ShopItem[]> {
  let query = supabase
    .from('shop_items')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true });

  if (type) query = query.eq('type', type);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getShopItem(slug: string): Promise<ShopItem | null> {
  const { data, error } = await supabase
    .from('shop_items')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error && error.code === 'PGRST116') return null;
  if (error) throw error;
  return data;
}

// ─── Inventario ───────────────────────────────────────────────────────────────

export async function getInventory(userId: string, guildId: string): Promise<InventoryEntry[]> {
  const { data, error } = await supabase
    .from('inventory')
    .select('item_slug, quantity, shop_items(*)')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .gt('quantity', 0);

  if (error) throw error;
  return (data ?? []) as unknown as InventoryEntry[];
}

export async function hasItem(userId: string, guildId: string, slug: string): Promise<number> {
  const { data } = await supabase
    .from('inventory')
    .select('quantity')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .eq('item_slug', slug)
    .single();

  return data?.quantity ?? 0;
}

/** Añade ítems al inventario (compra o recompensa). */
export async function addToInventory(
  userId: string,
  guildId: string,
  slug: string,
  quantity = 1,
): Promise<void> {
  const current = await hasItem(userId, guildId, slug);

  if (current > 0) {
    // Ya existe — incrementar cantidad
    await supabase
      .from('inventory')
      .update({ quantity: current + quantity })
      .eq('user_id', userId)
      .eq('guild_id', guildId)
      .eq('item_slug', slug);
  } else {
    // No existe — insertar
    await supabase.from('inventory').insert({
      user_id:  userId,
      guild_id: guildId,
      item_slug: slug,
      quantity,
    });
  }
}

/** Consume un ítem del inventario. Retorna false si no tiene suficientes. */
export async function consumeItem(
  userId: string,
  guildId: string,
  slug: string,
  quantity = 1,
): Promise<boolean> {
  const current = await hasItem(userId, guildId, slug);
  if (current < quantity) return false;

  await supabase
    .from('inventory')
    .update({ quantity: current - quantity })
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .eq('item_slug', slug);

  return true;
}

// ─── Compra ───────────────────────────────────────────────────────────────────

export interface BuyResult {
  success: boolean;
  reason?: 'not_found' | 'insufficient_funds';
  item?:   ShopItem;
}

export async function buyItem(
  userId: string,
  guildId: string,
  slug: string,
  quantity = 1,
): Promise<BuyResult> {
  const item = await getShopItem(slug);
  if (!item) return { success: false, reason: 'not_found' };

  const totalCost = item.price * quantity;

  try {
    await updateBalance(userId, guildId, -totalCost, 'shop', `Compra: ${item.name} ×${quantity}`);
  } catch {
    return { success: false, reason: 'insufficient_funds' };
  }

  await addToInventory(userId, guildId, slug, quantity);
  return { success: true, item };
}
