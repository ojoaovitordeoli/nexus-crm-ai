import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// leads tem DUAS chaves para contacts (contact_id e referred_by_contact_id, V36).
// Embutir "contacts(...)" a partir de leads sem dizer a chave quebra a consulta inteira
// ("more than one relationship was found") e a lista de leads some em produção.
const files = [];
const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); statSync(p).isDirectory() ? walk(p) : /\.(m?js|jsx)$/.test(f) && files.push(p); } };
['app', 'components', 'lib'].forEach(walk);

test('consultas de leads indicam a chave do contato', () => {
  const bad = [];
  for (const f of files) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const isLeads = /from\('leads'\)|withOrg\('leads'/.test(line);
      if (isLeads && /contacts\(/.test(line) && !/contacts!leads_(contact_id|referred_by_contact_id)_fkey\(/.test(line)) bad.push(f + ':' + (i + 1));
    });
  }
  // O GET da operação monta o select numa lista; confere a linha dos leads também.
  const op = readFileSync('app/api/operation/route.js', 'utf8');
  const leadsFields = op.split('\n').find((l) => l.includes("'id,organization_id,source,status,temperature"));
  if (leadsFields && !leadsFields.includes('contacts!leads_contact_id_fkey(')) bad.push('app/api/operation/route.js (campos de leads do GET)');
  assert.deepEqual(bad, [], 'Consulta de leads com contacts(...) ambíguo: ' + bad.join(', '));
});
