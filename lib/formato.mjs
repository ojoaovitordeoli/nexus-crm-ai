// V57 — um formato de data só para as listas do NEXUS: "19 de nov." (ano atual) ou
// "19 de nov. de 2025" (outro ano). Data de calendário (AAAA-MM-DD, ex.: sale_date)
// é lida como dia local: new Date('2026-11-21') seria meia-noite UTC e viraria
// 20/11 no horário de Brasília.
const FMT = new Intl.DateTimeFormat('pt-BR', {day: 'numeric', month: 'short'});
const FMT_ANO = new Intl.DateTimeFormat('pt-BR', {day: 'numeric', month: 'short', year: 'numeric'});

export function lerData(v) {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (!v) return null;
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function dataCurta(v, {agora = new Date(), vazio = '—'} = {}) {
  const d = lerData(v);
  if (!d) return vazio;
  return (d.getFullYear() === agora.getFullYear() ? FMT : FMT_ANO).format(d);
}
