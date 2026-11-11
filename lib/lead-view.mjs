// Regras puras de exibição de leads e contatos (busca, WhatsApp e rótulos).
// Sem rede nem banco: testadas em tests/lead-view.test.mjs.

// Texto comparável: sem acento, minúsculo e com espaços normalizados.
export const simplify=v=>String(v??'').normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toLocaleLowerCase('pt-BR').replace(/\s+/g,' ').trim();
const digitsOf=v=>String(v??'').replace(/\D/g,'');

// Link wa.me a partir do telefone digitado.
// - Com "+" ou "00" na frente: número internacional já com DDI (8 a 15 dígitos, E.164).
// - Sem DDI: zeros de discagem à esquerda (0xx) são removidos; 10 ou 11 dígitos = Brasil (DDD + número).
// - 12 ou 13 dígitos: número já com DDI (ex.: 55 + DDD + número).
// Qualquer outra coisa é inválida e não gera link.
export function whatsappDigits(raw){
  const text=String(raw??'').trim();
  if(!text)return '';
  if(/^(\+|00)/.test(text)){
    const d=digitsOf(text).replace(/^00/,'');
    return d.length>=8&&d.length<=15&&d[0]!=='0'?d:'';
  }
  const d=digitsOf(text).replace(/^0+/,'');
  if(d.length===10||d.length===11)return '55'+d;
  if(d.length===12||d.length===13)return d;
  return '';
}
export const whatsappUrl=raw=>{const d=whatsappDigits(raw);return d?'https://wa.me/'+d:''};

// Busca sem acento por texto e, quando o termo é um número, também por dígitos do telefone
// ("11987654321" encontra "(11) 98765-4321" e "+55 11 98765-4321").
export function matchesSearch(query,texts=[],phones=[]){
  const term=simplify(query);
  if(!term)return true;
  if(simplify(texts.concat(phones).join(' ')).includes(term))return true;
  const qd=digitsOf(query);
  if(qd.length<3||!/^[\d\s()+.\-]+$/.test(String(query).trim()))return false;
  return phones.some(p=>{
    const pd=digitsOf(p);
    return pd.includes(qd)||(qd.startsWith('55')&&qd.length>4&&pd.includes(qd.slice(2)))||whatsappDigits(p).includes(qd);
  });
}

// Rótulos em português para códigos de status e temperatura gravados no banco.
const LABELS={active:'Ativo',new:'Novo',open:'Aberto',pending:'Pendente',won:'Ganho',lost:'Perdido',
  qualified:'Qualificado',contacted:'Contatado',negotiation:'Negociação',followup:'Retorno',
  in_progress:'Em andamento',completed:'Concluído',cancelled:'Cancelado',archived:'Arquivado',
  hot:'Quente',warm:'Morno',cold:'Frio'};
export function codeLabel(value,empty='Não informado'){
  const raw=String(value??'').trim();
  if(!raw)return empty;
  const known=LABELS[raw.toLowerCase()];
  if(known)return known;
  const text=raw.replace(/[_-]+/g,' ').trim();
  return text.charAt(0).toLocaleUpperCase('pt-BR')+text.slice(1);
}
