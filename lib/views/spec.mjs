// "Receita de tela" do NEXUS Sob Medida (V51).
// A IA nunca escreve código nem consulta o banco: ela só preenche esta receita.
// Tudo aqui é lista fechada — o que não estiver na lista é recusado ou trocado pelo padrão.
// Funções puras (sem banco), testadas em tests/views-spec.test.mjs.

export const TIPOS = ['lista', 'quadro', 'grafico', 'numero'];
export const FONTES = {
  leads: {rotulo: 'Leads', agrupar: ['etapa', 'origem', 'temperatura', 'mes', 'semana', 'campo'], medidas: ['quantidade', 'valor'], ordenar: ['recentes', 'mais_antigos', 'maior_valor', 'parados']},
  vendas: {rotulo: 'Vendas', agrupar: ['vendedor', 'mes', 'semana', 'origem'], medidas: ['quantidade', 'valor'], ordenar: ['recentes', 'mais_antigos', 'maior_valor']},
  // V55: agendamentos (exames, consultas, visitas) — fonte da agenda.
  agendamentos: {rotulo: 'Agendamentos', agrupar: ['situacao', 'tipo', 'mes', 'semana', 'dia_semana'], medidas: ['quantidade'], ordenar: ['proximos', 'recentes']},
  tarefas: {rotulo: 'Tarefas', agrupar: ['situacao', 'prioridade'], medidas: ['quantidade'], ordenar: ['prazo', 'recentes']},
  contatos: {rotulo: 'Contatos', agrupar: ['cidade', 'mes', 'campo'], medidas: ['quantidade'], ordenar: ['recentes', 'mais_antigos', 'nome']}
};
export const TEMPERATURAS = {quente: 'hot', morno: 'warm', frio: 'cold'};
export const SITUACOES_TAREFA = ['abertas', 'vencidas', 'hoje', 'concluidas'];
export const SITUACOES_AGENDA = {agendados: ['scheduled', 'confirmed'], compareceram: ['completed'], faltaram: ['no_show'], cancelados: ['cancelled']};
// V55: estilo do gráfico (o mesmo dado agrupado, desenhado de outro jeito).
export const ESTILOS = ['barras', 'pizza', 'linha'];
export const LIMITE_MAX = 100;

const txt = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const int = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };
const pick = (v, lista) => { const n = norm(v); return lista.find(x => x === n) || null; };

/** Valida e normaliza a receita. Devolve {ok:true, spec} ou {ok:false, erro}. Nunca lança. */
export function validarReceita(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {ok: false, erro: 'Receita de tela vazia.'};
  const fonte = pick(raw.fonte, Object.keys(FONTES));
  if (!fonte) return {ok: false, erro: 'Fonte inválida. Use: ' + Object.keys(FONTES).join(', ') + '.'};
  const cfg = FONTES[fonte];
  let tipo = pick(raw.tipo, TIPOS) || 'lista';
  let agrupar = raw.agrupar_por ? pick(raw.agrupar_por, cfg.agrupar) : null;
  if (raw.agrupar_por && !agrupar) return {ok: false, erro: 'Não dá para agrupar ' + cfg.rotulo.toLowerCase() + ' por "' + txt(raw.agrupar_por, 30) + '". Opções: ' + cfg.agrupar.join(', ') + '.'};
  let medida = pick(raw.medida, cfg.medidas) || 'quantidade';
  if (tipo === 'quadro') {
    // Quadro de etapas só faz sentido para leads; para o resto vira gráfico por grupo.
    if (fonte === 'leads') agrupar = agrupar || 'etapa';
    else { tipo = 'grafico'; agrupar = agrupar || cfg.agrupar[0]; }
  }
  if (tipo === 'grafico' && !agrupar) agrupar = cfg.agrupar[0];
  if (tipo === 'numero') agrupar = null;
  const f = raw.filtros && typeof raw.filtros === 'object' && !Array.isArray(raw.filtros) ? raw.filtros : {};
  const filtros = {};
  const periodo = f.periodo_dias != null ? int(f.periodo_dias, 1, 365) : null;
  if (periodo) filtros.periodo_dias = periodo;
  if (fonte === 'leads') {
    if (f.etapa) filtros.etapa = txt(f.etapa, 60);
    if (f.origem) filtros.origem = txt(f.origem, 60);
    const t = f.temperatura ? TEMPERATURAS[norm(f.temperatura)] : null;
    if (f.temperatura && !t) return {ok: false, erro: 'Temperatura inválida. Use quente, morno ou frio.'};
    if (t) filtros.temperatura = t;
    const parados = f.parados_dias != null ? int(f.parados_dias, 1, 365) : null;
    if (parados) filtros.parados_dias = parados;
    filtros.somente_abertos = f.somente_abertos === false ? false : true;
  }
  if (fonte === 'vendas' && f.origem) filtros.origem = txt(f.origem, 60);
  if (fonte === 'tarefas') {
    const s = f.situacao ? pick(f.situacao, SITUACOES_TAREFA) : null;
    filtros.situacao = s || 'abertas';
  }
  if (fonte === 'contatos' && f.cidade) filtros.cidade = txt(f.cidade, 60);
  if (fonte === 'agendamentos') {
    const s = f.situacao ? pick(f.situacao, Object.keys(SITUACOES_AGENDA)) : null;
    if (s) filtros.situacao = s;
    const prox = f.proximos_dias != null ? int(f.proximos_dias, 1, 365) : null;
    if (prox) filtros.proximos_dias = prox;
  }
  // V52: campo extra da empresa (nome). Só leads e contatos; o servidor confere se o campo existe nesta empresa.
  const campo = (fonte === 'leads' || fonte === 'contatos') && raw.campo ? txt(raw.campo, 80) : null;
  if (agrupar === 'campo' && !campo) return {ok: false, erro: 'Diga qual campo extra usar para agrupar.'};
  // Linha só faz sentido no tempo (mês, semana, dia da semana); se não for, vira barras.
  let estilo = tipo === 'grafico' ? (pick(raw.estilo, ESTILOS) || 'barras') : null;
  if (estilo === 'linha' && !['mes', 'semana', 'dia_semana'].includes(agrupar)) estilo = 'barras';
  const ordenar = pick(raw.ordenar, cfg.ordenar) || cfg.ordenar[0];
  const limite = int(raw.limite, 1, LIMITE_MAX) || (tipo === 'lista' ? 30 : LIMITE_MAX);
  const titulo = txt(raw.titulo, 80) || tituloPadrao({fonte, tipo, agrupar: agrupar === 'campo' ? campo : agrupar, medida, filtros});
  return {ok: true, spec: {versao: 1, titulo, tipo, fonte, agrupar_por: agrupar, medida, filtros, ordenar, limite, ...(campo ? {campo} : {}), ...(estilo ? {estilo} : {})}};
}

export function tituloPadrao({fonte, tipo, agrupar, medida}) {
  const base = FONTES[fonte].rotulo;
  if (tipo === 'numero') return (medida === 'valor' ? 'Valor de ' : 'Total de ') + base.toLowerCase();
  if (agrupar) return base + ' por ' + agrupar.replace('_', ' ');
  return base;
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
/** Rótulo de mês no fuso de São Paulo, ex.: "nov/26". */
export function rotuloMes(iso) {
  if (!iso) return 'Sem data';
  const d = new Date(new Date(iso).toLocaleString('en-US', {timeZone: 'America/Sao_Paulo'}));
  if (isNaN(d)) return 'Sem data';
  return MESES[d.getMonth()] + '/' + String(d.getFullYear()).slice(2);
}

/**
 * Agrupa linhas já buscadas (e já filtradas pela empresa) conforme a receita.
 * Cada linha precisa ter: grupo (texto), valor (número) e, para ordenar grupos fixos, ordem (opcional).
 */
export function agrupar(linhas, spec) {
  const mapa = new Map();
  for (const l of linhas) {
    const k = l.grupo || 'Sem informação';
    const g = mapa.get(k) || {grupo: k, quantidade: 0, valor: 0, ordem: l.ordem ?? 999, itens: []};
    g.quantidade += 1; g.valor += Number(l.valor) || 0;
    if (spec.tipo === 'quadro' && g.itens.length < 25) g.itens.push(l.item);
    mapa.set(k, g);
  }
  const grupos = [...mapa.values()];
  if (spec.tipo === 'quadro' || spec.agrupar_por === 'etapa') grupos.sort((a, b) => a.ordem - b.ordem);
  else if (['mes', 'semana', 'dia_semana'].includes(spec.agrupar_por)) grupos.sort((a, b) => a.ordem - b.ordem);
  else grupos.sort((a, b) => (spec.medida === 'valor' ? b.valor - a.valor : b.quantidade - a.quantidade));
  return grupos.map(g => ({...g, valor: Math.round(g.valor * 100) / 100}));
}

/** Total para o tipo "numero". */
export function totalizar(linhas, spec) {
  const quantidade = linhas.length;
  const valor = Math.round(linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0) * 100) / 100;
  return {quantidade, valor, principal: spec.medida === 'valor' ? valor : quantidade};
}

/** Descreve a receita em uma frase (para a IA confirmar o que montou e para o título salvo). */
export function descreverReceita(spec) {
  const partes = [FONTES[spec.fonte].rotulo];
  const f = spec.filtros || {};
  if (f.periodo_dias) partes.push('últimos ' + f.periodo_dias + ' dias');
  if (f.etapa) partes.push('etapa "' + f.etapa + '"');
  if (f.origem) partes.push('origem "' + f.origem + '"');
  if (f.temperatura) partes.push(Object.entries(TEMPERATURAS).find(([, v]) => v === f.temperatura)[0] + 's');
  if (f.parados_dias) partes.push('parados há ' + f.parados_dias + '+ dias');
  if (f.situacao && (spec.fonte === 'tarefas' || spec.fonte === 'agendamentos')) partes.push(f.situacao);
  if (f.proximos_dias) partes.push('próximos ' + f.proximos_dias + ' dias');
  if (f.cidade) partes.push('cidade "' + f.cidade + '"');
  if (spec.agrupar_por) partes.push('por ' + (spec.agrupar_por === 'campo' ? '"' + spec.campo + '"' : spec.agrupar_por));
  else if (spec.campo) partes.push('com "' + spec.campo + '"');
  return partes.join(' · ');
}

const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const emSP = iso => new Date(new Date(iso).toLocaleString('en-US', {timeZone: 'America/Sao_Paulo'}));
/** V55: semana que começa na segunda, ex.: "sem 17/11"; ordem = data da segunda-feira. */
export function semanaDe(iso) {
  if (!iso) return {rotulo: 'Sem data', ordem: 0};
  const d = emSP(iso); if (isNaN(d)) return {rotulo: 'Sem data', ordem: 0};
  const seg = new Date(d); seg.setHours(0, 0, 0, 0); seg.setDate(seg.getDate() - ((seg.getDay() + 6) % 7));
  return {rotulo: 'sem ' + String(seg.getDate()).padStart(2, '0') + '/' + String(seg.getMonth() + 1).padStart(2, '0'), ordem: seg.getTime()};
}
/** V55: dia da semana (seg..dom), ordem segunda primeiro. */
export function diaDaSemana(iso) {
  if (!iso) return {rotulo: 'Sem data', ordem: 9};
  const d = emSP(iso); if (isNaN(d)) return {rotulo: 'Sem data', ordem: 9};
  return {rotulo: DIAS[d.getDay()], ordem: (d.getDay() + 6) % 7};
}
