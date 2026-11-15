import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from './client-secret-scan.mjs';

const jwt = (role) =>
  ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role, ref: 'x' })).toString('base64url'), 'assinaturaFalsa123456'].join('.');

test('isca de variável de servidor no bundle é detectada', () => {
  const achados = scanText('var a="ISCA_SERVICE_ROLE_9f3c";', { SUPABASE_SERVICE_ROLE_KEY: 'ISCA_SERVICE_ROLE_9f3c' });
  assert.deepEqual(achados, ['valor de SUPABASE_SERVICE_ROLE_KEY']);
});

test('JWT service_role é vazamento; JWT anon (chave pública) não é', () => {
  assert.deepEqual(scanText(`k="${jwt('service_role')}"`), ['JWT service_role do Supabase']);
  assert.deepEqual(scanText(`k="${jwt('anon')}"`), []);
});

test('padrões de chave OpenAI, Anthropic e Meta são detectados', () => {
  assert.ok(scanText('sk-' + 'a'.repeat(40)).includes('chave OpenAI'));
  assert.ok(scanText('sk-ant-' + 'b'.repeat(30)).includes('chave Anthropic'));
  assert.ok(scanText('EAA' + 'C'.repeat(70)).includes('token da Meta'));
});

test('texto comum do app não acusa vazamento', () => {
  assert.deepEqual(scanText('const titulo="Leads"; fetch("/api/operation")'), []);
});
