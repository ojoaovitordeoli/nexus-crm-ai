import test from 'node:test';
import assert from 'node:assert/strict';
import {mapaFaltas, fraseAgenda} from '../lib/agenda-faltas.mjs';

const AGORA = new Date(2026, 10, 21, 14, 0).getTime(); // sábado
// segundas 16/11, 09/11, 02/11 de manhã; quartas à tarde
const em = (dia, h) => new Date(2026, 10, dia, h, 0).toISOString();

test('V62 mapa: faltas por dia e período e a pior faixa', () => {
  const ap = [
    {start_at: em(16, 9), status: 'no_show'}, {start_at: em(9, 9), status: 'no_show'}, {start_at: em(2, 10), status: 'completed'},
    {start_at: em(18, 14), status: 'completed'}, {start_at: em(11, 15), status: 'completed'}, {start_at: em(4, 15), status: 'completed'},
    {start_at: em(18, 15), status: 'scheduled'}, {start_at: em(19, 9), status: 'cancelled'}, {start_at: em(25, 9), status: 'no_show'}
  ];
  const m = mapaFaltas(ap, {agora: AGORA});
  assert.equal(m.total, 6); assert.equal(m.faltas, 2); assert.equal(m.pct, 33);
  assert.deepEqual(m.linhas.map(l => l.dia), ['seg', 'qua']);
  assert.deepEqual(m.pior, {dia: 'seg', periodo: 'manhã', pct: 67, total: 3, faltas: 2});
  assert.equal(m.frase, '33% de faltas nos últimos 90 dias (2 faltas em 6 atendimentos). A pior faixa é seg de manhã: 67%. Confirme esses horários na véspera.');
});

test('V62 mapa: sem base mínima não conclui', () => {
  const m = mapaFaltas([{start_at: em(16, 9), status: 'no_show'}], {agora: AGORA});
  assert.equal(m.frase, null); assert.equal(m.pct, 100);
  assert.equal(mapaFaltas([], {agora: AGORA}).pct, null);
});

test('V62 frase da agenda', () => {
  assert.equal(fraseAgenda({hoje: 3, aguardando: 2, mapa: {pct: 20, total: 10, dias: 90}}), '3 atendimentos hoje · 2 sem presença marcada · 20% de faltas em 90 dias.');
  assert.equal(fraseAgenda({}), 'Nenhum atendimento hoje.');
});
