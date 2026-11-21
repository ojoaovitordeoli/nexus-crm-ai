import test from 'node:test';
import assert from 'node:assert/strict';
import {dataCurta, lerData} from '../lib/formato.mjs';

const agora = new Date(2026, 10, 21, 12);

test('V57 dataCurta: ano atual sem ano, outro ano com ano', () => {
  assert.equal(dataCurta('2026-11-19T15:00:00Z', {agora}), '19 de nov.');
  assert.equal(dataCurta('2025-03-02T15:00:00Z', {agora}), '2 de mar. de 2025');
});

test('V57 dataCurta: data de calendário não volta um dia no fuso', () => {
  assert.equal(dataCurta('2026-11-21', {agora}), '21 de nov.');
  assert.equal(lerData('2026-11-21').getDate(), 21);
});

test('V57 dataCurta: vazio e inválido', () => {
  assert.equal(dataCurta('', {agora}), '—');
  assert.equal(dataCurta('xx', {agora, vazio: 'Sem data'}), 'Sem data');
});
