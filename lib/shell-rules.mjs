/**
 * Regras puras usadas pelo shell da área de trabalho (vendas, tarefas, login, busca).
 * Mantidas fora dos componentes para serem testadas com node --test.
 */

/**
 * Converte um valor digitado em reais para número.
 * Aceita "1500", "1.500", "1.500,50", "1500,5", "R$ 1.234,56" e "1500.75".
 * Devolve NaN para entradas ambíguas ou inválidas (nunca adivinha).
 */
export function parseBRL(input) {
  let text = String(input ?? '').replace(/R\$/gi, '').replace(/\s+/g, '');
  if (!text) return NaN;
  if (text.includes(',')) {
    if (!/^(\d{1,3}(\.\d{3})+|\d+),\d{1,2}$/.test(text)) return NaN;
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, ''); // "1.500" é mil e quinhentos no padrão brasileiro
  } else if (!/^\d+(\.\d{1,2})?$/.test(text)) {
    return NaN;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : NaN;
}

const pad = v => String(v).padStart(2, '0');
export const localDayKey = d => [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join('-');

/**
 * Dia (AAAA-MM-DD) de um prazo de tarefa. Prazo é data de calendário: "2026-11-09" e
 * "2026-11-09T00:00:00+00:00" (data salva como meia-noite UTC) são o dia 09 em qualquer fuso.
 * Demais horários são convertidos para o dia local.
 */
export function dueDayKey(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})(?:[T ]00:00(?::00(?:\.0+)?)?(?:Z|[+-]00(?::?00)?)?)?$/);
  if (m) return m[1];
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? '' : localDayKey(d);
}

/** Data local (meio-dia) do prazo, para exibição sem deslocamento de fuso. */
export function dueDate(value) {
  const key = dueDayKey(value);
  if (!key) return null;
  const [y, mo, d] = key.split('-').map(Number);
  return new Date(y, mo - 1, d, 12);
}

/** Traduz as mensagens de autenticação do Supabase mais comuns para português. */
export function authErrorMessage(error) {
  const raw = String(error?.message ?? error ?? '').trim();
  const text = raw.toLowerCase();
  if (!text) return 'Não foi possível concluir. Tente novamente.';
  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (text.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (text.includes('auth session missing') || text.includes('session not found') || text.includes('jwt expired'))
    return 'O link de recuperação expirou ou já foi usado. Solicite um novo em “Esqueci minha senha”.';
  if (text.includes('should be different')) return 'A nova senha deve ser diferente da atual.';
  if (text.includes('password should be at least') || text.includes('weak password')) return 'A senha é fraca. Use pelo menos 6 caracteres, combinando letras e números.';
  if (text.includes('rate limit') || text.includes('for security purposes') || text.includes('too many'))
    return 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.';
  if (text.includes('failed to fetch') || text.includes('network')) return 'Sem conexão com o servidor. Verifique a internet e tente novamente.';
  if (text.includes('user not found')) return 'Usuário não encontrado.';
  return raw;
}

/**
 * Termo de busca que identifica um contato nas listas. Contato sem nome usa o telefone;
 * sem nome nem telefone devolve '' (abre a lista sem filtro em vez de um filtro que nunca casa).
 */
export function contactSearchTerm(contact) {
  const name = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim();
  if (name) return name;
  return String(contact?.whatsapp || '').trim();
}
