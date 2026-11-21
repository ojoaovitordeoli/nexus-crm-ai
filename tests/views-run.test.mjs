import test from 'node:test';
import assert from 'node:assert/strict';
import {validarReceita} from '../lib/views/spec.mjs';
import {montarTela, resumoParaIA} from '../lib/views/run.mjs';

// Cliente falso do Supabase: grava cada consulta e devolve dados por tabela.
function fakeAdmin(dados) {
  const consultas = [];
  return {
    consultas,
    from(tabela) {
      const q = {tabela, filtros: []};
      consultas.push(q);
      const b = new Proxy({}, {
        get(_, metodo) {
          if (metodo === 'then') return (res, rej) => Promise.resolve({data: (dados[tabela] || []).filter(r => !r.__orgId || q.filtros.some(f => f[0] === 'eq' && f[1] === 'organization_id' && f[2] === r.__orgId)), error: null}).then(res, rej);
          return (...args) => { q.filtros.push([metodo, ...args]); return b; };
        }
      });
      return b;
    }
  };
}

const ORG = '11111111-1111-1111-1111-111111111111';
const OUTRA = '22222222-2222-2222-2222-222222222222';
const base = {
  pipelines: [{id: 'p1', name: 'Vendas', is_default: true}],
  pipeline_stages: [{id: 's1', name: 'Novo', position: 0, pipeline_id: 'p1'}, {id: 's2', name: 'Proposta', position: 1, pipeline_id: 'p1'}],
  leads: [
    {__orgId: ORG, id: 'l1', contact_id: 'c1', pipeline_stage_id: 's2', source: 'Instagram', estimated_value: 500, created_at: '2026-11-10T12:00:00Z', temperature: 'hot', contact: {first_name: 'Ana', last_name: 'Lima'}},
    {__orgId: ORG, id: 'l2', pipeline_stage_id: 's1', source: 'Google', estimated_value: 200, created_at: '2026-11-12T12:00:00Z', temperature: 'cold', contact: {first_name: 'Bia'}},
    {__orgId: OUTRA, id: 'x9', pipeline_stage_id: 's1', source: 'Vazou', estimated_value: 99999, created_at: '2026-11-12T12:00:00Z', contact: {first_name: 'Outra empresa'}}
  ],
  sales: [{__orgId: ORG, id: 'v1', value: 300, sale_date: '2026-11-15T12:00:00Z', seller_id: 'u1', lead_id: 'l1'}, {__orgId: OUTRA, id: 'v9', value: 7777, seller_id: 'u9'}],
  profiles: [{id: 'u1', full_name: 'Carla'}],
  tasks: [{__orgId: ORG, id: 'k1', title: 'Ligar para Ana', due_date: '2020-01-01', status: 'pending', priority: 'high'}],
  contacts: [{__orgId: ORG, id: 'c1', first_name: 'Ana', city: 'Curitiba', created_at: '2026-11-01T10:00:00Z'}, {__orgId: OUTRA, id: 'c9', first_name: 'Estranho', city: 'Curitiba'}],
  custom_fields: [{__orgId: ORG, id: 'f1', name: 'Convênio', type: 'select', options: ['Unimed', 'Particular'], entity_type: 'contact'},
    {__orgId: OUTRA, id: 'f9', name: 'Convênio', type: 'text', options: [], entity_type: 'contact'}],
  custom_field_values: [{entity_id: 'c1', value: 'Unimed'}]
};

const TABELAS_DA_EMPRESA = new Set(['leads', 'sales', 'tasks', 'contacts', 'pipelines', 'custom_fields']);
function conferirEmpresa(admin) {
  for (const q of admin.consultas) {
    if (!TABELAS_DA_EMPRESA.has(q.tabela)) continue;
    assert.ok(q.filtros.some(f => f[0] === 'eq' && f[1] === 'organization_id' && f[2] === ORG), 'consulta em ' + q.tabela + ' sem filtro da empresa');
  }
}

for (const [nome, receita] of [
  ['quadro de leads', {tipo: 'quadro', fonte: 'leads'}],
  ['gráfico de vendas por vendedor', {tipo: 'grafico', fonte: 'vendas', medida: 'valor'}],
  ['lista de vendas (busca origem)', {tipo: 'lista', fonte: 'vendas'}],
  ['tarefas vencidas', {tipo: 'lista', fonte: 'tarefas', filtros: {situacao: 'vencidas'}}],
  ['contatos por cidade', {tipo: 'grafico', fonte: 'contatos', agrupar_por: 'cidade'}]
]) {
  test('toda consulta leva a empresa autorizada: ' + nome, async () => {
    const admin = fakeAdmin(base);
    const tela = await montarTela({admin, orgId: ORG, spec: validarReceita(receita).spec});
    conferirEmpresa(admin);
    assert.equal(JSON.stringify(tela).includes('Outra empresa'), false);
    assert.equal(JSON.stringify(tela).includes('99999'), false);
    assert.equal(JSON.stringify(tela).includes(ORG), false, 'a tela não devolve o id da empresa');
  });
}

test('quadro de leads: colunas na ordem do funil, valores somados', async () => {
  const tela = await montarTela({admin: fakeAdmin(base), orgId: ORG, spec: validarReceita({tipo: 'quadro', fonte: 'leads'}).spec});
  assert.deepEqual(tela.grupos.map(g => g.grupo), ['Novo', 'Proposta']);
  assert.equal(tela.grupos[1].valor, 500);
  assert.equal(tela.grupos[1].itens[0].titulo, 'Ana Lima');
});

test('etapa inexistente devolve aviso com as etapas reais (não inventa)', async () => {
  const tela = await montarTela({admin: fakeAdmin(base), orgId: ORG, spec: validarReceita({tipo: 'lista', fonte: 'leads', filtros: {etapa: 'Fechamento'}}).spec});
  assert.match(tela.aviso, /Novo, Proposta/);
  assert.equal(tela.linhas.length, 0);
});

test('lista de contatos não expõe telefone nem e-mail', async () => {
  const admin = fakeAdmin(base);
  const tela = await montarTela({admin, orgId: ORG, spec: validarReceita({tipo: 'lista', fonte: 'contatos'}).spec});
  assert.deepEqual(tela.colunas, ['Nome', 'Cidade', 'Cadastro']);
  const sel = admin.consultas.find(q => q.tabela === 'contacts').filtros.find(f => f[0] === 'select')[1];
  assert.equal(/whatsapp|email/.test(sel), false);
});

test('resumo para a IA é curto (não reenvia a lista inteira)', async () => {
  const tela = await montarTela({admin: fakeAdmin(base), orgId: ORG, spec: validarReceita({tipo: 'lista', fonte: 'leads'}).spec});
  const r = resumoParaIA(tela);
  assert.equal(r.itens_na_tela, 2);
  assert.equal('linhas' in r, false);
});

test('V52: lista de leads ganha coluna do campo extra da empresa (valor da pessoa)', async () => {
  const admin = fakeAdmin(base);
  const tela = await montarTela({admin, orgId: ORG, spec: validarReceita({tipo: 'lista', fonte: 'leads', campo: 'convenio'}).spec});
  conferirEmpresa(admin);
  assert.equal(tela.colunas.at(-1), 'Convênio');
  const ana = tela.linhas.find(l => l[0] === 'Ana Lima');
  assert.equal(ana.at(-1), 'Unimed');
  assert.equal(tela.linhas.find(l => l[0] === 'Bia').at(-1), 'Sem resposta');
});

test('V52: gráfico de contatos agrupado por campo extra', async () => {
  const tela = await montarTela({admin: fakeAdmin(base), orgId: ORG, spec: validarReceita({tipo: 'grafico', fonte: 'contatos', agrupar_por: 'campo', campo: 'Convênio'}).spec});
  assert.deepEqual(tela.grupos.map(g => g.grupo), ['Unimed']);
});

test('V52: campo que não existe na empresa avisa com os campos reais', async () => {
  const tela = await montarTela({admin: fakeAdmin(base), orgId: ORG, spec: validarReceita({tipo: 'grafico', fonte: 'leads', agrupar_por: 'campo', campo: 'Signo'}).spec});
  assert.match(tela.aviso, /Convênio/);
  assert.equal(validarReceita({tipo: 'grafico', fonte: 'leads', agrupar_por: 'campo'}).ok, false);
});
