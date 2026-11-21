import test from 'node:test';
import assert from 'node:assert/strict';
import {reguaDoDia, filaAgora, mesMeta, funilJanela, origemVenda, manchete, whatsLink} from '../lib/hoje.mjs';

const AGORA = new Date(2026, 10, 21, 14, 20).getTime(); // sábado 21/11 14:20 (hora local)
const h = (hh, mm = 0, dia = 21) => new Date(2026, 10, dia, hh, mm).toISOString();
const diasAtras = d => new Date(AGORA - d * 86400000).toISOString();

test('V60 régua: só hoje, sem cancelados, situação e faixas', () => {
  const r = reguaDoDia([
    {id: 1, start_at: h(8, 10), status: 'completed'},
    {id: 2, start_at: h(9, 40), status: 'no_show'},
    {id: 3, start_at: h(12, 30), status: 'scheduled'},
    {id: 4, start_at: h(15), status: 'confirmed'},
    {id: 5, start_at: h(15, 10), status: 'scheduled'},
    {id: 6, start_at: h(16), status: 'cancelled'},
    {id: 7, start_at: h(10, 0, 20), status: 'scheduled'}
  ], {agora: AGORA});
  assert.deepEqual(r.itens.map(i => i.situacao), ['veio', 'faltou', 'marcar', 'vem', 'vem']);
  assert.deepEqual(r.contagem, {veio: 1, faltou: 1, marcar: 1, vem: 2});
  assert.notEqual(r.itens[3].faixa, r.itens[4].faixa, 'blocos que se cruzam vão para faixas diferentes');
  assert.ok(r.agoraPct > 50 && r.agoraPct < 70);
  assert.ok(r.itens.every(i => i.left >= 0 && i.left + i.width <= 100.001));
});

test('V60 fila: presença por marcar, tarefa vencida com WhatsApp, quentes e parados', () => {
  const leads = [
    {id: 'a', contact: {first_name: 'Marcos', last_name: 'T', whatsapp: '48999990000'}, created_at: diasAtras(20)},
    {id: 'b', temperature: 'hot', created_at: diasAtras(0.5), source: 'Instagram'},
    {id: 'c', created_at: diasAtras(10), estimated_value: 900}
  ];
  const f = filaAgora({
    appointments: [{id: 9, lead_id: 'a', title: 'Retirada', start_at: h(12, 30), end_at: h(13), status: 'scheduled'}],
    tasks: [{id: 't', title: 'Orçamento Helena', status: 'pending', due_date: '2026-11-19', lead_id: 'a'}, {id: 'x', status: 'completed', due_date: '2026-11-01'}],
    leads
  }, {agora: AGORA});
  assert.deepEqual(f.itens.map(i => i.tipo + ':' + i.id), ['presenca:ap:9', 'tarefa:tk:t', 'grupo:quentes', 'grupo:parados']);
  assert.match(f.itens[0].titulo, /^Marcos T: Retirada/);
  assert.equal(f.itens[1].whatsapp, 'https://wa.me/5548999990000');
  assert.match(f.itens[1].detalhe, /há 2 dias/);
  assert.match(f.itens[3].titulo, /^2 leads parados/);
});

test('V60 mês: acumulado, projeção pelo ritmo e quanto falta por dia', () => {
  const m = mesMeta({sales: [{sale_date: '2026-11-01', value: 1000}, {sale_date: '2026-11-21', value: 1100}, {sale_date: '2026-10-30', value: 999}], goal: {target: 3000}}, {agora: AGORA});
  assert.equal(m.diasMes, 30); assert.equal(m.hoje, 21);
  assert.equal(m.feito, 2100); assert.equal(m.acumulado.length, 21); assert.equal(m.acumulado[0], 1000);
  assert.equal(m.projecao, 3000);
  assert.equal(m.esperadoHoje, 2100); assert.equal(m.atras, 0);
  assert.equal(m.porDiaPrecisa, 100); assert.equal(m.vendas, 2);
  assert.equal(mesMeta({sales: []}, {agora: AGORA}).alvo, null);
});

test('V60 funil: só vínculos reais e a etapa que mais vaza', () => {
  const leads = [...Array(10)].map((_, i) => ({id: 'l' + i, created_at: diasAtras(3)}));
  leads.push({id: 'velho', created_at: diasAtras(60)});
  const ap = ['l0', 'l1', 'l2', 'l3', 'l4'].map((id, i) => ({lead_id: id, status: i < 4 ? 'completed' : 'scheduled'}));
  ap.push({lead_id: 'velho', status: 'completed'}, {lead_id: 'l9', status: 'cancelled'});
  const f = funilJanela({leads, appointments: ap, sales: [{lead_id: 'l0', value: 500}, {lead_id: 'l1', value: 300}, {lead_id: 'velho', value: 9}]}, {agora: AGORA});
  assert.deepEqual(f.etapas.map(e => e.n), [10, 5, 4, 2]);
  assert.deepEqual(f.etapas.slice(1).map(e => e.taxa), [50, 80, 50]);
  assert.equal(f.receita, 800);
  assert.equal(f.etapas[1].fraca, true, 'empate: a primeira etapa fraca com base mínima');
  assert.equal(f.nota.perdidos, 5);
});

test('V60 origem: conversão por origem e a frase só com base mínima', () => {
  const leads = [];
  for (let i = 0; i < 10; i++) leads.push({id: 'g' + i, source: 'Google', created_at: diasAtras(2)});
  for (let i = 0; i < 5; i++) leads.push({id: 'r' + i, source: 'Indicação', created_at: diasAtras(2)});
  const sales = [{lead_id: 'g0', value: 100}, {lead_id: 'r0', value: 400}, {lead_id: 'r1', value: 400}, {lead_id: 'r1', value: 50}];
  const o = origemVenda({leads, sales}, {agora: AGORA});
  assert.equal(o.linhas[0].origem, 'Indicação');
  assert.equal(o.linhas[0].conversao, 40); assert.equal(o.linhas[0].vendas, 3); assert.equal(o.linhas[0].receita, 850);
  assert.equal(o.linhas[1].conversao, 10);
  assert.equal(o.frase, 'Indicação converte 4 vezes mais que Google.');
  assert.equal(origemVenda({leads: leads.slice(0, 3), sales}, {agora: AGORA}).frase, null);
});

test('V60 manchete e WhatsApp', () => {
  assert.equal(manchete({mes: {alvo: 30000, feito: 18400, atras: 2600}, fila: {itens: [{tom: 'alerta'}, {tom: 'atencao'}, {tom: 'alerta'}, {tom: 'frio'}]}}).replace(/\s/g, ' '), 'Você está R$ 2.600 atrás da meta. Três coisas resolvem hoje.');
  assert.equal(manchete({mes: {alvo: null}, fila: {itens: []}}), 'Tudo em dia por aqui.');
  assert.equal(whatsLink('(48) 9 9999-0000'), 'https://wa.me/5548999990000');
  assert.equal(whatsLink('123'), '');
});
