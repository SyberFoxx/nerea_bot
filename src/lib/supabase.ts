/**
 * Cliente Supabase — usa la service_role key para acceso total desde el bot.
 * NUNCA exponer esta key en el frontend.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url  = process.env.SUPABASE_URL!;
const key  = process.env.SUPABASE_SERVICE_KEY!;

if (!url || !key) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY en el .env');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});
