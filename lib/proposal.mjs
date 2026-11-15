// Proposta comercial gerada a partir da ficha do lead.
// Itens: produtos vinculados ao lead (catálogo da empresa) ou linhas digitadas pelo vendedor.
// Nada é inventado: sem item e sem valor, a proposta não é gerada.
import { formatPhoneBR } from './format.mjs';

export const MAX_ITEMS = 20;
const DAY = 86400000;

const clean = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function brl(n) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
}
export function dateBR(ts) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo' });
}

// Itens digitados: valida e normaliza. Retorna {items} ou {error}.
export function normalizeManualItems(raw) {
  if (!Array.isArray(raw)) return { items: [] };
  if (raw.length > MAX_ITEMS) return { error: `Use no máximo ${MAX_ITEMS} itens.` };
  const items = [];
  for (const [i, r] of raw.entries()) {
    const name = clean(r?.name ?? r?.description, 160);
    if (!name) continue;
    const qty = Number(r?.quantity ?? 1);
    const unitPrice = Number(r?.unit_price ?? r?.price);
    if (!Number.isFinite(qty) || qty <= 0 || qty > 100000) return { error: `Item ${i + 1}: quantidade inválida.` };
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || unitPrice > 100000000) return { error: `Item ${i + 1}: valor inválido.` };
    items.push({ name, quantity: qty, unit: clean(r?.unit, 20) || null, unitPrice: money(unitPrice) });
  }
  return { items };
}

// Itens do catálogo: lead_products (product_id, quantity) + products (id, name, price, unit) da MESMA empresa.
export function catalogItems(leadProducts = [], products = []) {
  const byId = new Map(products.map((p) => [p.id, p]));
  return leadProducts
    .map((lp) => {
      const p = byId.get(lp.product_id);
      if (!p) return null;
      return { name: clean(p.name, 160), quantity: Number(lp.quantity) || 1, unit: clean(p.unit, 20) || null, unitPrice: money(p.price) };
    })
    .filter(Boolean);
}

/**
 * Monta a proposta. Retorna {proposal} ou {error}.
 * items: já normalizados (manuais ou do catálogo). estimatedValue só é usado se não houver item.
 */
export function buildProposal({ organizationName, sellerName, lead, contact, items = [], estimatedValue, validityDays = 7, conditions, notes, now = Date.now() }) {
  let lines = items.map((it) => ({ ...it, total: money(it.quantity * it.unitPrice) }));
  if (!lines.length && Number(estimatedValue) > 0) {
    lines = [{ name: 'Proposta comercial', quantity: 1, unit: null, unitPrice: money(estimatedValue), total: money(estimatedValue) }];
  }
  if (!lines.length) return { error: 'Adicione ao menos um item com valor (ou informe o valor do lead) para gerar a proposta.' };
  const days = Math.min(Math.max(Math.round(Number(validityDays) || 7), 1), 90);
  const person = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim() || 'Cliente';
  const stamp = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  return {
    proposal: {
      number: `P-${stamp}-${String(lead?.id || '').replace(/-/g, '').slice(0, 6).toUpperCase()}`,
      issuedAt: now,
      validUntil: now + days * DAY,
      validityDays: days,
      company: clean(organizationName, 160) || 'Empresa',
      seller: clean(sellerName, 120) || null,
      client: {
        name: clean(person, 160),
        whatsapp: clean(contact?.whatsapp, 20) || null,
        email: clean(contact?.email, 200) || null,
        city: clean(contact?.city, 120) || null,
      },
      items: lines,
      total: money(lines.reduce((t, l) => t + l.total, 0)),
      conditions: clean(conditions, 600) || null,
      notes: clean(notes, 1200) || null,
    },
  };
}

// Texto curto para colar no WhatsApp.
export function proposalText(p) {
  const out = [
    `*Proposta ${p.number}* — ${p.company}`,
    `Para: ${p.client.name}`,
    '',
    ...p.items.map((i) => `• ${i.name}: ${i.quantity}${i.unit ? ' ' + i.unit : ''} × ${brl(i.unitPrice)} = ${brl(i.total)}`),
    '',
    `*Total: ${brl(p.total)}*`,
  ];
  if (p.conditions) out.push(`Condições: ${p.conditions}`);
  out.push(`Válida até ${dateBR(p.validUntil)}.`);
  if (p.notes) out.push('', p.notes);
  return out.join('\n');
}

// Nota que vai para o histórico do lead.
export function proposalNote(p) {
  return `Proposta ${p.number} gerada: ${brl(p.total)} (${p.items.length} ${p.items.length === 1 ? 'item' : 'itens'}), válida até ${dateBR(p.validUntil)}.`;
}

export function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Página para imprimir / salvar em PDF. Todo texto vindo de usuário passa por escapeHtml.
export function proposalHtml(p) {
  const e = escapeHtml;
  const rows = p.items
    .map((i) => `<tr><td>${e(i.name)}</td><td class="n">${e(i.quantity)}${i.unit ? ' ' + e(i.unit) : ''}</td><td class="n">${e(brl(i.unitPrice))}</td><td class="n">${e(brl(i.total))}</td></tr>`)
    .join('');
  const phone = p.client.whatsapp ? formatPhoneBR(p.client.whatsapp) || p.client.whatsapp : null;
  const contato = [phone, p.client.email, p.client.city].filter(Boolean).map(e).join(' · ');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Proposta ${e(p.number)} — ${e(p.client.name)}</title>
<style>
*{box-sizing:border-box}body{font-family:Archivo,Arial,sans-serif;color:#141417;margin:0;padding:32px;max-width:820px;margin-inline:auto;line-height:1.45}
header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:2px solid #5F00E6;padding-bottom:16px;margin-bottom:24px}
h1{font-size:22px;margin:0}small,.muted{color:#5c5c66}.num{text-align:right;font-size:13px}
h2{font-size:14px;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#5F00E6}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:10px 8px;border-bottom:1px solid #e3e3e8;text-align:left;vertical-align:top}
th{font-size:12px;color:#5c5c66;font-weight:600}.n{text-align:right;white-space:nowrap}
tfoot td{font-weight:700;font-size:16px;border-bottom:0}
.box{background:#f6f6f8;border-radius:8px;padding:12px 14px;font-size:14px;white-space:pre-wrap}
.actions{margin:24px 0 0;display:flex;gap:8px}.actions button{font:inherit;padding:10px 16px;border-radius:8px;border:1px solid #cdcdd5;background:#fff;cursor:pointer}
.actions button.primary{background:#5F00E6;color:#fff;border-color:#5F00E6}
@media print{.actions{display:none}body{padding:0}}
@media (max-width:560px){body{padding:16px}header{flex-direction:column}.num{text-align:left}th:nth-child(3),td:nth-child(3){display:none}}
</style></head><body>
<header><div><h1>${e(p.company)}</h1><small>Proposta comercial</small></div>
<div class="num"><strong>${e(p.number)}</strong><br><small>Emitida em ${e(dateBR(p.issuedAt))}</small><br><small>Válida até ${e(dateBR(p.validUntil))}</small></div></header>
<section><h2>Para</h2><div><strong>${e(p.client.name)}</strong>${contato ? `<br><small>${contato}</small>` : ''}</div></section>
<section><h2>Itens</h2><table><thead><tr><th>Descrição</th><th class="n">Qtd.</th><th class="n">Valor unit.</th><th class="n">Total</th></tr></thead>
<tbody>${rows}</tbody><tfoot><tr><td colspan="3">Total</td><td class="n">${e(brl(p.total))}</td></tr></tfoot></table></section>
${p.conditions ? `<section><h2>Condições</h2><div class="box">${e(p.conditions)}</div></section>` : ''}
${p.notes ? `<section><h2>Observações</h2><div class="box">${e(p.notes)}</div></section>` : ''}
${p.seller ? `<p class="muted">Atendimento: ${e(p.seller)}</p>` : ''}
<div class="actions"><button class="primary" type="button" onclick="window.print()">Imprimir ou salvar em PDF</button><button type="button" onclick="window.close()">Fechar</button></div>
</body></html>`;
}
