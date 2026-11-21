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
<<<<<<< HEAD
=======

import { awaitingAttendance } from '../lib/appointment-view.mjs';
test('aguardando presença: só dias anteriores em aberto, mais recente primeiro', () => {
  const list = [
    { id: 'hoje', start_at: at(0, 8), status: 'scheduled' },
    { id: 'ontem', start_at: at(-1), status: 'scheduled' },
    { id: 'semana', start_at: at(-6), status: 'confirmed' },
    { id: 'feito', start_at: at(-2), status: 'completed' },
    { id: 'faltou', start_at: at(-3), status: 'no_show' },
    { id: 'cancelado', start_at: at(-4), status: 'cancelled' },
    { id: 'futuro', start_at: at(2), status: 'scheduled' },
    { id: 'semdata', status: 'scheduled' },
  ];
  assert.deepEqual(awaitingAttendance(list, NOW).map((a) => a.id), ['ontem', 'semana']);
  assert.deepEqual(awaitingAttendance([], NOW), []);
});
>>>>>>> c14506f8ff07f6809a7377df531cd71ef8e3abc9
