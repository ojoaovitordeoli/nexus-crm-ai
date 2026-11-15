import test from 'node:test';
import assert from 'node:assert/strict';
import { needsAttendance, confirmationLink } from '../lib/appointment-view.mjs';

const NOW = new Date(2026, 10, 15, 10, 0).getTime();
const at = (days, h = 9) => new Date(2026, 10, 15 + days, h, 0).toISOString();

test('presença: hoje ou passado e ainda em aberto', () => {
  assert.equal(needsAttendance({ start_at: at(0, 18), status: 'scheduled' }, NOW), true);
  assert.equal(needsAttendance({ start_at: at(-2), status: 'confirmed' }, NOW), true);
  assert.equal(needsAttendance({ start_at: at(-2) }, NOW), true);
});

test('presença: futuro, já resolvido ou sem data não pede', () => {
  assert.equal(needsAttendance({ start_at: at(1), status: 'scheduled' }, NOW), false);
  assert.equal(needsAttendance({ start_at: at(-1), status: 'completed' }, NOW), false);
  assert.equal(needsAttendance({ start_at: at(-1), status: 'no_show' }, NOW), false);
  assert.equal(needsAttendance({ start_at: at(-1), status: 'cancelled' }, NOW), false);
  assert.equal(needsAttendance({ status: 'scheduled' }, NOW), false);
});

test('confirmação: monta link com nome, data e hora', () => {
  const url = confirmationLink({ start_at: at(1, 14), status: 'scheduled' }, { first_name: 'Ana', whatsapp: '(48) 99999-1111' });
  assert.ok(url.startsWith('https://wa.me/5548999991111?text='));
  const text = decodeURIComponent(url.split('?text=')[1]);
  assert.match(text, /^Olá, Ana! Passando para confirmar seu horário de /);
  assert.match(text, /14:00\. Podemos confirmar\?$/);
});

test('confirmação: sem telefone, sem data ou já resolvido não gera link', () => {
  assert.equal(confirmationLink({ start_at: at(1), status: 'scheduled' }, { first_name: 'Ana' }), '');
  assert.equal(confirmationLink({ status: 'scheduled' }, { whatsapp: '48999991111' }), '');
  assert.equal(confirmationLink({ start_at: at(1), status: 'completed' }, { whatsapp: '48999991111' }), '');
});
