import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProposal, catalogItems, escapeHtml, normalizeManualItems, proposalHtml, proposalNote, proposalText, MAX_ITEMS } from '../lib/proposal.mjs';

const NOW = Date.parse('2026-11-15T15:00:00Z');
const lead = { id: 'c8b1b747-0e46-4c32-80a1-938afde9ae66' };
const contact = { first_name: 'Ana', last_name: 'Souza', whatsapp: '5548999991111', email: 'ana@example.invalid', city: 'Laguna' };

test('itens do catálogo: só produtos da lista da empresa, com preço e unidade', () => {
  const items = catalogItems(
    [{ product_id: 'p1', quantity: 2 }, { product_id: 'x', quantity: 1 }],
    [{ id: 'p1', name: 'Lente multifocal', price: 890.5, unit: 'par' }],
  );
  assert.deepEqual(items, [{ name: 'Lente multifocal', quantity: 2, unit: 'par', unitPrice: 890.5 }]);
});

test('itens digitados: valida quantidade, valor e limite', () => {
  assert.deepEqual(normalizeManualItems([{ name: ' Armação ', quantity: 1, unit_price: '450' }, { name: '' }]).items,
    [{ name: 'Armação', quantity: 1, unit: null, unitPrice: 450 }]);
  assert.match(normalizeManualItems([{ name: 'X', quantity: 0, unit_price: 1 }]).error, /quantidade inválida/);
  assert.match(normalizeManualItems([{ name: 'X', quantity: 1, unit_price: -1 }]).error, /valor inválido/);
  assert.match(normalizeManualItems(Array.from({ length: MAX_ITEMS + 1 }, () => ({ name: 'a', unit_price: 1 }))).error, /no máximo/);
});

test('proposta soma os itens, numera e limita a validade', () => {
  const { proposal: p } = buildProposal({
    organizationName: 'Ótica Visão', sellerName: 'Carla', lead, contact,
    items: [{ name: 'Lente', quantity: 2, unit: 'par', unitPrice: 890.5 }, { name: 'Armação', quantity: 1, unit: null, unitPrice: 450 }],
    validityDays: 500, conditions: 'Até 10x sem juros', now: NOW,
  });
  assert.equal(p.total, 2231);
  assert.equal(p.items[0].total, 1781);
  assert.equal(p.number, 'P-20261115-C8B1B7');
  assert.equal(p.validityDays, 90);
  assert.equal(p.client.name, 'Ana Souza');
});

test('sem item usa o valor do lead; sem nada, recusa (não inventa)', () => {
  assert.equal(buildProposal({ lead, contact, estimatedValue: 1200, now: NOW }).proposal.items[0].name, 'Proposta comercial');
  assert.match(buildProposal({ lead, contact, now: NOW }).error, /Adicione ao menos um item/);
});

test('texto do WhatsApp e nota do histórico', () => {
  const { proposal: p } = buildProposal({ organizationName: 'Ótica Visão', lead, contact, items: [{ name: 'Lente', quantity: 1, unit: 'par', unitPrice: 890 }], validityDays: 7, now: NOW });
  const txt = proposalText(p);
  assert.match(txt, /\*Proposta P-20261115-C8B1B7\* — Ótica Visão/);
  assert.match(txt, /Lente: 1 par × R\$\s?890,00 = R\$\s?890,00/);
  assert.match(txt, /Válida até 22\/11\/2026/);
  assert.match(proposalNote(p), /^Proposta P-20261115-C8B1B7 gerada: R\$\s?890,00 \(1 item\), válida até 22\/11\/2026\.$/);
});

test('página de impressão escapa tudo o que vem do usuário (sem injeção de código)', () => {
  assert.equal(escapeHtml(`<img src=x onerror="alert(1)">'&`), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;&#39;&amp;');
  const { proposal: p } = buildProposal({
    organizationName: '<b>Ótica</b>', lead, contact: { first_name: '<script>alert(1)</script>' },
    items: [{ name: '<img src=x onerror=alert(2)>', quantity: 1, unit: null, unitPrice: 10 }],
    notes: '</div><script>alert(3)</script>', now: NOW,
  });
  const html = proposalHtml(p);
  assert.equal(/<script>alert/.test(html), false);
  assert.equal(/<img src=x/.test(html), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});
