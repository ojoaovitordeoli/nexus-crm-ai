import test from 'node:test';
import assert from 'node:assert/strict';
import { saleExtras, monthRange, parseGoalTarget, goalProgress, paymentLabel } from '../lib/sale-rules.mjs';

const NOW = Date.parse('2026-11-15T15:00:00Z');

test('extras: só as chaves enviadas, limpas', () => {
  assert.deepEqual(saleExtras({}, NOW).value, {});
  const r = saleExtras({ payment_method: 'pix', product: '  Óculos   multifocal ', notes: ' obs ' }, NOW).value;
  assert.deepEqual(r, { payment_method: 'pix', product: 'Óculos multifocal', notes: 'obs' });
  assert.equal(saleExtras({ payment_method: '' }, NOW).value.payment_method, null);
  assert.equal(paymentLabel('credit'), 'Cartão de crédito');
});

test('extras: rejeita forma de pagamento e datas inválidas', () => {
  assert.match(saleExtras({ payment_method: 'bitcoin' }, NOW).error, /pagamento/);
  assert.match(saleExtras({ sale_date: '2026-02-30' }, NOW).error, /inválida/);
  assert.match(saleExtras({ sale_date: '15/11/2026' }, NOW).error, /inválida/);
  assert.match(saleExtras({ sale_date: '2026-12-25' }, NOW).error, /futuro/);
  assert.equal(saleExtras({ sale_date: '2026-11-10' }, NOW).value.sale_date, '2026-11-10T15:00:00.000Z');
});

test('mês: limites em horário de Brasília', () => {
  const r = monthRange(undefined, Date.parse('2026-12-01T02:00:00Z')); // ainda 30/11 em Brasília
  assert.equal(r.key, '2026-11');
  assert.equal(r.end, '2026-11-30');
  assert.equal(r.fromIso, '2026-11-01T03:00:00.000Z');
  assert.equal(r.toIso, '2026-12-01T03:00:00.000Z');
  assert.equal(monthRange('2026-02').end, '2026-02-28');
  assert.equal(monthRange('2026-13'), null);
});

test('meta: valor e progresso com ritmo', () => {
  assert.equal(parseGoalTarget('50000'), 50000);
  assert.equal(parseGoalTarget(0), null);
  assert.equal(parseGoalTarget('abc'), null);
  const range = monthRange('2026-11');
  const mid = Date.parse('2026-11-16T03:00:00Z'); // metade do mês
  const behind = goalProgress({ target: 10000, achieved: 2000, range, now: mid });
  assert.equal(behind.pct, 20);
  assert.equal(behind.expected, 50);
  assert.equal(behind.status, 'behind');
  assert.equal(behind.remaining, 8000);
  assert.equal(goalProgress({ target: 10000, achieved: 5000, range, now: mid }).status, 'on_track');
  assert.equal(goalProgress({ target: 10000, achieved: 12000, range, now: mid }).status, 'done');
  assert.equal(goalProgress({ target: 0, achieved: 1, range }), null);
});
