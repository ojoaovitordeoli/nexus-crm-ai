import test from 'node:test';
import assert from 'node:assert/strict';
import { aceSummary } from '../lib/ace.mjs';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

const data = {
  leads: [
    { id: 'l1', created_at: ago(2), source: 'Instagram' },
    { id: 'l2', created_at: ago(3), source: 'Instagram' },
    { id: 'l3', created_at: ago(5), source: 'Indicação', referred_by_contact_id: 'c9' },
    { id: 'l4', created_at: ago(10), source: '' },
    { id: 'old', created_at: ago(60), source: 'Google' }, // fora de 30 dias
  ],
  appointments: [
    { lead_id: 'l1', status: 'completed' },
    { lead_id: 'l2', status: 'no_show' },
    { lead_id: 'l3', status: 'cancelled' }, // cancelado não conta como agendado
    { lead_id: 'l4', status: 'scheduled' },
    { lead_id: 'l4', status: 'completed' }, // remarcou e veio: compareceu
    { lead_id: 'old', status: 'completed' }, // fora da coorte
    { lead_id: null, status: 'completed' },
  ],
  sales: [
    { lead_id: 'l1', contact_id: 'c1', value: 1000, sale_date: ago(1) },
    { lead_id: 'l4', contact_id: 'c4', value: '500', sale_date: ago(4) },
    { lead_id: null, contact_id: 'c1', value: 300, sale_date: ago(0) }, // recompra no período
    { lead_id: null, contact_id: 'c7', value: 200, sale_date: ago(90) },
    { lead_id: null, contact_id: 'c7', value: 250, sale_date: ago(80) }, // recompra fora do período
  ],
};

test('atração: leads do período por origem, com "Não informada" e indicação', () => {
  const r = aceSummary(data, 30, NOW).attraction;
  assert.equal(r.leads, 4);
  assert.equal(r.referred, 1);
  assert.deepEqual(r.sources.map((s) => [s.name, s.count, s.share]), [
    ['Instagram', 2, 50],
    ['Indicação', 1, 25],
    ['Não informada', 1, 25],
  ]);
});

test('conversão: agendou, compareceu, faltou e comprou contam por lead da coorte', () => {
  const c = aceSummary(data, 30, NOW).conversion;
  assert.deepEqual(
    { scheduled: c.scheduled, attended: c.attended, noShow: c.noShow, sold: c.sold, revenue: c.revenue },
    { scheduled: 3, attended: 2, noShow: 1, sold: 2, revenue: 1500 },
  );
  assert.equal(c.scheduleRate, 75);
  assert.equal(c.attendanceRate, 66.7);
  assert.equal(c.noShowRate, 33.3);
  assert.equal(c.saleRate, 50);
});

test('expansão: recompra só conta quando a nova compra cai no período', () => {
  const e = aceSummary(data, 30, NOW).expansion;
  assert.equal(e.customers, 2); // c1 e c4 compraram no período
  assert.equal(e.repeatCustomers, 1); // c1 comprou de novo; c7 recomprou fora do período
  assert.equal(e.repeatRevenue, 300);
  assert.equal(e.repeatRate, 50);
  assert.equal(e.referredShare, 25);
});

test('sem dados: tudo zero e taxas nulas (sem divisão por zero)', () => {
  const r = aceSummary({}, 30, NOW);
  assert.equal(r.attraction.leads, 0);
  assert.equal(r.conversion.scheduleRate, null);
  assert.equal(r.expansion.repeatRate, null);
});
