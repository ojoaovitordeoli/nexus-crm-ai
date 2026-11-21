import test from 'node:test';
import assert from 'node:assert/strict';
import {resumoLeads, proximoPasso, marcas, vinculos} from '../lib/leads-hoje.mjs';

const AGORA = new Date(2026, 10, 21, 14, 0).getTime();
const atras = d => new Date(AGORA - d * 86400000).toISOString();
const stages = [{id: 's1'}, {id: 'won', is_won: true}];

test('V61 resumo: abertos, quentes, parados e sem próximo passo', () => {
  const leads = [
    {id: 'a', created_at: atras(1), temperature: 'hot'},
    {id: 'b', created_at: atras(20)},
    {id: 'c', created_at: atras(30), pipeline_stage_id: 'won'},
    {id: 'd', created_at: atras(10), stage_changed_at: atras(2)}
  ];
  const r = resumoLeads(leads, {stages, tasks: [{lead_id: 'd', status: 'pending', due_date: '2026-11-25'}], agora: AGORA});
  assert.deepEqual([r.abertos, r.quentes, r.parados, r.semRetorno], [3, 1, 1, 2]);
  assert.equal(r.frase, '3 leads abertos. 2 sem próximo passo marcado, 1 parado há 7 dias ou mais, 1 quente.');
  assert.equal(resumoLeads([], {agora: AGORA}).frase, 'Nenhum lead aberto.');
});

test('V61 próximo passo: presença > tarefa vencida > agenda futura > retorno > parado', () => {
  const lead = {id: 'x', created_at: atras(15)};
  const apPassado = {id: 'ap1', lead_id: 'x', title: 'Exame', start_at: atras(1), status: 'scheduled'};
  const tkVencida = {id: 't1', lead_id: 'x', title: 'Ligar', status: 'pending', due_date: '2026-11-18'};
  const apFuturo = {id: 'ap2', lead_id: 'x', title: 'Retirada', start_at: new Date(AGORA + 2 * 86400000).toISOString(), status: 'scheduled'};
  const tkFutura = {id: 't2', lead_id: 'x', title: 'Mandar orçamento', status: 'pending', due_date: '2026-11-24'};
  let p = proximoPasso(lead, {appointments: [apPassado, apFuturo], tasks: [tkVencida], agora: AGORA});
  assert.equal(p.acao, 'presenca'); assert.equal(p.appointmentId, 'ap1'); assert.equal(p.statusAntes, 'scheduled');
  p = proximoPasso(lead, {appointments: [apFuturo], tasks: [tkVencida], agora: AGORA});
  assert.equal(p.acao, 'tarefa'); assert.match(p.detalhe, /há 3 dias/);
  p = proximoPasso(lead, {appointments: [apFuturo], tasks: [tkFutura], agora: AGORA});
  assert.equal(p.acao, 'confirmar'); assert.equal(p.titulo, 'Agendado, confirme antes');
  p = proximoPasso(lead, {tasks: [tkFutura], agora: AGORA});
  assert.equal(p.titulo, 'Próximo retorno marcado'); assert.equal(p.acao, null);
  p = proximoPasso(lead, {agora: AGORA});
  assert.equal(p.titulo, 'Parado há 15 dias'); assert.equal(p.acao, 'retorno');
  p = proximoPasso({id: 'n', created_at: atras(1)}, {agora: AGORA});
  assert.equal(p.titulo, 'Sem próximo passo');
  p = proximoPasso({id: 'w', pipeline_stage_id: 'won'}, {stages, agora: AGORA});
  assert.equal(p.acao, null); assert.equal(p.titulo, 'Negócio encerrado');
});

test('V61 marcas: tarefa concluída e agendamento cancelado não contam como próximo passo', () => {
  const idx = vinculos({tasks: [{lead_id: 'a', status: 'completed'}], appointments: [{lead_id: 'a', status: 'cancelled', start_at: atras(-2)}]});
  assert.equal(marcas({id: 'a', created_at: atras(1)}, {idx, agora: AGORA}).semRetorno, true);
});
