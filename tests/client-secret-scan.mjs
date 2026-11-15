// Varredura de segredos no que vai para o navegador (.next/static).
//
// Como usar (o CI faz assim): gerar o build com valores-isca nas variáveis de
// servidor e rodar este script. Se qualquer isca aparecer no bundle do cliente,
// algum código de servidor vazou para o navegador e o teste falha.
//
//   SUPABASE_SERVICE_ROLE_KEY=ISCA_SERVICE_ROLE_9f3c ... npm run build
//   node tests/client-secret-scan.mjs
//
// Também falha se achar, em qualquer arquivo do cliente:
//   - JWT do Supabase com papel "service_role"
//   - chaves com cara de OpenAI (sk-...), Anthropic (sk-ant-...) ou Meta (EAA...)
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Variáveis que só podem existir no servidor (ver .env.example).
export const SERVER_SECRETS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'META_APP_SECRET',
  'META_WEBHOOK_VERIFY_TOKEN',
  'ANTHROPIC_API_KEY',
  'ASSISTANT_API_KEY',
  'OPENAI_API_KEY',
];

const PATTERNS = [
  { name: 'chave OpenAI', rx: /\bsk-(?!ant-)[A-Za-z0-9_-]{32,}/ },
  { name: 'chave Anthropic', rx: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'token da Meta', rx: /\bEAA[A-Za-z0-9]{60,}/ },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(js|mjs|css|html|json|txt|map)$/.test(name)) yield p;
  }
}

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.role;
  } catch {
    return null;
  }
}

export function scanText(text, secrets = {}) {
  const found = [];
  for (const [env, value] of Object.entries(secrets)) {
    if (value && value.length >= 8 && text.includes(value)) found.push(`valor de ${env}`);
  }
  for (const { name, rx } of PATTERNS) if (rx.test(text)) found.push(name);
  for (const jwt of text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || []) {
    if (jwtRole(jwt) === 'service_role') found.push('JWT service_role do Supabase');
  }
  return found;
}

function main() {
  const root = join(process.cwd(), '.next', 'static');
  if (!existsSync(root)) {
    console.error('Sem .next/static: rode "npm run build" antes.');
    process.exit(2);
  }
  const secrets = Object.fromEntries(SERVER_SECRETS.map((k) => [k, process.env[k]]));
  const iscas = Object.values(secrets).filter(Boolean).length;
  let arquivos = 0;
  const problemas = [];
  for (const file of walk(root)) {
    arquivos += 1;
    for (const f of scanText(readFileSync(file, 'utf8'), secrets)) problemas.push(`${f} em ${file}`);
  }
  if (problemas.length) {
    console.error(`VAZAMENTO: ${problemas.length} ocorrência(s) no bundle do navegador:`);
    for (const p of problemas) console.error(' - ' + p);
    process.exit(1);
  }
  console.log(`OK: ${arquivos} arquivos do navegador sem segredo (${iscas} iscas conferidas).`);
  if (!iscas) console.log('Aviso: nenhuma isca definida; só os padrões de chave foram conferidos.');
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('client-secret-scan.mjs')) main();
