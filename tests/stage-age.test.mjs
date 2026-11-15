import test from 'node:test';
import assert from 'node:assert/strict';
import { stageAge } from '../lib/lead-view.mjs';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

test('usa stage_changed_at quando existe', () => {
  const r = stageAge({ stage_changed_at: ago(4), created_at: ago(20) }, NOW);
  assert.equal(r.days, 4);
  assert.equal(r.level, 'warn');
  assert.equal(r.text, '4 dias nesta etapa');
  assert.equal(r.short, '4d');
});

test('cai para created_at sem stage_changed_at', () => {
  const r = stageAge({ created_at: ago(1) }, NOW);
  assert.equal(r.days, 1);
  assert.equal(r.text, '1 dia nesta etapa');
  assert.equal(r.level, 'ok');
});

test('hoje, atrasado e limites', () => {
  assert.equal(stageAge({ stage_changed_at: ago(0.2) }, NOW).text, 'Hoje nesta etapa');
  assert.equal(stageAge({ stage_changed_at: ago(2.9) }, NOW).level, 'ok');
  assert.equal(stageAge({ stage_changed_at: ago(3) }, NOW).level, 'warn');
  assert.equal(stageAge({ stage_changed_at: ago(7) }, NOW).level, 'late');
});

test('data ausente, inválida ou futura não mostra nada', () => {
  assert.equal(stageAge({}, NOW), null);
  assert.equal(stageAge(null, NOW), null);
  assert.equal(stageAge({ stage_changed_at: 'x' }, NOW), null);
  assert.equal(stageAge({ stage_changed_at: ago(-2) }, NOW), null);
});
