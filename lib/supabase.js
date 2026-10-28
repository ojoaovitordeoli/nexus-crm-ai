import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const ready = Boolean(url && key && url.startsWith('https://') && !key.includes('COLE_'));
export const db = ready ? createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
