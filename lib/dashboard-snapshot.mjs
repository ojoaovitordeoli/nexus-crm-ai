/**
 * Regras puras para indicadores da página inicial do NEXUS.
 * O endpoint pode devolver totais paginados e apenas uma amostra de linhas.
 * Não apresente métricas da amostra como totais de toda a empresa.
 */
export function normalizeLeadSearch(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}
export function getSnapshotCoverage(counts = {}, data = {}) {
  return {
    leads: Number(counts?.leads || 0) > (Array.isArray(data?.leads) ? data.leads.length : 0),
    sales: Number(counts?.sales || 0) > (Array.isArray(data?.sales) ? data.sales.length : 0),
    tasks: Number(counts?.tasks || 0) > (Array.isArray(data?.tasks) ? data.tasks.length : 0)
  };
}
