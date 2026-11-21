// V60 — tela "Hoje": cálculos a partir dos registros reais já carregados.
// Nada é estimado sem dizer: projeção da meta é o ritmo médio do mês até hoje;
// funil e origem contam só leads criados na janela e o que está vinculado a eles.
const DIA = 86400000;
const ms = v => { const n = Date.parse(v || ''); return Number.isFinite(n) ? n : null; };
const low = v => String(v || '').toLowerCase();
const FECHADA = ['done', 'completed', 'cancelled', 'canceled'];
const int = v => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0}).format(Number(v) || 0);
export const brl = v => new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL', maximumFractionDigits: 0}).format(Number(v) || 0);
const plural = (n, um, varios) => int(n) + ' ' + (n === 1 ? um : varios);
const nome = c => [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim();
const dataVenda = s => s?.sale_date || s?.created_at;
function diaCal(v) { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]).getTime() : null; }
function inicioDia(agora) { const d = new Date(agora); d.setHours(0, 0, 0, 0); return d.getTime(); }
function hhmm(t) { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
export function whatsLink(v) { const n = String(v || '').replace(/\D/g, ''); return n.length >= 10 && n.length <= 13 ? 'https://wa.me/' + (n.length <= 11 ? '55' + n : n) : ''; }

/** Régua do dia: agendamentos de hoje em 2 faixas, com situação e a janela de horas. */
export function reguaDoDia(appointments = [], {agora = Date.now(), leadsPorId = new Map()} = {}) {
  const h0 = inicioDia(agora), h1 = h0 + DIA;
  const itens = [];
  for (const a of appointments) {
    const ini = ms(a?.start_at); if (ini === null || ini < h0 || ini >= h1) continue;
    const st = low(a.status); if (st === 'cancelled' || st === 'canceled') continue;
    let fim = ms(a.end_at); if (fim === null || fim <= ini) fim = ini + 45 * 60000;
    const situacao = st === 'completed' ? 'veio' : st === 'no_show' ? 'faltou' : fim < agora ? 'marcar' : 'vem';
    const lead = a.lead_id ? leadsPorId.get(a.lead_id) : null;
    itens.push({id: a.id, ini, fim, hora: hhmm(ini), titulo: a.title || 'Compromisso', pessoa: nome(lead?.contact), situacao, status: st});
  }
  itens.sort((x, y) => x.ini - y.ini);
  // 2 faixas: cada bloco vai para a primeira faixa livre (ou a que libera antes)
  const fimFaixa = [0, 0];
  for (const it of itens) { const f = fimFaixa[0] <= it.ini ? 0 : fimFaixa[1] <= it.ini ? 1 : (fimFaixa[0] <= fimFaixa[1] ? 0 : 1); it.faixa = f; fimFaixa[f] = Math.max(it.fim, it.ini + 50 * 60000); }
  let hIni = 8, hFim = 18;
  for (const it of itens) { hIni = Math.min(hIni, new Date(it.ini).getHours()); hFim = Math.max(hFim, Math.ceil((new Date(it.fim).getHours() * 60 + new Date(it.fim).getMinutes()) / 60)); }
  hFim = Math.min(24, Math.max(hFim, hIni + 4));
  const base = h0 + hIni * 3600000, total = (hFim - hIni) * 3600000;
  const pos = t => Math.max(0, Math.min(100, (t - base) / total * 100));
  for (const it of itens) { it.left = pos(it.ini); it.width = Math.max(9, pos(it.fim) - it.left); if (it.left + it.width > 100) it.left = 100 - it.width; }
  const conta = s => itens.filter(i => i.situacao === s).length;
  return {itens, hIni, hFim, agoraPct: agora >= base && agora <= base + total ? pos(agora) : null,
    contagem: {veio: conta('veio'), faltou: conta('faltou'), marcar: conta('marcar'), vem: conta('vem')}};
}

/** Fila "Agora": o que pede ação, cada item com o botão que resolve. */
export function filaAgora({appointments = [], tasks = [], leads = [], stages = []} = {}, {agora = Date.now(), max = 6} = {}) {
  const h0 = inicioDia(agora), lista = [];
  const leadsPorId = new Map(leads.map(l => [l.id, l]));
  // 1) Presença por marcar (passou e ninguém marcou)
  for (const a of appointments) {
    const st = low(a?.status); if (!['scheduled', 'confirmed'].includes(st)) continue;
    const fim = ms(a.end_at) ?? ms(a.start_at); if (fim === null || fim >= agora || fim < agora - 14 * DIA) continue;
    const lead = a.lead_id ? leadsPorId.get(a.lead_id) : null, quem = nome(lead?.contact);
    lista.push({id: 'ap:' + a.id, tipo: 'presenca', tom: 'atencao', peso: 90 + (fim > h0 ? 5 : 0), appointmentId: a.id, statusAntes: st,
      titulo: (quem ? quem + ': ' : '') + (a.title || 'agendamento') + ' — veio?',
      detalhe: (fim >= h0 ? 'Hoje ' + hhmm(ms(a.start_at)) : new Date(ms(a.start_at)).toLocaleDateString('pt-BR', {day: 'numeric', month: 'short'})) + ' · ninguém marcou a presença'});
  }
  // 2) Tarefas vencidas
  for (const t of tasks) {
    if (FECHADA.includes(low(t?.status))) continue;
    const d = diaCal(t.due_date); if (d === null || d >= h0) continue;
    const dias = Math.max(1, Math.round((h0 - d) / DIA)), lead = t.lead_id ? leadsPorId.get(t.lead_id) : null;
    lista.push({id: 'tk:' + t.id, tipo: 'tarefa', tom: 'alerta', peso: 80 + Math.min(9, dias), taskId: t.id, statusAntes: ['in_progress', 'pending'].includes(low(t.status)) ? low(t.status) : 'pending',
      titulo: t.title || 'Tarefa sem título', detalhe: 'Venceu há ' + plural(dias, 'dia', 'dias') + (nome(lead?.contact) ? ' · ' + nome(lead.contact) : ''),
      whatsapp: whatsLink(lead?.contact?.whatsapp)});
  }
  // 3) Leads quentes que chegaram nas últimas 48h e seguem sem etapa nova
  const fim = new Set(stages.filter(s => s?.is_won || s?.is_lost).map(s => s.id));
  const quentes = leads.filter(l => low(l?.temperature) === 'hot' && (ms(l.created_at) ?? 0) >= agora - 2 * DIA && !l.stage_changed_at && !fim.has(l.pipeline_stage_id));
  if (quentes.length) lista.push({id: 'quentes', tipo: 'grupo', tom: 'bom', peso: 70, href: '/leads',
    titulo: plural(quentes.length, 'lead quente chegou e espera resposta', 'leads quentes chegaram e esperam resposta'),
    detalhe: 'Nas últimas 48 horas · ' + [...new Set(quentes.map(l => l.source).filter(Boolean))].slice(0, 2).join(', ') || 'Nas últimas 48 horas', acao: 'Abrir leads'});
  // 4) Parados há 7+ dias
  const parados = leads.filter(l => {
    if (fim.has(l?.pipeline_stage_id) || l?.closed_at || ['won', 'lost'].includes(low(l?.status))) return false;
    const desde = ms(l?.stage_changed_at || l?.created_at); return desde !== null && agora - desde >= 7 * DIA;
  });
  if (parados.length) {
    const soma = parados.reduce((n, l) => n + (Number(l.estimated_value) || 0), 0);
    lista.push({id: 'parados', tipo: 'grupo', tom: 'frio', peso: 60, href: '/leads',
      titulo: plural(parados.length, 'lead parado', 'leads parados') + ' há 7 dias ou mais',
      detalhe: (soma > 0 ? brl(soma) + ' somados · ' : '') + 'chame no WhatsApp ou marque como perdido', acao: 'Revisar'});
  }
  lista.sort((a, b) => b.peso - a.peso);
  return {total: lista.length, itens: lista.slice(0, max).map(({peso, ...i}) => i)};
}

/** Mês contra a meta: acumulado por dia, projeção pelo ritmo e quanto falta por dia. */
export function mesMeta({sales = [], goal = null} = {}, {agora = Date.now()} = {}) {
  const d = new Date(agora), ano = d.getFullYear(), mes = d.getMonth();
  const diasMes = new Date(ano, mes + 1, 0).getDate(), hoje = d.getDate();
  const porDia = Array(diasMes).fill(0);
  for (const s of sales) {
    const t = diaCal(dataVenda(s)) ?? ms(dataVenda(s)); if (t === null) continue;
    const x = new Date(t); if (x.getFullYear() !== ano || x.getMonth() !== mes) continue;
    porDia[x.getDate() - 1] += Number(s.value) || 0;
  }
  const acumulado = []; let soma = 0;
  for (let i = 0; i < hoje; i++) { soma += porDia[i]; acumulado.push(soma); }
  const feito = soma, media = hoje ? feito / hoje : 0, projecao = Math.round(media * diasMes);
  const alvo = Number(goal?.target) > 0 ? Number(goal.target) : null;
  const restantes = diasMes - hoje;
  return {diasMes, hoje, acumulado, feito, media, projecao, alvo,
    esperadoHoje: alvo ? Math.round(alvo * hoje / diasMes) : null,
    atras: alvo ? Math.max(0, Math.round(alvo * hoje / diasMes - feito)) : null,
    porDiaPrecisa: alvo && restantes > 0 ? Math.max(0, Math.round((alvo - feito) / restantes)) : null,
    vendas: sales.filter(s => { const t = diaCal(dataVenda(s)) ?? ms(dataVenda(s)); if (t === null) return false; const x = new Date(t); return x.getFullYear() === ano && x.getMonth() === mes; }).length};
}

/** Funil da janela: chegaram → agendaram → vieram → compraram (só o que está vinculado ao lead). */
export function funilJanela({leads = [], appointments = [], sales = []} = {}, {agora = Date.now(), dias = 30} = {}) {
  const desde = agora - dias * DIA;
  const coorte = leads.filter(l => (ms(l?.created_at) ?? 0) >= desde);
  const ids = new Set(coorte.map(l => l.id));
  const agendou = new Set(), veio = new Set(), comprou = new Set(); let receita = 0;
  for (const a of appointments) { if (!ids.has(a?.lead_id) || ['cancelled', 'canceled'].includes(low(a.status))) continue; agendou.add(a.lead_id); if (low(a.status) === 'completed') veio.add(a.lead_id); }
  for (const s of sales) { if (!ids.has(s?.lead_id)) continue; comprou.add(s.lead_id); receita += Number(s.value) || 0; }
  const etapas = [
    {id: 'chegaram', rotulo: 'Chegaram', sub: 'leads novos', n: coorte.length},
    {id: 'agendaram', rotulo: 'Agendaram', sub: 'tem agendamento', n: agendou.size},
    {id: 'vieram', rotulo: 'Vieram', sub: 'compareceram', n: veio.size},
    {id: 'compraram', rotulo: 'Compraram', sub: brl(receita), n: comprou.size}
  ];
  let fraca = null;
  for (let i = 1; i < etapas.length; i++) {
    const base = etapas[i - 1].n; etapas[i].taxa = base ? Math.round(etapas[i].n / base * 100) : null;
    if (base >= 5 && (fraca === null || etapas[i].taxa < etapas[fraca].taxa)) fraca = i;
  }
  if (fraca !== null) etapas[fraca].fraca = true;
  const perdidos = fraca !== null ? etapas[fraca - 1].n - etapas[fraca].n : 0;
  const DICA = {agendaram: 'Ofereça dois horários já na primeira resposta.', vieram: 'Confirme no dia anterior pelo WhatsApp.', compraram: 'Faça o orçamento na hora do atendimento e combine o retorno.'};
  return {etapas, receita, dias, nota: fraca !== null && perdidos > 0 ? {etapa: etapas[fraca].rotulo.toLowerCase(), perdidos, de: etapas[fraca - 1].rotulo.toLowerCase(), dica: DICA[etapas[fraca].id]} : null};
}

/** O que traz venda: por origem, leads da janela, vendas vinculadas, conversão e receita. */
export function origemVenda({leads = [], sales = []} = {}, {agora = Date.now(), dias = 30} = {}) {
  const desde = agora - dias * DIA, mapa = new Map(), origemDoLead = new Map();
  for (const l of leads) {
    if ((ms(l?.created_at) ?? 0) < desde) continue;
    const o = String(l.source || '').trim() || 'Sem origem';
    origemDoLead.set(l.id, o);
    if (!mapa.has(o)) mapa.set(o, {origem: o, leads: 0, vendas: 0, receita: 0, compradores: new Set()});
    mapa.get(o).leads++;
  }
  for (const s of sales) { const o = origemDoLead.get(s?.lead_id); if (!o) continue; const g = mapa.get(o); g.compradores.add(s.lead_id); g.vendas++; g.receita += Number(s.value) || 0; }
  const linhas = [...mapa.values()].map(({compradores, ...g}) => ({...g, conversao: g.leads ? Math.round(compradores.size / g.leads * 100) : 0}))
    .sort((a, b) => b.receita - a.receita || b.leads - a.leads);
  const comBase = linhas.filter(l => l.leads >= 5);
  const melhor = comBase.length > 1 ? comBase.reduce((a, b) => b.conversao > a.conversao ? b : a) : null;
  const pior = comBase.length > 1 ? comBase.reduce((a, b) => b.conversao < a.conversao ? b : a) : null;
  let frase = null;
  if (melhor && pior && melhor !== pior && melhor.conversao > 0) {
    const x = pior.conversao ? Math.round(melhor.conversao / pior.conversao) : null;
    frase = melhor.origem + ' converte ' + (x && x >= 2 ? x + ' vezes mais que ' : 'mais que ') + pior.origem + '.';
  }
  if (melhor) melhor.melhor = true;
  return {linhas, frase, dias};
}

/** Manchete que conclui, em uma frase, a partir da meta e da fila. */
export function manchete({mes, fila}) {
  const n = fila?.itens?.filter(i => i.tom === 'alerta' || i.tom === 'atencao').length || 0;
  const coisas = n ? (n === 1 ? 'Uma coisa resolve hoje.' : (n === 2 ? 'Duas' : n === 3 ? 'Três' : int(n)) + ' coisas resolvem hoje.') : 'Nada atrasado agora.';
  if (mes?.alvo && mes.feito >= mes.alvo) return 'Meta do mês batida. ' + coisas;
  if (mes?.alvo && mes.atras > 0) return 'Você está ' + brl(mes.atras) + ' atrás da meta. ' + coisas;
  if (mes?.alvo) return 'A meta está no ritmo. ' + coisas;
  return n ? coisas : 'Tudo em dia por aqui.';
}
