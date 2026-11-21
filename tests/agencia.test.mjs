import test from 'node:test';
import assert from 'node:assert/strict';
import {empresasPermitidas, avaliarEmpresa, resumoAgencia} from '../lib/agencia.mjs';

const orgs = [{id: 'a', name: 'Ótica A', status: 'active'}, {id: 'b', name: 'Clínica B', status: 'active'}, {id: 'c', name: 'Inativa', status: 'inactive'}, {id: 'd', name: 'Outra', status: 'active'}];

test('V63 segurança: só empresas com vínculo ativo de gestão; super admin vê as ativas', () => {
  const membros = [
    {organization_id: 'a', role: 'MANAGER', status: 'active'},
    {organization_id: 'b', role: 'SELLER', status: 'active'},       // vendedor não tem visão da agência
    {organization_id: 'c', role: 'AGENCY_ADMIN', status: 'active'}, // empresa inativa
    {organization_id: 'd', role: 'ORGANIZATION_ADMIN', status: 'invited'} // vínculo não ativo
  ];
  assert.deepEqual(empresasPermitidas({membros, orgs}).map(o => o.id), ['a']);
  assert.deepEqual(empresasPermitidas({isSuperAdmin: true, orgs}).map(o => o.id), ['a', 'b', 'd']);
  assert.deepEqual(empresasPermitidas({membros: [], orgs}), []);
});

test('V63 avaliação: meta atrasada, tarefas, presenças, faltas e parados', () => {
  const agora = new Date(2026, 10, 21, 12).getTime(); // dia 21 de 30 → 70%
  const r = avaliarEmpresa({faturamentoMes: 3000, meta: 10000, tarefasVencidas: 6, semPresenca: 2, faltas30: 3, compareceram30: 7, parados: 4, leadsAbertos: 10, leadsNovos30: 8}, {agora});
  assert.equal(r.pctMeta, 30); assert.equal(r.esperado, 70); assert.equal(r.projecao, 4286);
  assert.equal(r.situacao, 'alerta');
  assert.deepEqual(r.alertas.map(a => a.txt), ['Meta em 30%, o mês em 70%', '6 tarefas vencidas', '30% de faltas em 30 dias', '2 presenças por marcar', '4 leads parados há 7+ dias']);
  const ok = avaliarEmpresa({faturamentoMes: 8000, meta: 10000, leadsNovos30: 5, leadsAbertos: 5}, {agora});
  assert.equal(ok.situacao, 'bom'); assert.equal(ok.pctFaltas, null);
});

test('V63 resumo: mais urgente primeiro e frase que conclui', () => {
  const agora = new Date(2026, 10, 21, 12).getTime();
  const r = resumoAgencia([
    {id: 'a', nome: 'Ótica A', metricas: {faturamentoMes: 8000, meta: 10000, leadsNovos30: 5, leadsAbertos: 5}},
    {id: 'b', nome: 'Clínica B', metricas: {faturamentoMes: 1000, meta: 10000, tarefasVencidas: 3, leadsNovos30: 2, leadsAbertos: 4}},
    {id: 'c', nome: 'Loja C', metricas: {semPresenca: 1, leadsNovos30: 1, leadsAbertos: 1}}
  ], {agora});
  assert.deepEqual(r.linhas.map(l => l.id), ['b', 'c', 'a']);
  assert.equal(r.frase, '1 empresa pede ação hoje, 1 merece atenção de 3 com movimento.');
  assert.equal(r.faturamentoTotal, 9000);
  assert.equal(resumoAgencia([{id: 'a', nome: 'A', metricas: {leadsNovos30: 1}}], {agora}).frase, 'A empresa está em dia.');
  // V65: empresa sem nenhum movimento não "merece atenção"
  const vazia = resumoAgencia([{id: 'v', nome: 'Vazia', metricas: {}}], {agora});
  assert.equal(vazia.linhas[0].aval.situacao, 'vazia'); assert.deepEqual(vazia.linhas[0].aval.alertas, []);
});
