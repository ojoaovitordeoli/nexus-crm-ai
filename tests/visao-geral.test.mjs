import test from 'node:test';
import assert from 'node:assert/strict';
import {comparar, textoVariacao, porSemana, avisos} from '../lib/visao-geral.mjs';

const AGORA = Date.parse('2026-11-21T15:00:00Z');
const diasAtras = d => new Date(AGORA - d * 86400000).toISOString();

test('V56 comparar: janela atual x anterior e variação', () => {
  const vendas = [{created_at: diasAtras(2), value: 100}, {created_at: diasAtras(10), value: 100}, {created_at: diasAtras(40), value: 100}];
  const c = comparar(vendas, {campo: 'created_at', agora: AGORA});
  assert.deepEqual([c.atual, c.anterior, c.variacao], [2, 1, 100]);
  assert.equal(textoVariacao(c), '▲ 100% vs. 30 dias antes');
  const r = comparar(vendas, {campo: 'created_at', agora: AGORA, valor: s => s.value});
  assert.equal(r.atual, 200);
});

test('V56 comparar: amostra incompleta não mostra seta', () => {
  const lista = [{created_at: diasAtras(1)}, {created_at: diasAtras(5)}];
  const c = comparar(lista, {campo: 'created_at', agora: AGORA, incompleta: true});
  assert.equal(c.semBase, true);
  assert.equal(textoVariacao(c), null);
  // sem nada antes → não inventa porcentagem
  assert.equal(textoVariacao(comparar(lista, {campo: 'created_at', agora: AGORA})), null, 'sem nada antes não vira porcentagem nem frase');
  assert.equal(textoVariacao(comparar([], {campo: 'created_at', agora: AGORA})), null);
});

test('V56 porSemana: 8 semanas, leads e vendas na semana certa', () => {
  const s = porSemana({leads: [{created_at: diasAtras(0)}, {created_at: diasAtras(1)}, {created_at: diasAtras(60)}],
    sales: [{sale_date: '2026-11-17', created_at: diasAtras(30), value: 50}]}, {agora: AGORA});
  assert.equal(s.length, 8);
  assert.equal(s.at(-1).rotulo, '16/11');
  assert.equal(s.at(-1).leads, 2);
  assert.equal(s.at(-1).vendas, 1, 'usa sale_date antes de created_at');
  assert.equal(s.at(-1).receita, 50);
  assert.equal(s.reduce((n, x) => n + x.leads, 0), 2, 'fora da janela não entra');
  assert.ok(s.every((x, i) => i === 0 || x.ordem > s[i - 1].ordem));
});

test('V56 avisos: vencidas, presença pendente e leads parados, em ordem', () => {
  const r = avisos({
    tasks: [{status: 'pending', due_date: '2026-11-10'}, {status: 'pending', due_date: '2026-11-19'}, {status: 'completed', due_date: '2026-11-01'}],
    appointments: [{status: 'scheduled', start_at: diasAtras(2)}, {status: 'scheduled', start_at: diasAtras(-2)}],
    leads: [{created_at: diasAtras(20)}, {created_at: diasAtras(1)}, {created_at: diasAtras(30), pipeline_stage_id: 'ganho'}],
    stages: [{id: 'ganho', is_won: true}]
  }, {agora: AGORA});
  assert.deepEqual(r.map(a => a.id), ['vencidas', 'presenca', 'parados']);
  assert.equal(r[0].titulo, '2 tarefas vencidas');
  assert.match(r[0].texto, /há 11 dias/);
  assert.equal(r[1].titulo, '1 agendamento sem presença marcada');
  assert.equal(r[2].titulo, '1 lead parado há 7 dias ou mais');
  assert.ok(r.every(a => a.href && a.acao && !('peso' in a)));
});

test('V56 avisos: faltas e meta atrasada', () => {
  const ap = [...Array(4)].map((_, i) => ({status: 'completed', start_at: diasAtras(i + 1)}))
    .concat([{status: 'no_show', start_at: diasAtras(3)}, {status: 'no_show', start_at: diasAtras(4)}]);
  const goal = {target: 10000, achieved: 1000, from: '2026-11-01T03:00:00Z', to: '2026-12-01T03:00:00Z'};
  const r = avisos({appointments: ap, goal}, {agora: AGORA});
  assert.deepEqual(r.map(a => a.id), ['meta', 'faltas']);
  assert.match(r[0].titulo, /^Meta em 10%, o mês já está em 6\d%$/);
  assert.equal(r[1].titulo, '33% de faltas em 30 dias');
});

test('V56 avisos: nada pendente vira "Tudo em dia"; nunca mais de 3', () => {
  assert.deepEqual(avisos({}, {agora: AGORA}).map(a => a.id), ['em-dia']);
  const muitos = avisos({
    tasks: [{status: 'pending', due_date: '2026-11-01'}],
    appointments: [{status: 'confirmed', start_at: diasAtras(1)}],
    leads: [{created_at: diasAtras(9)}],
    goal: {target: 100, achieved: 200, from: '2026-11-01T03:00:00Z', to: '2026-12-01T03:00:00Z'}
  }, {agora: AGORA});
  assert.equal(muitos.length, 3);
});
