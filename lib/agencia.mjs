// V63 — Visão da agência: todas as empresas que a pessoa gerencia, numa tela.
// Regras puras (testáveis): quem pode ver quais empresas e como cada empresa é avaliada.
export const PAPEIS_AGENCIA = ['AGENCY_ADMIN', 'ORGANIZATION_ADMIN', 'MANAGER'];
const int = v => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0}).format(Number(v) || 0);
const plural = (n, um, varios) => int(n) + ' ' + (n === 1 ? um : varios);
export const brl = v => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0}).format(Number(v) || 0);

/**
 * Empresas visíveis: super admin vê todas as ativas; os demais só as ativas em que
 * têm vínculo ativo com papel de gestão. Nunca confia em lista vinda do navegador.
 */
export function empresasPermitidas({isSuperAdmin = false, membros = [], orgs = []} = {}) {
  const ativas = orgs.filter(o => o?.status === 'active');
  if (isSuperAdmin) return ativas;
  const ok = new Set(membros.filter(m => m?.status === 'active' && PAPEIS_AGENCIA.includes(m.role)).map(m => m.organization_id));
  return ativas.filter(o => ok.has(o.id));
}

/** Avalia uma empresa a partir das contagens do servidor: alertas em ordem de gravidade. */
export function avaliarEmpresa(m = {}, {agora = Date.now()} = {}) {
  const d = new Date(agora), diasMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), hoje = d.getDate();
  const feito = Number(m.faturamentoMes) || 0, alvo = Number(m.meta) > 0 ? Number(m.meta) : null;
  const projecao = hoje ? Math.round(feito / hoje * diasMes) : 0;
  const pctMeta = alvo ? Math.round(feito / alvo * 100) : null, esperado = Math.round(hoje / diasMes * 100);
  const encerrados = (Number(m.compareceram30) || 0) + (Number(m.faltas30) || 0);
  const pctFaltas = encerrados >= 5 ? Math.round((Number(m.faltas30) || 0) / encerrados * 100) : null;
  const alertas = [];
  if (alvo && pctMeta + 10 < esperado) alertas.push({tom: 'alerta', peso: 90, txt: 'Meta em ' + pctMeta + '%, o mês em ' + esperado + '%'});
  if (m.tarefasVencidas > 0) alertas.push({tom: m.tarefasVencidas >= 5 ? 'alerta' : 'atencao', peso: 70 + Math.min(19, m.tarefasVencidas), txt: plural(m.tarefasVencidas, 'tarefa vencida', 'tarefas vencidas')});
  if (m.semPresenca > 0) alertas.push({tom: 'atencao', peso: 65, txt: plural(m.semPresenca, 'presença por marcar', 'presenças por marcar')});
  if (pctFaltas !== null && pctFaltas >= 20) alertas.push({tom: 'atencao', peso: 60 + Math.min(20, pctFaltas - 20), txt: pctFaltas + '% de faltas em 30 dias'});
  if (m.parados > 0 && m.leadsAbertos > 0 && m.parados / m.leadsAbertos >= 0.3) alertas.push({tom: 'atencao', peso: 55, txt: plural(m.parados, 'lead parado', 'leads parados') + ' há 7+ dias'});
  if (!m.leadsNovos30) alertas.push({tom: 'frio', peso: 40, txt: 'Nenhum lead novo em 30 dias'});
  alertas.sort((a, b) => b.peso - a.peso);
  const gravidade = alertas.reduce((n, a) => n + a.peso, 0);
  const situacao = alertas.some(a => a.tom === 'alerta') ? 'alerta' : alertas.length ? 'atencao' : 'bom';
  return {feito, alvo, projecao, pctMeta, esperado, pctFaltas, alertas: alertas.map(({peso, ...a}) => a), gravidade, situacao};
}

/** Ordena (mais urgente primeiro) e escreve a frase que conclui a tela. */
export function resumoAgencia(empresas = [], opts = {}) {
  const linhas = empresas.map(e => ({...e, aval: avaliarEmpresa(e.metricas || {}, opts)}))
    .sort((a, b) => b.aval.gravidade - a.aval.gravidade || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  const alerta = linhas.filter(l => l.aval.situacao === 'alerta').length;
  const atencao = linhas.filter(l => l.aval.situacao === 'atencao').length;
  const total = linhas.reduce((n, l) => n + l.aval.feito, 0);
  let frase;
  if (!linhas.length) frase = 'Nenhuma empresa para acompanhar.';
  else if (!alerta && !atencao) frase = linhas.length === 1 ? 'A empresa está em dia.' : 'As ' + int(linhas.length) + ' empresas estão em dia.';
  else frase = [alerta ? plural(alerta, 'empresa pede ação hoje', 'empresas pedem ação hoje') : null, atencao ? plural(atencao, 'merece atenção', 'merecem atenção') : null].filter(Boolean).join(', ') + ' de ' + int(linhas.length) + '.';
  return {linhas, frase, alerta, atencao, faturamentoTotal: total};
}
