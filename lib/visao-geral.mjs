// V56 — "Visão geral que fala": avisos com número + ação, comparação com o período
// anterior e série semanal. Tudo calculado dos registros reais já carregados; nada é
// estimado. Quando a amostra carregada não cobre o período anterior, a comparação
// NÃO aparece (melhor nada do que uma seta errada).
import {semanaDe} from './views/spec.mjs';

const DIA = 86400000;
const t = v => { const n = Date.parse(v || ''); return Number.isFinite(n) ? n : null; };
const FECHADA = ['done', 'completed', 'cancelled', 'canceled'];
const int = v => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0}).format(Number(v) || 0);
const brl = v => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0}).format(Number(v) || 0);
const plural = (n, um, varios) => int(n) + ' ' + (n === 1 ? um : varios);

export const dataVenda = s => s?.sale_date || s?.created_at;

/** Data de calendário (AAAA-MM-DD ou ISO) → meia-noite local; null se inválida. */
function diaDe(v) {
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
}

/**
 * Compara a janela [agora-dias, agora) com a anterior [agora-2*dias, agora-dias).
 * incompleta=true quando há mais registros no banco do que os carregados E o mais
 * antigo carregado é mais novo que o começo da janela anterior → sem comparação.
 */
export function comparar(lista, {campo, agora = Date.now(), dias = 30, valor = () => 1, incompleta = false} = {}) {
  const fim = agora, meio = agora - dias * DIA, inicio = agora - 2 * dias * DIA;
  let atual = 0, anterior = 0, maisAntigo = Infinity;
  for (const item of lista || []) {
    const ms = t(typeof campo === 'function' ? campo(item) : item?.[campo]);
    if (ms === null) continue;
    if (ms < maisAntigo) maisAntigo = ms;
    const v = Number(valor(item)) || 0;
    if (ms >= meio && ms < fim) atual += v;
    else if (ms >= inicio && ms < meio) anterior += v;
  }
  const semBase = incompleta && maisAntigo > inicio;
  const variacao = semBase || anterior === 0 ? null : Math.round((atual - anterior) / anterior * 100);
  return {atual, anterior, variacao, semBase};
}

/** Texto curto da comparação: "▲ 12% vs. 30 dias antes", "igual aos 30 dias antes" ou null. */
export function textoVariacao(c, dias = 30) {
  if (!c || c.semBase) return null;
  if (c.variacao === null) return null; // sem base de comparação: não mostra nada
  if (c.variacao === 0) return 'igual aos ' + dias + ' dias antes';
  return (c.variacao > 0 ? '▲ ' : '▼ ') + Math.abs(c.variacao) + '% vs. ' + dias + ' dias antes';
}

/** Leads e vendas por semana (segunda a domingo), últimas N semanas, inclusive a atual. */
export function porSemana({leads = [], sales = []} = {}, {agora = Date.now(), semanas = 8} = {}) {
  const out = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const s = semanaDe(new Date(agora - i * 7 * DIA).toISOString());
    out.push({rotulo: s.rotulo.replace('sem ', ''), ordem: s.ordem, leads: 0, vendas: 0, receita: 0});
  }
  const idx = new Map(out.map((s, i) => [s.ordem, i]));
  for (const l of leads) { const i = idx.get(semanaDe(l?.created_at).ordem); if (i !== undefined) out[i].leads++; }
  for (const s of sales) {
    const i = idx.get(semanaDe(dataVenda(s)).ordem);
    if (i !== undefined) { out[i].vendas++; out[i].receita += Number(s?.value) || 0; }
  }
  return out;
}

/**
 * Até 3 avisos, do mais urgente ao menos, cada um com número + o que fazer.
 * tom: 'alerta' (vermelho), 'atencao' (âmbar), 'bom' (verde), 'info'.
 */
export function avisos({leads = [], sales = [], tasks = [], appointments = [], stages = [], goal = null, cobertura = {}} = {}, {agora = Date.now(), max = 3} = {}) {
  const lista = [];
  const hoje = new Date(agora); hoje.setHours(0, 0, 0, 0);
  const h0 = hoje.getTime();

  // 1) Tarefas vencidas
  const vencidas = tasks.filter(x => !FECHADA.includes(String(x?.status || '').toLowerCase()) && diaDe(x?.due_date) !== null && diaDe(x.due_date) < h0);
  if (vencidas.length) {
    const maisVelha = Math.min(...vencidas.map(x => diaDe(x.due_date)));
    const dias = Math.max(1, Math.round((h0 - maisVelha) / DIA));
    lista.push({id: 'vencidas', tom: 'alerta', peso: 100,
      titulo: plural(vencidas.length, 'tarefa vencida', 'tarefas vencidas'),
      texto: 'A mais antiga venceu há ' + plural(dias, 'dia', 'dias') + '. Resolva hoje ou mude o prazo.',
      href: '/tasks', acao: 'Ver tarefas'});
  }

  // 2) Agendamentos que já passaram sem presença marcada
  const semPresenca = appointments.filter(a => ['scheduled', 'confirmed'].includes(String(a?.status || '').toLowerCase()) && (t(a?.end_at) ?? t(a?.start_at)) !== null && (t(a?.end_at) ?? t(a.start_at)) < agora);
  if (semPresenca.length) lista.push({id: 'presenca', tom: 'atencao', peso: 90,
    titulo: plural(semPresenca.length, 'agendamento sem presença marcada', 'agendamentos sem presença marcada'),
    texto: 'Marque quem compareceu ou faltou: é isso que alimenta os relatórios e as automações.',
    href: '/agenda', acao: 'Abrir agenda'});

  // 3) Faltas nos últimos 30 dias (só com base mínima: 5 agendamentos encerrados)
  const encerrados = appointments.filter(a => { const ms = t(a?.start_at); return ms !== null && ms >= agora - 30 * DIA && ms < agora && ['completed', 'no_show'].includes(String(a?.status || '').toLowerCase()); });
  if (encerrados.length >= 5) {
    const faltas = encerrados.filter(a => String(a.status).toLowerCase() === 'no_show').length;
    const pct = Math.round(faltas / encerrados.length * 100);
    if (pct >= 15) lista.push({id: 'faltas', tom: 'atencao', peso: 80,
      titulo: pct + '% de faltas em 30 dias',
      texto: plural(faltas, 'falta', 'faltas') + ' em ' + int(encerrados.length) + ' atendimentos. Confirme no dia anterior e reagende quem faltou.',
      href: '/agenda', acao: 'Ver agenda'});
  }

  // 4) Leads parados há 7+ dias na mesma etapa (sem etapa de ganho/perda)
  const fim = new Set(stages.filter(s => s?.is_won || s?.is_lost).map(s => s.id));
  const parados = leads.filter(l => {
    if (fim.has(l?.pipeline_stage_id) || l?.closed_at || ['won', 'lost'].includes(String(l?.status || '').toLowerCase())) return false;
    const desde = t(l?.stage_changed_at || l?.created_at);
    return desde !== null && agora - desde >= 7 * DIA;
  });
  if (parados.length) lista.push({id: 'parados', tom: parados.length >= 5 ? 'atencao' : 'info', peso: 70,
    titulo: plural(parados.length, 'lead parado', 'leads parados') + ' há 7 dias ou mais',
    texto: 'Sem mudar de etapa há uma semana. Chame no WhatsApp ou marque como perdido.' + (cobertura.leads ? ' (entre os carregados)' : ''),
    href: '/leads', acao: 'Abrir leads'});

  // 5) Meta do mês: ritmo
  if (goal?.target > 0 && goal?.from && goal?.to) {
    const alvo = Number(goal.target), feito = Math.max(0, Number(goal.achieved) || 0);
    const de = t(goal.from), ate = t(goal.to);
    if (de !== null && ate !== null && ate > de) {
      const decorrido = Math.min(1, Math.max(0, (agora - de) / (ate - de)));
      const pct = Math.round(feito / alvo * 100), esperado = Math.round(decorrido * 100);
      if (feito >= alvo) lista.push({id: 'meta', tom: 'bom', peso: 60, titulo: 'Meta do mês batida: ' + pct + '%',
        texto: brl(feito) + ' de ' + brl(alvo) + '. O que entrar agora é lucro acima do plano.', href: '/sales', acao: 'Ver vendas'});
      else if (pct + 5 < esperado) lista.push({id: 'meta', tom: 'atencao', peso: 85, titulo: 'Meta em ' + pct + '%, o mês já está em ' + esperado + '%',
        texto: 'Faltam ' + brl(alvo - feito) + '. Puxe os leads quentes e as propostas abertas.', href: '/sales', acao: 'Ver vendas'});
      else lista.push({id: 'meta', tom: 'bom', peso: 40, titulo: 'Meta no ritmo: ' + pct + '%',
        texto: 'O mês está em ' + esperado + '%. Faltam ' + brl(alvo - feito) + '.', href: '/sales', acao: 'Ver vendas'});
    }
  }

  // 6) Vendas vs. 30 dias antes (só com base completa)
  const cv = comparar(sales, {campo: dataVenda, agora, incompleta: cobertura.sales});
  if (cv.variacao !== null && cv.anterior >= 3 && Math.abs(cv.variacao) >= 20) {
    lista.push(cv.variacao > 0
      ? {id: 'vendas', tom: 'bom', peso: 50, titulo: 'Vendas subiram ' + cv.variacao + '%', texto: int(cv.atual) + ' nos últimos 30 dias contra ' + int(cv.anterior) + ' nos 30 antes.', href: '/sales', acao: 'Ver vendas'}
      : {id: 'vendas', tom: 'atencao', peso: 75, titulo: 'Vendas caíram ' + Math.abs(cv.variacao) + '%', texto: int(cv.atual) + ' nos últimos 30 dias contra ' + int(cv.anterior) + ' nos 30 antes. Veja de onde vinham os leads.', href: '/reports', acao: 'Ver relatórios'});
  }

  lista.sort((a, b) => b.peso - a.peso);
  if (!lista.length) return [{id: 'em-dia', tom: 'bom', peso: 0, titulo: 'Tudo em dia', texto: 'Nenhuma tarefa vencida, nenhum lead parado e nenhuma presença pendente.', href: '/leads', acao: 'Abrir leads'}];
  return lista.slice(0, max).map(({peso, ...a}) => a);
}
