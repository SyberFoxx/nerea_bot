/**
 * Sistema de economía central — Supabase
 * Maneja billeteras, transacciones y recompensas diarias/semanales.
 */
import { supabase } from '../lib/supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface Wallet {
  user_id:      string;
  guild_id:     string;
  balance:      number;
  total_earned: number;
}

export type TransactionType =
  | 'daily' | 'weekly'
  | 'transfer_in' | 'transfer_out'
  | 'shop' | 'game_win' | 'game_loss'
  | 'pet_care' | 'reward';

export interface GuildEconomySettings {
  daily_reward:   number;
  weekly_reward:  number;
  currency_name:  string;
  currency_emoji: string;
}

// ─── Billetera ────────────────────────────────────────────────────────────────

/** Obtiene o crea la billetera de un usuario en un servidor. */
export async function getWallet(userId: string, guildId: string): Promise<Wallet> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .single();

  if (error && error.code === 'PGRST116') {
    // No existe — crear con saldo 0
    const { data: newWallet, error: insertError } = await supabase
      .from('wallets')
      .insert({ user_id: userId, guild_id: guildId, balance: 0, total_earned: 0 })
      .select()
      .single();
    if (insertError) throw insertError;
    return newWallet;
  }
  if (error) throw error;
  return data;
}

/** Añade o resta saldo. Lanza error si el saldo quedaría negativo. */
export async function updateBalance(
  userId: string,
  guildId: string,
  amount: number,
  type: TransactionType,
  description?: string,
): Promise<Wallet> {
  const wallet = await getWallet(userId, guildId);

  const newBalance = wallet.balance + amount;
  if (newBalance < 0) throw new Error('Saldo insuficiente');

  const newTotalEarned = amount > 0
    ? wallet.total_earned + amount
    : wallet.total_earned;

  const { data, error } = await supabase
    .from('wallets')
    .update({ balance: newBalance, total_earned: newTotalEarned, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .select()
    .single();

  if (error) throw error;

  // Registrar transacción
  await supabase.from('transactions').insert({
    user_id: userId,
    guild_id: guildId,
    type,
    amount,
    description: description ?? type,
  });

  return data;
}

/** Transfiere monedas entre dos usuarios. */
export async function transfer(
  fromId: string,
  toId: string,
  guildId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) throw new Error('El monto debe ser mayor a 0');
  await updateBalance(fromId, guildId, -amount, 'transfer_out', `Transferencia a <@${toId}>`);
  await updateBalance(toId,   guildId,  amount, 'transfer_in',  `Transferencia de <@${fromId}>`);
}

// ─── Recompensas ──────────────────────────────────────────────────────────────

const COOLDOWNS = {
  daily:  24 * 60 * 60 * 1000,       // 24 horas
  weekly: 7 * 24 * 60 * 60 * 1000,   // 7 días
};

export interface ClaimResult {
  success:    boolean;
  amount:     number;
  msRemaining: number; // 0 si success
}

export async function claimReward(
  userId: string,
  guildId: string,
  type: 'daily' | 'weekly',
): Promise<ClaimResult> {
  const settings = await getGuildEconomySettings(guildId);
  const amount   = type === 'daily' ? settings.daily_reward : settings.weekly_reward;
  const cooldown = COOLDOWNS[type];

  // Verificar último claim
  const { data: claim } = await supabase
    .from('reward_claims')
    .select('claimed_at')
    .eq('user_id', userId)
    .eq('guild_id', guildId)
    .eq('type', type)
    .single();

  if (claim) {
    const elapsed = Date.now() - new Date(claim.claimed_at).getTime();
    if (elapsed < cooldown) {
      return { success: false, amount: 0, msRemaining: cooldown - elapsed };
    }
  }

  // Actualizar o insertar claim
  await supabase.from('reward_claims').upsert({
    user_id:    userId,
    guild_id:   guildId,
    type,
    claimed_at: new Date().toISOString(),
  });

  await updateBalance(userId, guildId, amount, type, `Recompensa ${type}`);
  return { success: true, amount, msRemaining: 0 };
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export async function getLeaderboard(guildId: string, limit = 10) {
  const { data, error } = await supabase
    .from('wallets')
    .select('user_id, balance, total_earned')
    .eq('guild_id', guildId)
    .order('balance', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ─── Configuración del servidor ───────────────────────────────────────────────

export async function getGuildEconomySettings(guildId: string): Promise<GuildEconomySettings> {
  const { data } = await supabase
    .from('guild_settings')
    .select('daily_reward, weekly_reward, currency_name, currency_emoji')
    .eq('guild_id', guildId)
    .single();

  return data ?? {
    daily_reward:   200,
    weekly_reward:  1000,
    currency_name:  'Nereacoin',
    currency_emoji: '🪙',
  };
}

/** Formatea una cantidad con el emoji y nombre de la moneda del servidor. */
export async function formatCurrency(guildId: string, amount: number): Promise<string> {
  const s = await getGuildEconomySettings(guildId);
  return `${s.currency_emoji} **${amount.toLocaleString()}** ${s.currency_name}`;
}
