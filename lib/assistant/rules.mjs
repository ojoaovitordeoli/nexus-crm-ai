// Regras puras do Assistente NEXUS (testáveis sem rede nem banco).

export const TZ='America/Sao_Paulo';
export const MAX_HISTORY=12, MAX_MESSAGE_CHARS=2000, MAX_STEPS=5;

/** Data local (AAAA-MM-DD) e hora no fuso da operação. */
export function nowInSaoPaulo(date=new Date()){
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false,weekday:'long'}).formatToParts(date).map(p=>[p.type,p.value]));
  const weekday=new Intl.DateTimeFormat('pt-BR',{timeZone:TZ,weekday:'long'}).format(date);
  return {date:parts.year+'-'+parts.month+'-'+parts.day,time:(parts.hour==='24'?'00':parts.hour)+':'+parts.minute,weekday};
}
/** "2026-11-13T10:00" (horário de Brasília) -> ISO UTC. Brasil sem horário de verão desde 2019: UTC-3. */
export function saoPauloLocalToISO(local){
  const m=/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/.exec(String(local||'').trim());
  if(!m)return null;
  const [,y,mo,d,h='09',mi='00']=m;
  const dt=new Date(Date.UTC(+y,+mo-1,+d,+h+3,+mi));
  if(Number.isNaN(dt.getTime())||dt.getUTCFullYear()<2000||dt.getUTCFullYear()>2100)return null;
  // Confere que a data existe (31/02 vira março e é recusada)
  const back=new Date(dt.getTime()-3*3600000);
  if(back.getUTCDate()!==+d||back.getUTCMonth()!==+mo-1)return null;
  return dt.toISOString();
}
export function isISODate(v){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v||''));if(!m)return false;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));return d.getUTCDate()===+m[3]&&d.getUTCMonth()===+m[2]-1;
}

/** Histórico vindo do navegador: só texto de usuário/assistente, cortado e limitado. */
export function sanitizeHistory(raw){
  if(!Array.isArray(raw))return [];
  const out=raw.filter(m=>m&&(m.role==='user'||m.role==='assistant')&&typeof m.content==='string'&&m.content.trim())
    .slice(-MAX_HISTORY).map(m=>({role:m.role,content:m.content.slice(0,MAX_MESSAGE_CHARS)}));
  // A conversa precisa começar com o usuário e terminar com o usuário
  while(out.length&&out[0].role!=='user')out.shift();
  return out.length&&out[out.length-1].role==='user'?out:[];
}

const READ=['resumo_do_dia','buscar_cliente','ver_funil','ver_vendas','leads_parados','ajuda_nexus'];
const WRITE=['propor_tarefa','propor_compromisso','propor_mover_etapa','propor_venda','propor_lead'];
/** Ferramentas oferecidas conforme o papel. Somente leitura não recebe propostas de ação. */
export function toolNamesFor(role){
  return role==='VIEWER'||!role?[...READ]:[...READ,...WRITE];
}

/** Limite simples em memória por empresa e por usuário (complementa o limite de gasto no provedor). */
export function createRateLimiter({perUserPerMinute=12,perOrgPerHour=200}={}){
  const hits=new Map();
  const take=(key,limit,windowMs,now)=>{
    const arr=(hits.get(key)||[]).filter(t=>now-t<windowMs);
    if(arr.length>=limit){hits.set(key,arr);return false}
    arr.push(now);hits.set(key,arr);return true;
  };
  return (orgId,userId,now=Date.now())=>{
    if(!take('u:'+userId,perUserPerMinute,60000,now))return 'Muitas perguntas seguidas. Espere um minuto.';
    if(!take('o:'+orgId,perOrgPerHour,3600000,now))return 'A empresa atingiu o limite de uso do assistente nesta hora.';
    return '';
  };
}

/** Escolhe um único registro pelo nome; ambíguo ou ausente vira explicação. */
export function pickOne(rows,label,term){
  if(!rows.length)return {error:'Não encontrei '+label+' com "'+term+'".'};
  if(rows.length>1)return {error:'Encontrei '+rows.length+' '+label+'s com "'+term+'": '+rows.slice(0,5).map(r=>r.__label).join('; ')+'. Qual deles?'};
  return {item:rows[0]};
}
