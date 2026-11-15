// Indicação (Expansão da metodologia ACE): quem indicou cada lead e quem mais indica.

// A coluna leads.referred_by_contact_id só existe depois da migração 20261116_leads_indicacao.sql.
export const REFERRAL_PENDING_MESSAGE =
  'A indicação ainda não está ativa nesta instalação: falta aplicar a atualização do banco (20261116_leads_indicacao).';

// Erro do Postgres/PostgREST por coluna inexistente (antes da migração).
export function isMissingReferralColumn(error) {
  if (!error) return false;
  const text = [error.code, error.message, error.details, error.hint].filter(Boolean).join(' ');
  return error.code === '42703' || error.code === 'PGRST204' || /referred_by_contact_id/.test(text);
}

// Validação do lado do servidor. referrer = linha do contato indicador já buscada
// NA MESMA EMPRESA (ou null se não achou). Retorna mensagem de erro ou null.
export function referralError({ leadContactId, referrerId, referrer }) {
  if (!referrerId) return null;
  if (String(referrerId) === String(leadContactId)) return 'O contato não pode indicar a si mesmo.';
  if (!referrer) return 'Quem indicou precisa ser um contato desta empresa.';
  return null;
}

const nameOf = (c) => [c?.first_name, c?.last_name].filter(Boolean).join(' ').trim() || 'Contato sem nome';

// Ranking de quem mais indica, só com dados reais carregados:
// leads indicados, quantos viraram venda (venda com lead_id) e o valor dessas vendas.
export function referralRanking({ leads = [], sales = [], contacts = [] } = {}) {
  const contactById = new Map(contacts.map((c) => [c.id, c]));
  const salesByLead = new Map();
  for (const s of sales) {
    if (!s.lead_id) continue;
    const cur = salesByLead.get(s.lead_id) || { count: 0, value: 0 };
    cur.count += 1;
    cur.value += Number(s.value) || 0;
    salesByLead.set(s.lead_id, cur);
  }
  const byReferrer = new Map();
  for (const lead of leads) {
    const ref = lead.referred_by_contact_id;
    if (!ref) continue;
    const row = byReferrer.get(ref) || { contact_id: ref, name: nameOf(contactById.get(ref)), leads: 0, converted: 0, value: 0 };
    row.leads += 1;
    const sale = salesByLead.get(lead.id);
    if (sale) {
      row.converted += 1;
      row.value += sale.value;
    }
    byReferrer.set(ref, row);
  }
  return [...byReferrer.values()].sort((a, b) => b.leads - a.leads || b.value - a.value || a.name.localeCompare(b.name, 'pt-BR'));
}
