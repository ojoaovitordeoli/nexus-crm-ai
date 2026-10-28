import { createClient } from '@supabase/supabase-js';

// Estas credenciais são públicas e destinadas ao cliente (NUNCA service_role).
// Mantemos fallback para recuperar o login enquanto as variáveis de build
// do Netlify não chegam ao bundle do Next.js. Assim que a configuração do
// Netlify estiver estável, os valores poderão ser centralizados por ambiente.
const publicProjectUrl = 'https://qhizuqcdxivdvjtefofz.supabase.co';
const publicPublishableKey = 'sb_publishable_GxKDhdmNBWoN_cKPbBLl2g_QReVWNFU';

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
const isUrl = value => Boolean(value && /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(value));
const isPublicKey = value => Boolean(value && value.length > 20 &&
  !value.includes('COLE_') && !value.includes('SUA_CHAVE') &&
  (value.startsWith('sb_publishable_') || value.startsWith('eyJ')));

const url = isUrl(envUrl) ? envUrl : publicProjectUrl;
const key = isPublicKey(envKey) ? envKey : publicPublishableKey;

export const configStatus = {
  urlReady: isUrl(url),
  keyReady: isPublicKey(key),
};
export const ready = configStatus.urlReady && configStatus.keyReady;
export const db = ready ? createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
