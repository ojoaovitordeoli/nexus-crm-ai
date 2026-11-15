// Notificações da prospecção automática (V34).
// Regras puras + núcleo das rotas, sem acesso direto ao banco: as rotas em
// app/api/prospecting-alerts passam um "store" (Supabase com service_role) e os testes,
// um store em memória com duas empresas. A barreira real é este servidor.
import {createHash,randomBytes} from 'node:crypto';
import {canManageTeam} from './team-rules.mjs';

export const SOURCES={harvey_email:'E-mail (Harvey)',whatsapp_agent:'Agente de WhatsApp'};
export const CHANNEL_OF={harvey_email:'email',whatsapp_agent:'whatsapp'};
export const KINDS={interesse:'Interesse',pergunta:'Pergunta',objecao:'Objeção',venda:'Venda',lead_quente:'Lead quente',outro:'Outro'};
export const STATUSES={novo:'Novo',em_atendimento:'Em atendimento',resolvido:'Resolvido',descartado:'Descartado'};
export const MAX_BATCH=50;
export const MAX_BODY_BYTES=64*1024;
const TOKEN_PREFIX='nxp_';

/** Quem vê e trata os avisos: Admin da empresa, Admin da agência ou Super Admin. */
export function canSeeProspecting({isSuperAdmin=false,role=''}={}){
  return canManageTeam({isSuperAdmin,role});
}

export function generateIngestToken(){
  const token=TOKEN_PREFIX+randomBytes(32).toString('base64url');
  return {token,hash:hashIngestToken(token),hint:token.slice(-6)};
}
export function hashIngestToken(token){
  return createHash('sha256').update(String(token),'utf8').digest('hex');
}
/** Extrai o token do cabeçalho Authorization: Bearer nxp_... (formato estrito). */
export function readIngestToken(header){
  const m=/^Bearer\s+(nxp_[A-Za-z0-9_-]{43})$/.exec(String(header||'').trim());
  return m?m[1]:null;
}

const clean=(v,max)=>{
  if(v===undefined||v===null)return null;
  const s=String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,'').trim();
  return s?s.slice(0,max):null;
};
/** Telefone só com dígitos, com DDI 55 quando vier no formato nacional (10–11 dígitos). */
export function normalizePhone(value){
  const d=String(value||'').replace(/\D/g,'');
  if(d.length===10||d.length===11)return '55'+d;
  if(d.length>=12&&d.length<=15)return d;
  return null;
}
export function whatsAppLink(phone){
  const d=normalizePhone(phone);
  return d?'https://wa.me/'+d:null;
}

/** Valida um aviso vindo do vigia. Não confia em organização, status nem quem tratou. */
export function validateAlert(input,{now=new Date()}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,error:'Aviso inválido.'};
  const source=String(input.source||'');
  if(!SOURCES[source])return {ok:false,error:'source deve ser harvey_email ou whatsapp_agent.'};
  const kind=String(input.kind||'');
  if(!KINDS[kind])return {ok:false,error:'kind inválido. Use: '+Object.keys(KINDS).join(', ')+'.'};
  const external_id=clean(input.external_id,200);
  if(!external_id)return {ok:false,error:'external_id é obrigatório (id único do e-mail ou da conversa).'};
  const contact_email=clean(input.contact_email,254);
  if(contact_email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact_email))return {ok:false,error:'contact_email inválido.'};
  let contact_phone=null;
  if(input.contact_phone!==undefined&&input.contact_phone!==null&&String(input.contact_phone).trim()){
    contact_phone=normalizePhone(input.contact_phone);
    if(!contact_phone)return {ok:false,error:'contact_phone inválido (use DDD + número).'};
  }
  const company_name=clean(input.company_name,200),contact_name=clean(input.contact_name,200);
  if(!company_name&&!contact_name&&!contact_email&&!contact_phone)return {ok:false,error:'Informe ao menos empresa, contato, e-mail ou telefone.'};
  let occurred_at=now.toISOString();
  if(input.occurred_at){
    const t=Date.parse(input.occurred_at);
    if(Number.isNaN(t))return {ok:false,error:'occurred_at inválido (use ISO 8601).'};
    if(t>now.getTime()+5*60*1000)return {ok:false,error:'occurred_at no futuro.'};
    occurred_at=new Date(t).toISOString();
  }
  return {ok:true,value:{source,channel:CHANNEL_OF[source],kind,external_id,company_name,contact_name,
    contact_email:contact_email?contact_email.toLowerCase():null,contact_phone,
    message_excerpt:clean(input.message,2000),occurred_at}};
}

/** Corpo do POST do vigia: um aviso ou {alerts:[...]} (até 50). */
export function parseIngestBody(body,opts){
  if(body&&typeof body==='object'&&!Array.isArray(body)&&('totals' in body)&&!('alerts' in body))return {ok:true,rows:[],errors:[]};
  const list=Array.isArray(body?.alerts)?body.alerts:(body&&typeof body==='object'&&!Array.isArray(body)?[body]:null);
  if(!list||!list.length)return {ok:false,error:'Envie um aviso ou {"alerts":[...]}.'};
  if(list.length>MAX_BATCH)return {ok:false,error:'Máximo de '+MAX_BATCH+' avisos por envio.'};
  const rows=[],errors=[];
  list.forEach((item,index)=>{const v=validateAlert(item,opts);if(v.ok)rows.push(v.value);else errors.push({index,error:v.error})});
  return {ok:true,rows,errors};
}

export const CHANNELS={email:'E-mail',whatsapp:'WhatsApp'};
const COUNT_MAX=10_000_000;
/** Totais acumulados de um canal, calculados no PC do dono e mandados pelo vigia. */
export function validateTotals(input,{now=new Date()}={}){
  if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,error:'Totais inválidos.'};
  const channel=String(input.channel||'');
  if(!CHANNELS[channel])return {ok:false,error:'channel deve ser email ou whatsapp.'};
  const out={channel};
  for(const k of ['sent','replied','interested','sales']){
    const n=input[k]===undefined?0:input[k];
    if(!Number.isInteger(n)||n<0||n>COUNT_MAX)return {ok:false,error:k+' deve ser inteiro de 0 a '+COUNT_MAX+'.'};
    out[k]=n;
  }
  const rev=input.revenue===undefined?0:input.revenue;
  if(typeof rev!=='number'||!Number.isFinite(rev)||rev<0||rev>1_000_000_000)return {ok:false,error:'revenue deve ser valor em reais, de 0 a 1 bilhão.'};
  out.revenue_cents=Math.round(rev*100);
  let measured=now.toISOString();
  if(input.measured_at){
    const t=Date.parse(input.measured_at);
    if(Number.isNaN(t)||t>now.getTime()+5*60*1000)return {ok:false,error:'measured_at inválido.'};
    measured=new Date(t).toISOString();
  }
  out.measured_at=measured;
  return {ok:true,value:out};
}
export function presentTotals(rows){
  const by=Object.fromEntries((rows||[]).map(r=>[r.channel,r]));
  const line=c=>{const r=by[c];return {channel:c,label:CHANNELS[c],sent:r?.sent||0,replied:r?.replied||0,interested:r?.interested||0,
    sales:r?.sales||0,revenue:Number(r?.revenue_cents||0)/100,measured_at:r?.measured_at||null}};
  const lines=['email','whatsapp'].map(line);
  const total={channel:'total',label:'Total',measured_at:null};
  for(const k of ['sent','replied','interested','sales','revenue'])total[k]=lines.reduce((a,l)=>a+l[k],0);
  return {available:rows!==null,lines,total};
}

/** Formato devolvido para a tela (nunca inclui token ou campos internos). */
export function presentAlert(a){
  return {id:a.id,source:a.source,source_label:SOURCES[a.source]||a.source,channel:a.channel,
    kind:a.kind,kind_label:KINDS[a.kind]||a.kind,status:a.status,status_label:STATUSES[a.status]||a.status,
    company_name:a.company_name||'',contact_name:a.contact_name||'',contact_email:a.contact_email||'',
    contact_phone:a.contact_phone||'',whatsapp_url:whatsAppLink(a.contact_phone),
    mail_url:a.contact_email?'mailto:'+a.contact_email:null,
    message:a.message_excerpt||'',occurred_at:a.occurred_at,handled_at:a.handled_at||null};
}

export function parseListFilters(params){
  const status=params.get('status')||'open',channel=params.get('channel')||'all';
  if(!['open','all',...Object.keys(STATUSES)].includes(status))return {ok:false,error:'Filtro de situação inválido.'};
  if(!['all','email','whatsapp'].includes(channel))return {ok:false,error:'Filtro de canal inválido.'};
  return {ok:true,value:{status,channel}};
}

// ---------- núcleo das rotas (store injetado) ----------
// store: findActiveToken(hash) → {id,organization_id}|null; touchToken(id);
//        insertAlerts(orgId,tokenId,rows) → {inserted}; listAlerts(orgId,filters) → rows;
//        updateAlertStatus(orgId,id,patch) → row|null; listTokens(orgId); createToken(orgId,row); revokeTokens(orgId);
//        upsertTotals(orgId,tokenId,rows); listTotals(orgId) → rows|null (null = tabela não instalada); audit(entry)

export async function ingestAlerts({store,authorization,body,now}){
  const token=readIngestToken(authorization);
  if(!token)return {status:401,body:{error:'Token ausente ou em formato inválido.'}};
  const found=await store.findActiveToken(hashIngestToken(token));
  if(!found)return {status:401,body:{error:'Token inválido ou revogado.'}};
  const parsed=parseIngestBody(body,{now});
  if(!parsed.ok)return {status:400,body:{error:parsed.error}};
  let totals=[];
  if(body&&'totals' in body){
    if(!Array.isArray(body.totals)||!body.totals.length||body.totals.length>2)return {status:400,body:{error:'totals deve ser uma lista com 1 ou 2 canais.'}};
    for(const [i,t] of body.totals.entries()){
      const v=validateTotals(t,{now});
      if(!v.ok)return {status:400,body:{error:'totals['+i+']: '+v.error}};
      totals.push(v.value);
    }
    if(new Set(totals.map(t=>t.channel)).size!==totals.length)return {status:400,body:{error:'Canal repetido em totals.'}};
  }
  if(!parsed.rows.length&&!totals.length)return {status:400,body:{error:'Nenhum aviso válido.',rejected:parsed.errors}};
  // A empresa vem do token. Qualquer organization_id no corpo é ignorado.
  const {inserted}=parsed.rows.length?await store.insertAlerts(found.organization_id,found.id,parsed.rows):{inserted:0};
  if(totals.length)await store.upsertTotals(found.organization_id,found.id,totals);
  await store.touchToken(found.id);
  return {status:200,body:{ok:true,received:parsed.rows.length,created:inserted,duplicates:parsed.rows.length-inserted,rejected:parsed.errors,totals_saved:totals.length}};
}

export async function listForMember({store,access,orgId,filters}){
  if(!canSeeProspecting(access))return {status:403,body:{error:'Só o administrador da empresa vê as notificações da prospecção.'}};
  const rows=await store.listAlerts(orgId,filters);
  const tokens=await store.listTokens(orgId);
  const totals=await store.listTotals(orgId);
  return {status:200,body:{alerts:rows.map(presentAlert),totals:presentTotals(totals),
    connection:{active:tokens.length>0,hint:tokens[0]?.token_hint||'',last_used_at:tokens[0]?.last_used_at||null}}};
}

export async function changeStatus({store,access,orgId,actorId,alertId,status,now=new Date()}){
  if(!canSeeProspecting(access))return {status:403,body:{error:'Só o administrador da empresa trata as notificações.'}};
  if(!STATUSES[status])return {status:400,body:{error:'Situação inválida.'}};
  if(!/^[0-9a-f-]{36}$/i.test(String(alertId||'')))return {status:400,body:{error:'Aviso inválido.'}};
  const done=status==='novo'?{handled_by:null,handled_at:null}:{handled_by:actorId,handled_at:now.toISOString()};
  const row=await store.updateAlertStatus(orgId,alertId,{status,...done});
  if(!row)return {status:404,body:{error:'Aviso não encontrado nesta empresa.'}};
  await store.audit({user_id:actorId,organization_id:orgId,action:'prospecting_alert.status',entity_type:'prospecting_alert',entity_id:alertId,after:{status}});
  return {status:200,body:{ok:true,alert:presentAlert(row),message:'Situação atualizada: '+STATUSES[status]+'.'}};
}

/** Gera um token novo e revoga os anteriores. O token aparece uma única vez. */
export async function rotateToken({store,access,orgId,actorId}){
  if(!canSeeProspecting(access))return {status:403,body:{error:'Só o administrador da empresa gera o token do vigia.'}};
  const t=generateIngestToken();
  await store.revokeTokens(orgId);
  await store.createToken(orgId,{token_hash:t.hash,token_hint:t.hint,created_by:actorId});
  await store.audit({user_id:actorId,organization_id:orgId,action:'prospecting_token.rotate',entity_type:'prospecting_ingest_token',entity_id:null,after:{hint:t.hint}});
  return {status:200,body:{ok:true,token:t.token,hint:t.hint,message:'Token gerado. Copie agora: ele não aparece de novo.'}};
}

export async function revokeAll({store,access,orgId,actorId}){
  if(!canSeeProspecting(access))return {status:403,body:{error:'Só o administrador da empresa desliga o vigia.'}};
  await store.revokeTokens(orgId);
  await store.audit({user_id:actorId,organization_id:orgId,action:'prospecting_token.revoke',entity_type:'prospecting_ingest_token',entity_id:null,after:null});
  return {status:200,body:{ok:true,message:'Vigia desligado. Avisos novos serão recusados até gerar outro token.'}};
}
