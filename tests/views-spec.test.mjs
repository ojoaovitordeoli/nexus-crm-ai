import test from 'node:test';
import assert from 'node:assert/strict';
import {validarReceita, agrupar, totalizar, rotuloMes, descreverReceita, LIMITE_MAX} from '../lib/views/spec.mjs';

test('receita válida de quadro de leads vira etapa por padrão', () => {
  const r = validarReceita({tipo: 'quadro', fonte: 'leads'});
  assert.equal(r.ok, true);
  assert.equal(r.spec.agrupar_por, 'etapa');
  assert.equal(r.spec.filtros.somente_abertos, true);
});

test('fonte fora da lista é recusada', () => {
  assert.equal(validarReceita({tipo: 'lista', fonte: 'profiles'}).ok, false);
  assert.equal(validarReceita({tipo: 'lista', fonte: 'organizations'}).ok, false);
  assert.equal(validarReceita(null).ok, false);
  assert.equal(validarReceita([]).ok, false);
});

test('campo de agrupamento fora da lista é recusado (não vira consulta livre)', () => {
  const r = validarReceita({tipo: 'grafico', fonte: 'leads', agrupar_por: 'organization_id'});
  assert.equal(r.ok, false);
  assert.match(r.erro, /Opções/);
});

test('quadro de vendas vira gráfico (quadro de etapas só existe para leads)', () => {
  const r = validarReceita({tipo: 'quadro', fonte: 'vendas'});
  assert.equal(r.spec.tipo, 'grafico');
  assert.equal(r.spec.agrupar_por, 'vendedor');
});

test('limites e textos são aparados; caracteres de controle e <> saem do título', () => {
  const r = validarReceita({tipo: 'lista', fonte: 'contatos', limite: 9999, titulo: '<script>x</script>' + 'a'.repeat(200)});
  assert.equal(r.spec.limite, LIMITE_MAX);
  assert.equal(r.spec.titulo.includes('<'), false);
  assert.ok(r.spec.titulo.length <= 80);
  assert.equal(validarReceita({tipo: 'lista', fonte: 'leads', filtros: {periodo_dias: -5}}).spec.filtros.periodo_dias, 1);
});

test('temperatura em português vira o código do banco; valor estranho é recusado', () => {
  assert.equal(validarReceita({fonte: 'leads', filtros: {temperatura: 'Quente'}}).spec.filtros.temperatura, 'hot');
  assert.equal(validarReceita({fonte: 'leads', filtros: {temperatura: 'fervendo'}}).ok, false);
});

test('filtros que não pertencem à fonte são ignorados', () => {
  const r = validarReceita({fonte: 'tarefas', filtros: {temperatura: 'quente', etapa: 'x', situacao: 'vencidas'}});
  assert.deepEqual(r.spec.filtros, {situacao: 'vencidas'});
});

test('número de vendas por valor', () => {
  const r = validarReceita({tipo: 'numero', fonte: 'vendas', medida: 'valor', agrupar_por: 'mes'});
  assert.equal(r.spec.agrupar_por, null);
  assert.equal(r.spec.medida, 'valor');
  const t = totalizar([{valor: 10.1}, {valor: 20.2}], r.spec);
  assert.equal(t.principal, 30.3);
});

test('agrupar soma, conta e ordena etapas pela posição do funil', () => {
  const spec = validarReceita({tipo: 'quadro', fonte: 'leads'}).spec;
  const g = agrupar([
    {grupo: 'Proposta', ordem: 2, valor: 100, item: {id: 'a'}},
    {grupo: 'Novo', ordem: 0, valor: 50, item: {id: 'b'}},
    {grupo: 'Proposta', ordem: 2, valor: 25, item: {id: 'c'}}
  ], spec);
  assert.deepEqual(g.map(x => x.grupo), ['Novo', 'Proposta']);
  assert.equal(g[1].quantidade, 2);
  assert.equal(g[1].valor, 125);
  assert.equal(g[1].itens.length, 2);
});

test('gráfico por origem ordena do maior para o menor', () => {
  const spec = validarReceita({tipo: 'grafico', fonte: 'leads', agrupar_por: 'origem', medida: 'valor'}).spec;
  const g = agrupar([{grupo: 'Instagram', valor: 10}, {grupo: 'Google', valor: 90}], spec);
  assert.equal(g[0].grupo, 'Google');
});

test('mês no fuso de São Paulo e descrição legível', () => {
  assert.equal(rotuloMes('2026-12-01T02:00:00Z'), 'nov/26');
  assert.equal(rotuloMes(null), 'Sem data');
  const spec = validarReceita({fonte: 'leads', tipo: 'grafico', agrupar_por: 'origem', filtros: {periodo_dias: 30, temperatura: 'quente'}}).spec;
  assert.match(descreverReceita(spec), /últimos 30 dias/);
  assert.match(descreverReceita(spec), /quentes/);
});

test('V55: agendamentos, estilo do gráfico e agrupar por semana', async () => {
  const {semanaDe, diaDaSemana} = await import('../lib/views/spec.mjs');
  const a = validarReceita({tipo: 'grafico', fonte: 'agendamentos', agrupar_por: 'dia_semana', estilo: 'linha', filtros: {situacao: 'faltaram', proximos_dias: 7}});
  assert.equal(a.ok, true);
  assert.equal(a.spec.estilo, 'linha');
  assert.deepEqual(a.spec.filtros, {situacao: 'faltaram', proximos_dias: 7});
  assert.equal(validarReceita({tipo: 'grafico', fonte: 'leads', agrupar_por: 'origem', estilo: 'linha'}).spec.estilo, 'barras', 'linha só no tempo');
  assert.equal(validarReceita({tipo: 'grafico', fonte: 'leads', estilo: 'pizza'}).spec.estilo, 'pizza');
  assert.equal(validarReceita({tipo: 'lista', fonte: 'leads', estilo: 'pizza'}).spec.estilo, undefined);
  assert.equal(validarReceita({tipo: 'grafico', fonte: 'agendamentos', filtros: {situacao: 'abertas'}}).spec.filtros.situacao, undefined, 'situação de tarefa não vale em agendamento');
  assert.equal(semanaDe('2026-11-20T15:00:00Z').rotulo, 'sem 16/11');
  assert.equal(diaDaSemana('2026-11-20T15:00:00Z').rotulo, 'sex');
});
