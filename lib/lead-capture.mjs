// V42 — Captura de leads: formulário/landing page → funil do NEXUS, já qualificado.
// Regras puras + núcleo das rotas, sem acesso direto ao banco: as rotas passam um "store"
// (Supabase com service_role) e os testes, um store em memória com duas empresas.
// Contrato completo: docs/captura-de-leads.md
import {createHash,randomBytes} from 'node:crypto';
import {canManageTeam} from './team-rules.mjs';

export const MAX_BODY_BYTES=16*1024;
const TOKEN_PREFIX='nxl_';
export const TEMPERATURE_LABEL={hot:'Quente',warm:'Morno',cold:'Frio'};

/** Quem gera/revoga a chave: Admin da empresa, Admin da agência ou Super Admin. */
export const canManageCapture=(access={})=>canManageTeam(access);

export function generateCaptureToken(){
  const token=TOKEN_PREFIX+randomBytes(32).toString('base64url');
  return {token,hash:hashCaptureToken(token),hint:token.slice(-6)};
}
export const hashCaptureToken=token=>createHash('sha256').update(String(token),'utf8').digest('hex');
/** Authorization: Bearer nxl_... (formato estrito). */
export function readCaptureToken(header){
  const m=/^Bearer\s+(nxl_[A-Za-z0-9_-]{43})$/.exec(String(header||'').trim());
  return m?m[1]:null;
}

const clean=(v,max)=>{
  if(v===undefined||v===null)return null;
  const s=String(v).replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim();
  return s?s.slice(0,max):null;
};
const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
/** Só dígitos, com DDI 55 quando vier no formato nacional (10–11 dígitos). */
export function normalizePhone(value){
  const d=String(value||'').replace(/\D/g,'');
  if(d.length===10||d.length===11)return '55'+d;
  if(d.length>=12&&d.length<=13&&d.startsWith('55'))return d;
  return null;
}

/** @ do Instagram: aceita "@Otica.Visao", "instagram.com/otica.visao/" etc. → "otica.visao". */
export function normalizeInstagram(value){
  let s=String(value||'').trim().toLowerCase();
  const m=/instagram\.com\/([a-z0-9._]+)/.exec(s);
  if(m)s=m[1];
  s=s.replace(/^@+/,'').replace(/\/+$/,'');
  return /^[a-z0-9._]{1,30}$/.test(s)?s:null;
}

const TEMP_ALIASES={hot:'hot',quente:'hot',warm:'warm',morno:'warm',cold:'cold',frio:'cold'};
const URGENT=/\b(agora|hoje|imediat|urgente|esta semana|essa semana|nesta semana|amanha|o quanto antes)\b/;
const SOON=/\b(este mes|esse mes|neste mes|15 dias|quinze dias|30 dias|proximo mes|proximas semanas|em breve)\b/;

/**
 * Pontuação transparente (0–100) e temperatura. A regra é sempre a mesma e fica registrada
 * no histórico do lead ("por quê"), para o vendedor entender e confiar.
 *   contato: WhatsApp válido +25, e-mail +10, Instagram +10
 *   comentou a palavra-chave num post +15
 *   urgência: agora/hoje/esta semana +40 · este mês/em breve +20
 *   orçamento ou valor informado +15
 *   mensagem com 20+ caracteres +10
 * Quente ≥ 65 · Morno 35–64 · Frio < 35. Se o formulário mandar a temperatura, ela vale.
 */
export function qualify(v){
  const reasons=[];let score=0;
  if(v.whatsapp){score+=25;reasons.push('WhatsApp informado')}
  if(v.email){score+=10;reasons.push('e-mail informado')}
  if(v.instagram){score+=10;reasons.push('Instagram informado')}
  if(v.keyword){score+=15;reasons.push('comentou "'+v.keyword+'"')}
  const urgency=fold(v.answers?.urgencia||v.answers?.prazo||'');
  if(URGENT.test(urgency)){score+=40;reasons.push('quer resolver logo ("'+clean(v.answers?.urgencia||v.answers?.prazo,40)+'")')}
  else if(SOON.test(urgency)){score+=20;reasons.push('quer resolver em breve ("'+clean(v.answers?.urgencia||v.answers?.prazo,40)+'")')}
  if(v.estimated_value>0||clean(v.answers?.orcamento,80)){score+=15;reasons.push('informou orçamento')}
  if((v.message||'').length>=20){score+=10;reasons.push('deixou mensagem')}
  score=Math.min(100,score);
  const computed=score>=65?'hot':score>=35?'warm':'cold';
  const temperature=v.temperature||computed;
  if(v.temperature)reasons.push('temperatura enviada pelo formulário');
  return {score:v.score??score,temperature,reasons};
}

/** Valida o corpo. Nada aqui define empresa, funil, etapa ou responsável. */
export function validateCapture(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return {ok:false,error:'Envie um objeto JSON com os dados do lead.'};
  const name=clean(input.name??input.nome,160);
  const email=clean(input.email,254);
  if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return {ok:false,error:'email inválido.'};
  let whatsapp=null;
  const rawPhone=input.whatsapp??input.phone??input.telefone;
  if(rawPhone!==undefined&&rawPhone!==null&&String(rawPhone).trim()){
    whatsapp=normalizePhone(rawPhone);
    if(!whatsapp)return {ok:false,error:'whatsapp inválido (use DDD + número).'};
  }
  let instagram=null;
  const rawIg=input.instagram??input.instagram_username??input.ig_username;
  if(rawIg!==undefined&&rawIg!==null&&String(rawIg).trim()){
    instagram=normalizeInstagram(rawIg);
    if(!instagram)return {ok:false,error:'instagram inválido (use o @ do perfil, até 30 letras, números, ponto ou _).'};
  }
  if(!whatsapp&&!email&&!instagram)return {ok:false,error:'Informe ao menos whatsapp, email ou instagram.'};
  let temperature=null;
  if(input.temperature!==undefined&&input.temperature!==null&&String(input.temperature).trim()){
    temperature=TEMP_ALIASES[fold(input.temperature)];
    if(!temperature)return {ok:false,error:'temperature deve ser quente, morno ou frio (hot, warm, cold).'};
  }
  let score=null;
  if(input.score!==undefined&&input.score!==null&&String(input.score).trim()!==''){
    score=Number(input.score);
    if(!Number.isInteger(score)||score<0||score>100)return {ok:false,error:'score deve ser inteiro de 0 a 100.'};
  }
  let estimated_value=null;
  if(input.estimated_value!==undefined&&input.estimated_value!==null&&String(input.estimated_value).trim()!==''){
    estimated_value=Number(input.estimated_value);
    if(!Number.isFinite(estimated_value)||estimated_value<0||estimated_value>1e9)return {ok:false,error:'estimated_value inválido.'};
  }
  const answers={};
  if(input.answers&&typeof input.answers==='object'&&!Array.isArray(input.answers)){
    for(const [k,val] of Object.entries(input.answers).slice(0,20)){
      const key=clean(fold(k).replace(/[^a-z0-9_ ]/g,''),40),value=clean(val,300);
      if(key&&value)answers[key.replace(/ /g,'_')]=value;
    }
  }
  const utm=input.utm&&typeof input.utm==='object'?input.utm:input;
  const parts=String(name||'').split(' ');
  return {ok:true,value:{
    first_name:parts[0]||null,last_name:parts.slice(1).join(' ')||null,name,email:email?email.toLowerCase():null,whatsapp,instagram,
    keyword:clean(input.keyword??input.palavra,60),post_url:clean(input.post_url??input.post,300),
    city:clean(input.city??input.cidade,120),message:clean(input.message??input.mensagem,2000),
    source:clean(input.source??input.origem,120)||'Formulário do site',
    form_id:clean(input.form_id??input.formulario,120),
    utm_source:clean(utm.utm_source,120),utm_medium:clean(utm.utm_medium,120),utm_campaign:clean(utm.utm_campaign,200),
    utm_content:clean(utm.utm_content,200),utm_term:clean(utm.utm_term,200),
    campaign_id:clean(input.campaign_id,120),campaign_name:clean(input.campaign_name,200),
    adset_id:clean(input.adset_id,120),adset_name:clean(input.adset_name,200),
    ad_id:clean(input.ad_id,120),ad_name:clean(input.ad_name,200),
    estimated_value,temperature,score,answers,
  }};
}

const RANK={cold:0,warm:1,hot:2};
const answersText=a=>Object.entries(a||{}).map(([k,v])=>k.replace(/_/g,' ')+': '+v).join(' · ');
export function captureNote(v,q,{existing=false}={}){
  const head=existing?'Nova entrada pelo formulário':'Lead recebido pelo formulário';
  const origin=[v.source,v.utm_campaign||v.campaign_name,v.ad_name].filter(Boolean).join(' · ');
  const ig=v.instagram?'Instagram: @'+v.instagram+' (https://www.instagram.com/'+v.instagram+'/)'+(v.keyword?' · comentou "'+v.keyword+'"':'')+(v.post_url?' em '+v.post_url:''):'';
  return [head+(origin?' ('+origin+')':'')+'.',ig,
    'Classificação: '+TEMPERATURE_LABEL[q.temperature]+' ('+q.score+'/100)'+(q.reasons.length?' — '+q.reasons.join(', '):'')+'.',
    answersText(v.answers),v.message?'Mensagem: '+v.message:''].filter(Boolean).join('\n').slice(0,4000);
}

/**
 * Entrada servidor → servidor (n8n, função do site, Make, Zapier).
 * store: findActiveToken, touchToken, findContact, createContact, findOpenLead, firstStage,
 *        createLead, updateLead, addNote, logStage, audit
 */
export async function captureLead({store,authorization,body,now=new Date()}){
  const token=readCaptureToken(authorization);
  if(!token)return {status:401,body:{error:'Chave ausente ou em formato inválido (Authorization: Bearer nxl_...).'}};
  const found=await store.findActiveToken(hashCaptureToken(token));
  if(!found)return {status:401,body:{error:'Chave inválida ou revogada.'}};
  const orgId=found.organization_id; // a empresa vem da chave; organization_id no corpo é ignorado
  const parsed=validateCapture(body);
  if(!parsed.ok)return {status:400,body:{error:parsed.error}};
  const v=parsed.value,q=qualify(v);
  await store.touchToken(found.id);

  let contact=await store.findContact(orgId,{whatsapp:v.whatsapp,email:v.email,instagram:v.instagram});
  if(!contact){
    const row={first_name:v.first_name||(v.instagram?'@'+v.instagram:'Lead do site'),last_name:v.last_name,whatsapp:v.whatsapp,email:v.email,city:v.city};
    if(v.instagram)row.instagram=v.instagram;
    contact=await store.createContact(orgId,row);
  }else if(v.instagram&&!contact.instagram&&store.fillContact){
    await store.fillContact(orgId,contact.id,{instagram:v.instagram}); // completa o @ de quem já existia
  }
  const open=await store.findOpenLead(orgId,contact.id);
  if(open){
    const patch={last_interaction_at:now.toISOString()};
    if((RANK[q.temperature]??0)>(RANK[open.temperature]??-1)){patch.temperature=q.temperature;patch.score=q.score}
    await store.updateLead(orgId,open.id,patch);
    await store.addNote(orgId,{lead_id:open.id,contact_id:contact.id,content:captureNote(v,q,{existing:true})});
    await store.audit({organization_id:orgId,action:'lead_capture_existing',entity_type:'lead',entity_id:open.id,after:{temperature:patch.temperature||open.temperature,token_id:found.id}});
    return {status:200,body:{ok:true,status:'existing',lead_id:open.id,temperature:patch.temperature||open.temperature,score:q.score,
      message:'Contato já tinha atendimento aberto; a nova entrada foi registrada no histórico.'}};
  }
  const stage=await store.firstStage(orgId);
  if(!stage)return {status:409,body:{error:'A empresa ainda não tem funil com etapa ativa. Configure o funil no NEXUS.'}};
  const lead=await store.createLead(orgId,{
    contact_id:contact.id,pipeline_id:stage.pipeline_id,pipeline_stage_id:stage.stage_id,status:'active',
    source:v.source,form_id:v.form_id,utm_source:v.utm_source,utm_medium:v.utm_medium,utm_campaign:v.utm_campaign,
    utm_content:v.utm_content,utm_term:v.utm_term,campaign_id:v.campaign_id,campaign_name:v.campaign_name,
    adset_id:v.adset_id,adset_name:v.adset_name,ad_id:v.ad_id,ad_name:v.ad_name,
    temperature:q.temperature,score:q.score,estimated_value:v.estimated_value,
    stage_changed_at:now.toISOString(),last_interaction_at:now.toISOString()});
  await store.logStage(lead.id,stage.stage_id);
  await store.addNote(orgId,{lead_id:lead.id,contact_id:contact.id,content:captureNote(v,q)});
  await store.audit({organization_id:orgId,action:'lead_capture_created',entity_type:'lead',entity_id:lead.id,after:{temperature:q.temperature,score:q.score,source:v.source,token_id:found.id}});
  return {status:201,body:{ok:true,status:'created',lead_id:lead.id,temperature:q.temperature,score:q.score,
    message:'Lead criado na primeira etapa do funil.'}};
}

// ---------- Gestão da chave (tela de Configurações) ----------
export async function captureStatus({store,access,orgId}){
  if(!canManageCapture(access))return {status:403,body:{error:'Só o administrador da empresa gerencia a captura de leads.'}};
  const tokens=await store.listTokens(orgId);
  return {status:200,body:{active:tokens.length>0,hint:tokens[0]?.token_hint||'',last_used_at:tokens[0]?.last_used_at||null,created_at:tokens[0]?.created_at||null}};
}
/** Gera uma chave nova e revoga as anteriores. A chave aparece uma única vez. */
export async function rotateCaptureToken({store,access,orgId,actorId}){
  if(!canManageCapture(access))return {status:403,body:{error:'Só o administrador da empresa gera a chave de captura.'}};
  const t=generateCaptureToken();
  await store.revokeTokens(orgId);
  await store.createToken(orgId,{token_hash:t.hash,token_hint:t.hint,created_by:actorId});
  await store.audit({organization_id:orgId,user_id:actorId,action:'lead_capture_token_rotated',entity_type:'lead_capture_token',entity_id:null,after:{hint:t.hint}});
  return {status:201,body:{ok:true,token:t.token,hint:t.hint,message:'Chave gerada. Copie agora: ela não aparece de novo.'}};
}
export async function revokeCaptureTokens({store,access,orgId,actorId}){
  if(!canManageCapture(access))return {status:403,body:{error:'Só o administrador da empresa revoga a chave de captura.'}};
  await store.revokeTokens(orgId);
  await store.audit({organization_id:orgId,user_id:actorId,action:'lead_capture_token_revoked',entity_type:'lead_capture_token',entity_id:null,after:{}});
  return {status:200,body:{ok:true,message:'Chave revogada. Formulários com a chave antiga deixam de criar leads.'}};
}
