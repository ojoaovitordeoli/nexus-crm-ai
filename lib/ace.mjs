// Painel ACE (Atração → Conversão → Expansão), metodologia usada por agências de marketing para óticas.
// Só dados reais carregados: leads, agendamentos e vendas vinculados por lead_id/contact_id. Nada é estimado.

const DAY = 86400000;
const inPeriod = (value, since) => {
  const t = Date.parse(value || '');
  return Number.isFinite(t) && t >= since;
};
const pct = (part, total) => (total > 0 ? Math.round((1000 * part) / total) / 10 : null);

/**
 * @param {{leads?:any[],appointments?:any[],sales?:any[]}} data
 * @param {number} days período em dias (7, 30, 90)
 * @param {number} now  timestamp de referência (testes)
 */
export function aceSummary({ leads = [], appointments = [], sales = [] } = {}, days = 30, now = Date.now()) {
  const since = now - days * DAY;
  const periodLeads = leads.filter((l) => inPeriod(l.created_at, since));
  const leadIds = new Set(periodLeads.map((l) => l.id));

  // ---------- Atração ----------
  const bySource = new Map();
  for (const l of periodLeads) {
    const key = (l.source || '').trim() || 'Não informada';
    bySource.set(key, (bySource.get(key) || 0) + 1);
  }
  const sources = [...bySource.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'))
    .map(([name, count]) => ({ name, count, share: pct(count, periodLeads.length) }));
  const referred = periodLeads.filter((l) => l.referred_by_contact_id).length;

  // ---------- Conversão (coorte: leads que chegaram no período) ----------
  const apptByLead = new Map();
  for (const a of appointments) {
    if (!a.lead_id || !leadIds.has(a.lead_id)) continue;
    const list = apptByLead.get(a.lead_id) || [];
    list.push(a.status);
    apptByLead.set(a.lead_id, list);
  }
  const live = (s) => s !== 'cancelled' && s !== 'canceled';
  let scheduled = 0, attended = 0, noShow = 0;
  for (const statuses of apptByLead.values()) {
    const valid = statuses.filter(live);
    if (!valid.length) continue;
    scheduled += 1;
    if (valid.includes('completed')) attended += 1;
    else if (valid.includes('no_show')) noShow += 1;
  }
  const soldLeads = new Set(sales.filter((s) => s.lead_id && leadIds.has(s.lead_id)).map((s) => s.lead_id));
  const convertedRevenue = sales
    .filter((s) => s.lead_id && leadIds.has(s.lead_id))
    .reduce((t, s) => t + (Number(s.value) || 0), 0);

  // ---------- Expansão ----------
  // Recompra: cliente (contato) com 2+ vendas no total carregado e ao menos uma venda no período.
  const salesByContact = new Map();
  for (const s of sales) {
    const cid = s.contact_id || s.contact?.id;
    if (!cid) continue;
    const list = salesByContact.get(cid) || [];
    list.push(s);
    salesByContact.set(cid, list);
  }
  let repeatCustomers = 0, repeatRevenue = 0;
  for (const list of salesByContact.values()) {
    if (list.length < 2) continue;
    const ordered = [...list].sort((a, b) => Date.parse(a.sale_date || a.created_at || 0) - Date.parse(b.sale_date || b.created_at || 0));
    const later = ordered.slice(1).filter((s) => inPeriod(s.sale_date || s.created_at, since));
    if (!later.length) continue;
    repeatCustomers += 1;
    repeatRevenue += later.reduce((t, s) => t + (Number(s.value) || 0), 0);
  }
  const customers = [...salesByContact.values()].filter((list) => list.some((s) => inPeriod(s.sale_date || s.created_at, since))).length;

  return {
    days,
    attraction: { leads: periodLeads.length, sources, referred },
    conversion: {
      leads: periodLeads.length,
      scheduled, attended, noShow, sold: soldLeads.size, revenue: convertedRevenue,
      scheduleRate: pct(scheduled, periodLeads.length),
      attendanceRate: pct(attended, scheduled),
      noShowRate: pct(noShow, scheduled),
      saleRate: pct(soldLeads.size, periodLeads.length),
    },
    expansion: {
      referred,
      referredShare: pct(referred, periodLeads.length),
      customers,
      repeatCustomers,
      repeatRate: pct(repeatCustomers, customers),
      repeatRevenue,
    },
  };
}
