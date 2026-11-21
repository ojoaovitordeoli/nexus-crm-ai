// V62 — Agenda e Relatórios no padrão "Hoje": onde estão as faltas e a frase
// que conclui. Só agendamentos encerrados (compareceu ou faltou) entram na taxa.
const DIA = 86400000;
const ms = v => { const n = Date.parse(v || ''); return Number.isFinite(n) ? n : null; };
const low = v => String(v || '').toLowerCase();
const int = v => new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 0}).format(Number(v) || 0);
const plural = (n, um, varios) => int(n) + ' ' + (n === 1 ? um : varios);

export const DIAS = [['seg', 1], ['ter', 2], ['qua', 3], ['qui', 4], ['sex', 5], ['sáb', 6], ['dom', 0]];
export const PERIODOS = [['manhã', 0, 12], ['tarde', 12, 18], ['noite', 18, 24]];

/** Grade dia da semana × período com comparecimentos e faltas dos últimos N dias. */
export function mapaFaltas(appointments = [], {agora = Date.now(), dias = 90, baseMin = 3} = {}) {
  const desde = agora - dias * DIA;
  const celula = () => ({total: 0, faltas: 0, pct: null});
  const grade = DIAS.map(() => PERIODOS.map(celula));
  let total = 0, faltas = 0;
  for (const a of appointments) {
    const st = low(a?.status); if (st !== 'completed' && st !== 'no_show') continue;
    const t = ms(a.start_at); if (t === null || t < desde || t > agora) continue;
    const d = new Date(t), di = DIAS.findIndex(x => x[1] === d.getDay()), h = d.getHours();
    const pi = PERIODOS.findIndex(p => h >= p[1] && h < p[2]);
    const c = grade[di][pi]; c.total++; total++;
    if (st === 'no_show') { c.faltas++; faltas++; }
  }
  let pior = null;
  for (let i = 0; i < grade.length; i++) for (let j = 0; j < PERIODOS.length; j++) {
    const c = grade[i][j]; if (!c.total) continue;
    c.pct = Math.round(c.faltas / c.total * 100);
    if (c.total >= baseMin && c.faltas > 0 && (!pior || c.pct > pior.pct || (c.pct === pior.pct && c.total > pior.total))) pior = {dia: DIAS[i][0], periodo: PERIODOS[j][0], pct: c.pct, total: c.total, faltas: c.faltas};
  }
  const pct = total ? Math.round(faltas / total * 100) : null;
  let frase = null;
  if (total >= 5) {
    frase = pct + '% de faltas nos últimos ' + dias + ' dias (' + plural(faltas, 'falta', 'faltas') + ' em ' + plural(total, 'atendimento', 'atendimentos') + ').';
    if (pior && pior.pct >= Math.max(pct + 10, 20)) frase += ' A pior faixa é ' + pior.dia + ' de ' + pior.periodo + ': ' + pior.pct + '%. Confirme esses horários na véspera.';
  }
  // só mostra as linhas (dias) que têm algum atendimento, para não exibir domingo vazio
  const linhas = DIAS.map((d, i) => ({dia: d[0], celulas: grade[i]})).filter(l => l.celulas.some(c => c.total));
  return {linhas, total, faltas, pct, pior, frase, dias};
}

/** Frase do dia da Agenda. */
export function fraseAgenda({hoje = 0, aguardando = 0, mapa = null} = {}) {
  const partes = [hoje ? (hoje === 1 ? '1 atendimento hoje' : hoje + ' atendimentos hoje') : 'Nenhum atendimento hoje'];
  if (aguardando) partes.push(plural(aguardando, 'sem presença marcada', 'sem presença marcada'));
  if (mapa?.pct != null && mapa.total >= 5) partes.push(mapa.pct + '% de faltas em ' + mapa.dias + ' dias');
  return partes.join(' · ') + '.';
}
