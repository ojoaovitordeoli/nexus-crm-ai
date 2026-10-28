import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

export const configStatus = {
  urlReady: Boolean(url && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)),
  keyReady: Boolean(key && key.length > 20 && !key.includes('COLE_') && !key.includes('SUA_CHAVE')),
};
export const ready = configStatus.urlReady && configStatus.keyReady;
export const db = ready ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
