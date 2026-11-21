// V52 — Campos por conversa. Traduz o pedido do assistente ("quero guardar o grau do cliente")
// para o formato dos campos extras que já existem (custom_fields), e formata valores para mostrar.
// Funções puras, testadas em tests/custom-fields-chat.test.mjs. A gravação continua em /api/crm-settings
// (só gerente/admin) e /api/operation (lead_field_set), com as mesmas validações de sempre.
import {validateField} from './crm-catalogs.mjs';
import {formatPhoneBR} from './format.mjs';

export const TIPOS_PT = {
  texto: 'text', numero: 'number', dinheiro: 'currency', sim_nao: 'checkbox',
  lista: 'select', varias_opcoes: 'multiselect', data: 'date', telefone: 'phone', email: 'email'
};
export const TIPO_ROTULO = {
  text: 'Texto', number: 'Número', currency: 'Dinheiro', checkbox: 'Sim/Não', select: 'Lista de opções',
  multiselect: 'Várias opções', date: 'Data', phone: 'Telefone', email: 'E-mail'
};
export const ONDE = {lead: 'lead', negocio: 'lead', atendimento: 'lead', contato: 'contact', pessoa: 'contact', cliente: 'contact'};
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Converte os argumentos da IA em campo validado. Devolve {data} ou {error}. */
export function prepararCampo(args) {
  const type = TIPOS_PT[norm(args?.tipo).replace(/[\s/-]+/g, '_')];
  if (!type) return {error: 'Tipo inválido. Use: ' + Object.keys(TIPOS_PT).join(', ') + '.'};
  const entity = ONDE[norm(args?.onde)] || 'lead';
  const options = Array.isArray(args?.opcoes) ? args.opcoes : String(args?.opcoes || '').split(/[;,\n]/);
  return validateField({name: args?.nome, type, entity_type: entity, options});
}

/** Frase da proposta que a pessoa confirma. */
export function resumoCampo(data) {
  const onde = data.entity_type === 'contact' ? 'na ficha do contato' : 'em cada lead';
  const opcoes = data.options?.length ? ' (opções: ' + data.options.join(', ') + ')' : '';
  return 'Criar o campo "' + data.name + '" — ' + TIPO_ROTULO[data.type] + opcoes + ' — ' + onde;
}

/** Mesmo nome (sem acento/maiúscula) no mesmo lugar = duplicado. */
export function campoDuplicado(existentes, data) {
  return (existentes || []).some(f => (f.entity_type || 'lead') === data.entity_type && norm(f.name) === norm(data.name));
}

/** Valor salvo (jsonb) → texto para mostrar. */
export function mostrarValor(field, value) {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && !value.length)) return '';
  switch (field?.type) {
    case 'checkbox': return value === true ? 'Sim' : 'Não';
    case 'currency': return new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format(Number(value) || 0);
    case 'number': return new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 2}).format(Number(value) || 0);
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? String(value).split('-').reverse().join('/') : String(value);
    case 'multiselect': return (Array.isArray(value) ? value : [value]).join(', ');
    case 'phone': return formatPhoneBR(String(value)) || String(value);
    default: return String(value);
  }
}

/** Descrição de requisito (formato de lib/stage-requirements) para validar um valor de campo extra. */
export const comoRequisito = field => ({key: 'cf:' + field.id, kind: 'custom', field: field.id, label: field.name,
  type: field.type, options: Array.isArray(field.options) ? field.options.map(String) : []});
