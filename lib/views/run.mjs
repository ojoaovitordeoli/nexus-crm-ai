// Executa uma receita de tela JÁ VALIDADA (lib/views/spec.mjs) no servidor.
// Toda consulta leva organization_id da empresa autorizada (authorizeTenant) — nunca do texto da IA.
// Sem SQL livre: só os campos e filtros abaixo.
import {agrupar, totalizar, rotuloMes, descreverReceita} from './spec.mjs';
import {nowInSaoPaulo} from '../assistant/rules.mjs';
import {mostrarValor} from '../custom-fields-chat.mjs';

const BUSCA_MAX = 3000; // linhas lidas para agrupar; acima disso a tela avisa que é parcial
const TEMP_PT = {hot: 'Quente', warm: 'Morno', cold: 'Frio'};
const PRIORIDADE_PT = {high: 'Alta', medium: 'Média', low: 'Baixa', alta: 'Alta', media: 'Média', baixa: 'Baixa'};
const nome = c => [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || 'Sem nome';
const seguro = t => String(t || '').replace(/[,()%*\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const desde = dias => new Date(Date.now() - dias * 86400000).toISOString();
const ordemMes = iso => { const d = new Date(iso || 0); return isNaN(d) ? 0 : d.getTime(); };

function falhou(rotulo, res) {
  if (res?.error) { const e = new Error('consulta ' + rotulo); e.cause = res.error; throw e; }
  return res?.data || [];
}

async function mapaEtapas(admin, orgId) {
  const pipes = falhou('funis', await admin.from('pipelines').select('id,name,is_default').eq('organization_id', orgId).limit(50));
  const ids = pipes.map(p => p.id);
  const stages = ids.length ? falhou('etapas', await admin.from('pipeline_stages').select('id,name,position,pipeline_id').in('pipeline_id', ids).order('position').limit(500)) : [];
  return {pipes, stages, porId: Object.fromEntries(stages.map(s => [s.id, s]))};
}

async function nomesPerfis(admin, ids) {
  const u = [...new Set(ids.filter(Boolean))];
  if (!u.length) return {};
  const rows = falhou('perfis', await admin.from('profiles').select('id,full_name').in('id', u.slice(0, 200)));
  return Object.fromEntries(rows.map(p => [p.id, p.full_name || 'Sem nome']));
}


// V52: campo extra da empresa usado numa tela (coluna na lista ou agrupamento).
async function campoExtra(admin, orgId, nome, entidades) {
  const rows = falhou('campos extras', await admin.from('custom_fields').select('id,name,type,options,entity_type').eq('organization_id', orgId).limit(200));
  const alvo = rows.filter(f => entidades.includes(f.entity_type || 'lead'));
  const f = alvo.find(x => norm(x.name) === norm(nome)) || alvo.find(x => norm(x.name).includes(norm(nome)));
  if (!f) return {aviso: 'Não existe o campo extra "' + nome + '". Campos: ' + (alvo.map(x => x.name).join(', ') || 'nenhum') + '.'};
  return {campo: f};
}
async function valoresDoCampo(admin, campo, ids) {
  const u = [...new Set(ids.filter(Boolean))];
  const mapa = new Map();
  for (let i = 0; i < u.length; i += 500) {
    const rows = falhou('valores do campo', await admin.from('custom_field_values').select('entity_id,value').eq('custom_field_id', campo.id).in('entity_id', u.slice(i, i + 500)));
    for (const r of rows) mapa.set(r.entity_id, r.value);
  }
  return mapa;
}
const textoCampo = (campo, v) => mostrarValor(campo, v) || 'Sem resposta';

async function leads(admin, orgId, spec) {
  const f = spec.filtros;
  const {stages, porId} = await mapaEtapas(admin, orgId);
  let q = admin.from('leads')
    .select('id,contact_id,pipeline_stage_id,source,estimated_value,created_at,stage_changed_at,temperature,closed_at,contact:contacts!leads_contact_id_fkey(first_name,last_name,city)')
    .eq('organization_id', orgId).is('deleted_at', null);
  if (f.somente_abertos !== false) q = q.is('closed_at', null);
  if (f.periodo_dias) q = q.gte('created_at', desde(f.periodo_dias));
  if (f.origem) q = q.ilike('source', '%' + seguro(f.origem) + '%');
  if (f.temperatura) q = q.eq('temperature', f.temperatura);
  if (f.parados_dias) { const c = desde(f.parados_dias); q = q.or('stage_changed_at.lt.' + c + ',and(stage_changed_at.is.null,created_at.lt.' + c + ')'); }
  if (f.etapa) {
    const alvo = stages.filter(s => norm(s.name).includes(norm(f.etapa))).map(s => s.id);
    if (!alvo.length) return {linhas: [], aviso: 'Nenhuma etapa com o nome "' + f.etapa + '". Etapas: ' + [...new Set(stages.map(s => s.name))].join(', ')};
    q = q.in('pipeline_stage_id', alvo);
  }
  const ord = {recentes: ['created_at', false], mais_antigos: ['created_at', true], maior_valor: ['estimated_value', false], parados: ['stage_changed_at', true]}[spec.ordenar] || ['created_at', false];
  const rows = falhou('leads', await q.order(ord[0], {ascending: ord[1], nullsFirst: spec.ordenar === 'parados'}).limit(BUSCA_MAX));
  let campo = null, valores = new Map(), avisoCampo = '';
  if (spec.campo) {
    const c = await campoExtra(admin, orgId, spec.campo, ['lead', 'contact']);
    if (c.aviso) { if (spec.agrupar_por === 'campo') return {linhas: [], aviso: c.aviso}; avisoCampo = c.aviso; }
    else { campo = c.campo; valores = await valoresDoCampo(admin, campo, rows.map(l => campo.entity_type === 'contact' ? l.contact_id : l.id)); }
  }
  const valorCampo = l => campo ? textoCampo(campo, valores.get(campo.entity_type === 'contact' ? l.contact_id : l.id)) : null;
  const linhas = rows.map(l => {
    const st = porId[l.pipeline_stage_id];
    const grupoDe = {etapa: st?.name || 'Sem etapa', origem: l.source || 'Sem origem', temperatura: TEMP_PT[l.temperature] || 'Sem temperatura', mes: rotuloMes(l.created_at), campo: valorCampo(l)};
    const ordemDe = {etapa: st ? st.position : 9999, mes: ordemMes(l.created_at)};
    const dias = Math.floor((Date.now() - new Date(l.stage_changed_at || l.created_at).getTime()) / 86400000);
    return {grupo: grupoDe[spec.agrupar_por] ?? null, ordem: ordemDe[spec.agrupar_por] ?? 999, valor: Number(l.estimated_value) || 0,
      item: {id: l.id, titulo: nome(l.contact), detalhe: [st?.name, l.source].filter(Boolean).join(' · '), valor: Number(l.estimated_value) || 0, extra: dias >= 0 ? dias + ' d na etapa' : ''}};
  });
  return {linhas, truncado: rows.length >= BUSCA_MAX, aviso: avisoCampo,
    colunas: ['Cliente', 'Etapa', 'Origem', 'Temperatura', 'Valor', 'Na etapa há', ...(campo ? [campo.name] : [])],
    tabela: rows.map(l => [nome(l.contact), porId[l.pipeline_stage_id]?.name || 'Sem etapa', l.source || '—', TEMP_PT[l.temperature] || '—', Number(l.estimated_value) || 0,
      Math.max(0, Math.floor((Date.now() - new Date(l.stage_changed_at || l.created_at).getTime()) / 86400000)) + ' d', ...(campo ? [valorCampo(l)] : [])])};
}

async function vendas(admin, orgId, spec) {
  const f = spec.filtros;
  let q = admin.from('sales').select('id,value,sale_date,seller_id,lead_id,created_at').eq('organization_id', orgId);
  if (f.periodo_dias) q = q.gte('sale_date', desde(f.periodo_dias));
  const ord = {recentes: ['sale_date', false], mais_antigos: ['sale_date', true], maior_valor: ['value', false]}[spec.ordenar] || ['sale_date', false];
  let rows = falhou('vendas', await q.order(ord[0], {ascending: ord[1]}).limit(BUSCA_MAX));
  const precisaOrigem = f.origem || spec.agrupar_por === 'origem' || spec.tipo === 'lista';
  let origemDe = {};
  if (precisaOrigem) {
    const ids = [...new Set(rows.map(r => r.lead_id).filter(Boolean))].slice(0, 1000);
    const ls = ids.length ? falhou('origem das vendas', await admin.from('leads').select('id,source,contact:contacts!leads_contact_id_fkey(first_name,last_name)').eq('organization_id', orgId).in('id', ids)) : [];
    origemDe = Object.fromEntries(ls.map(l => [l.id, {origem: l.source || 'Sem origem', cliente: nome(l.contact)}]));
  }
  if (f.origem) rows = rows.filter(r => norm(origemDe[r.lead_id]?.origem).includes(norm(f.origem)));
  const vend = await nomesPerfis(admin, rows.map(r => r.seller_id));
  const linhas = rows.map(r => ({
    grupo: {vendedor: vend[r.seller_id] || 'Sem vendedor', mes: rotuloMes(r.sale_date), origem: origemDe[r.lead_id]?.origem || 'Sem origem'}[spec.agrupar_por] ?? null,
    ordem: spec.agrupar_por === 'mes' ? ordemMes(r.sale_date) : 999, valor: Number(r.value) || 0, item: {id: r.id}}));
  return {linhas, truncado: rows.length >= BUSCA_MAX, colunas: ['Data', 'Cliente', 'Vendedor', 'Origem', 'Valor'],
    tabela: rows.map(r => [String(r.sale_date || '').slice(0, 10).split('-').reverse().join('/'), origemDe[r.lead_id]?.cliente || '—', vend[r.seller_id] || '—', origemDe[r.lead_id]?.origem || '—', Number(r.value) || 0])};
}

async function tarefas(admin, orgId, spec) {
  const f = spec.filtros; const hoje = nowInSaoPaulo().date;
  let q = admin.from('tasks').select('id,title,due_date,status,priority,created_at').eq('organization_id', orgId);
  if (f.situacao === 'concluidas') q = q.eq('status', 'completed');
  else q = q.neq('status', 'completed');
  if (f.situacao === 'vencidas') q = q.lt('due_date', hoje);
  if (f.situacao === 'hoje') q = q.eq('due_date', hoje);
  if (f.periodo_dias) q = q.gte('created_at', desde(f.periodo_dias));
  q = spec.ordenar === 'recentes' ? q.order('created_at', {ascending: false}) : q.order('due_date', {ascending: true, nullsFirst: false});
  const rows = falhou('tarefas', await q.limit(BUSCA_MAX));
  const situacao = t => t.status === 'completed' ? 'Concluída' : !t.due_date ? 'Sem prazo' : t.due_date < hoje ? 'Vencida' : t.due_date === hoje ? 'Hoje' : 'Próximas';
  const linhas = rows.map(t => ({grupo: {situacao: situacao(t), prioridade: PRIORIDADE_PT[norm(t.priority)] || 'Sem prioridade'}[spec.agrupar_por] ?? null, ordem: 999, valor: 0, item: {id: t.id}}));
  return {linhas, truncado: rows.length >= BUSCA_MAX, colunas: ['Tarefa', 'Prazo', 'Situação', 'Prioridade'],
    tabela: rows.map(t => [t.title || 'Sem título', t.due_date ? t.due_date.split('-').reverse().join('/') : '—', situacao(t), PRIORIDADE_PT[norm(t.priority)] || '—'])};
}

async function contatos(admin, orgId, spec) {
  const f = spec.filtros;
  let q = admin.from('contacts').select('id,first_name,last_name,city,created_at').eq('organization_id', orgId).is('deleted_at', null);
  if (f.periodo_dias) q = q.gte('created_at', desde(f.periodo_dias));
  if (f.cidade) q = q.ilike('city', '%' + seguro(f.cidade) + '%');
  q = spec.ordenar === 'nome' ? q.order('first_name', {ascending: true}) : q.order('created_at', {ascending: spec.ordenar === 'mais_antigos'});
  const rows = falhou('contatos', await q.limit(BUSCA_MAX));
  let campo = null, valores = new Map(), avisoCampo = '';
  if (spec.campo) {
    const c = await campoExtra(admin, orgId, spec.campo, ['contact']);
    if (c.aviso) { if (spec.agrupar_por === 'campo') return {linhas: [], aviso: c.aviso}; avisoCampo = c.aviso; }
    else { campo = c.campo; valores = await valoresDoCampo(admin, campo, rows.map(c2 => c2.id)); }
  }
  const valorCampo = c => campo ? textoCampo(campo, valores.get(c.id)) : null;
  const linhas = rows.map(c => ({grupo: {cidade: c.city || 'Sem cidade', mes: rotuloMes(c.created_at), campo: valorCampo(c)}[spec.agrupar_por] ?? null, ordem: spec.agrupar_por === 'mes' ? ordemMes(c.created_at) : 999, valor: 0, item: {id: c.id}}));
  // Lista de contatos mostra só nome, cidade e data (sem telefone/e-mail: mínimo necessário).
  return {linhas, truncado: rows.length >= BUSCA_MAX, aviso: avisoCampo, colunas: ['Nome', 'Cidade', 'Cadastro', ...(campo ? [campo.name] : [])],
    tabela: rows.map(c => [nome(c), c.city || '—', String(c.created_at || '').slice(0, 10).split('-').reverse().join('/'), ...(campo ? [valorCampo(c)] : [])])};
}

const FONTE = {leads, vendas, tarefas, contatos};

/** Monta a tela. Devolve dados prontos para desenhar (sem ids de empresa). */
export async function montarTela({admin, orgId, spec}) {
  const r = await FONTE[spec.fonte](admin, orgId, spec);
  const base = {spec, titulo: spec.titulo, descricao: descreverReceita(spec), geradoEm: new Date().toISOString(),
    aviso: r.aviso || (r.truncado ? 'Mostrando as ' + BUSCA_MAX + ' mais recentes. Use um filtro de período para ver tudo.' : '')};
  if (spec.tipo === 'numero') return {...base, total: totalizar(r.linhas, spec)};
  if (spec.tipo === 'lista') return {...base, colunas: r.colunas, linhas: (r.tabela || []).slice(0, spec.limite), quantidade: r.linhas.length};
  return {...base, grupos: agrupar(r.linhas, spec), total: totalizar(r.linhas, spec)};
}

/** Resumo curto para a IA (não manda a lista inteira de volta ao modelo). */
export function resumoParaIA(tela) {
  if (tela.aviso && !tela.grupos && !tela.linhas && !tela.total) return {aviso: tela.aviso};
  if (tela.total && !tela.grupos) return {titulo: tela.titulo, quantidade: tela.total.quantidade, valor: tela.total.valor, aviso: tela.aviso || undefined};
  if (tela.linhas) return {titulo: tela.titulo, itens_na_tela: tela.linhas.length, total_encontrado: tela.quantidade, aviso: tela.aviso || undefined};
  return {titulo: tela.titulo, grupos: tela.grupos.slice(0, 12).map(g => ({grupo: g.grupo, quantidade: g.quantidade, valor: g.valor})), aviso: tela.aviso || undefined};
}
