// V61 — Leads no padrão "Hoje": o resumo que conclui, os atalhos de filtro e o
// próximo passo de cada lead. Só a partir dos registros carregados e vinculados.
const DIA = 86400000;
const ms = v => { const n = Date.parse(v || ''); return Number.isFinite(n) ? n : null; };
const low = v => String(v || '').toLowerCase();
const FECHADA = ['done', 'completed', 'cancelled', 'canceled'];
const int = v => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0}).format(Number(v) || 0);
const plural = (n, um, varios) => int(n) + ' ' + (n === 1 ? um : varios);
function diaCal(v) { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null; }
function inicioDia(agora) { const d = new Date(agora); d.setHours(0, 0, 0, 0); return d.getTime(); }
const quando = t => new Date(t).toLocaleString('pt-BR', {weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'});

export function fechado(lead, stages = []) {
  const st = stages.find(s => s.id === lead?.pipeline_stage_id);
  return Boolean(st?.is_won || st?.is_lost || lead?.closed_at || ['won', 'lost'].includes(low(lead?.status)));
}
export function diasParado(lead, agora = Date.now()) {
  const t = ms(lead?.stage_changed_at || lead?.created_at); return t === null ? null : Math.max(0, Math.floor((agora - t) / DIA));
}

/** Índices por lead: tarefas abertas e agendamentos não cancelados. */
export function vinculos({tasks = [], appointments = []} = {}) {
  const t = new Map(), a = new Map();
  for (const x of tasks) if (x?.lead_id && !FECHADA.includes(low(x.status))) (t.get(x.lead_id) || t.set(x.lead_id, []).get(x.lead_id)).push(x);
  for (const x of appointments) if (x?.lead_id && !['cancelled', 'canceled'].includes(low(x.status))) (a.get(x.lead_id) || a.set(x.lead_id, []).get(x.lead_id)).push(x);
  return {tarefas: t, agenda: a};
}

/** Classificação de cada lead aberto para os atalhos. */
export function marcas(lead, {stages = [], idx, agora = Date.now()} = {}) {
  if (fechado(lead, stages)) return {aberto: false};
  const dias = diasParado(lead, agora);
  const temTarefa = (idx?.tarefas.get(lead.id) || []).length > 0;
  const temAgenda = (idx?.agenda.get(lead.id) || []).some(a => (ms(a.start_at) ?? 0) >= agora && ['scheduled', 'confirmed'].includes(low(a.status)));
  return {aberto: true, quente: low(lead.temperature) === 'hot', parado: dias !== null && dias >= 7, semRetorno: !temTarefa && !temAgenda, dias};
}

export function resumoLeads(leads = [], {stages = [], tasks = [], appointments = [], agora = Date.now()} = {}) {
  const idx = vinculos({tasks, appointments});
  const c = {abertos: 0, quentes: 0, parados: 0, semRetorno: 0};
  for (const l of leads) { const m = marcas(l, {stages, idx, agora}); if (!m.aberto) continue; c.abertos++; if (m.quente) c.quentes++; if (m.parado) c.parados++; if (m.semRetorno) c.semRetorno++; }
  const partes = [];
  if (c.semRetorno) partes.push(plural(c.semRetorno, 'sem próximo passo marcado', 'sem próximo passo marcado'));
  if (c.parados) partes.push(plural(c.parados, 'parado', 'parados') + ' há 7 dias ou mais');
  if (c.quentes) partes.push(plural(c.quentes, 'quente', 'quentes'));
  const frase = !c.abertos ? 'Nenhum lead aberto.' : plural(c.abertos, 'lead aberto', 'leads abertos') + (partes.length ? '. ' + partes.join(', ') + '.' : ', todos com próximo passo.');
  return {...c, frase, idx};
}

/** Próximo passo de um lead: o que fazer agora e com que botão. */
export function proximoPasso(lead, {stages = [], tasks = [], appointments = [], idx, agora = Date.now()} = {}) {
  const v = idx || vinculos({tasks, appointments});
  if (fechado(lead, stages)) return {tom: 'bom', titulo: 'Negócio encerrado', detalhe: 'Este lead está numa etapa de ganho ou perda.', acao: null};
  const h0 = inicioDia(agora);
  const ags = (v.agenda.get(lead.id) || []).slice().sort((a, b) => (ms(a.start_at) ?? 0) - (ms(b.start_at) ?? 0));
  const semPresenca = ags.find(a => ['scheduled', 'confirmed'].includes(low(a.status)) && ((ms(a.end_at) ?? ms(a.start_at)) ?? Infinity) < agora);
  if (semPresenca) return {tom: 'atencao', titulo: 'Marque a presença', detalhe: (semPresenca.title || 'Agendamento') + ' de ' + quando(ms(semPresenca.start_at)) + ' ainda sem presença marcada.', acao: 'presenca', appointmentId: semPresenca.id, statusAntes: low(semPresenca.status)};
  const tfs = (v.tarefas.get(lead.id) || []).slice().sort((a, b) => (diaCal(a.due_date) ?? Infinity) - (diaCal(b.due_date) ?? Infinity));
  const vencida = tfs.find(t => diaCal(t.due_date) !== null && diaCal(t.due_date) < h0);
  if (vencida) { const d = Math.max(1, Math.round((h0 - diaCal(vencida.due_date)) / DIA)); return {tom: 'alerta', titulo: 'Retorno atrasado', detalhe: (vencida.title || 'Tarefa') + ' venceu há ' + plural(d, 'dia', 'dias') + '.', acao: 'tarefa', taskId: vencida.id, statusAntes: ['in_progress', 'pending'].includes(low(vencida.status)) ? low(vencida.status) : 'pending'}; }
  const futuro = ags.find(a => (ms(a.start_at) ?? 0) >= agora && ['scheduled', 'confirmed'].includes(low(a.status)));
  if (futuro) return {tom: 'bom', titulo: low(futuro.status) === 'confirmed' ? 'Agendamento confirmado' : 'Agendado, confirme antes', detalhe: (futuro.title || 'Agendamento') + ' em ' + quando(ms(futuro.start_at)) + '.', acao: low(futuro.status) === 'confirmed' ? null : 'confirmar'};
  const proxima = tfs[0];
  if (proxima) return {tom: 'info', titulo: 'Próximo retorno marcado', detalhe: (proxima.title || 'Tarefa') + (diaCal(proxima.due_date) !== null ? ' para ' + new Date(diaCal(proxima.due_date)).toLocaleDateString('pt-BR', {weekday: 'short', day: 'numeric', month: 'short'}) : ', sem data') + '.', acao: null};
  const dias = diasParado(lead, agora);
  if (dias !== null && dias >= 7) return {tom: 'alerta', titulo: 'Parado há ' + plural(dias, 'dia', 'dias'), detalhe: 'Sem retorno nem agendamento. Chame no WhatsApp e marque o próximo passo.', acao: 'retorno'};
  return {tom: 'atencao', titulo: 'Sem próximo passo', detalhe: 'Marque um retorno para este lead não esfriar.', acao: 'retorno'};
}
