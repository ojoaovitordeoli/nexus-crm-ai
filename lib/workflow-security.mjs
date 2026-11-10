import {createHmac,timingSafeEqual} from 'node:crypto';

export const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid=value=>uuidPattern.test(String(value||''));

export function safeCompare(a,b){
  if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;
  const ah=createHmac('sha256','nexus-constant-compare').update(a).digest();
  const bh=createHmac('sha256','nexus-constant-compare').update(b).digest();
  return timingSafeEqual(ah,bh);
}
export function verifyWebhookQuery(url,token){
  if(!token)return false;
  const u=new URL(url,'https://localhost');
  return u.searchParams.get('hub.mode')==='subscribe' &&
    safeCompare(u.searchParams.get('hub.verify_token'),token) &&
    Boolean(u.searchParams.get('hub.challenge'));
}
export function verifyWebhookSignature(body,signature,secret){
  if(!secret||typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
  const expected=createHmac('sha256',secret).update(body).digest();
  const sent=Buffer.from(signature.slice(7),'hex');
  return sent.length===expected.length&&timingSafeEqual(sent,expected);
}
export function extractWhatsAppEvents(payload){
  if(!payload||payload.object!=='whatsapp_business_account'||!Array.isArray(payload.entry))return [];
  const events=[];
  for(const entry of payload.entry.slice(0,20)){
    for(const change of (Array.isArray(entry.changes)?entry.changes:[]).slice(0,20)){
      const value=change?.value;
      const phone=String(value?.metadata?.phone_number_id||'');
      if(!/^\d{6,24}$/.test(phone))continue;
      for(const m of (Array.isArray(value?.messages)?value.messages:[]).slice(0,100)){
        if(!m?.id||!m?.from)continue;
        events.push({
          kind:'message',phone_number_id:phone,message_id:String(m.id).slice(0,255),
          from:String(m.from).replace(/\D/g,'').slice(0,24),
          type:String(m.type||'unknown').slice(0,40),
          text:m.type==='text'?String(m.text?.body||'').slice(0,4096):'',
          timestamp:Number(m.timestamp)||null
        });
      }
      for(const st of (Array.isArray(value?.statuses)?value.statuses:[]).slice(0,100)){
        if(!st?.id||!st?.status)continue;
        events.push({
          kind:'status',phone_number_id:phone,message_id:String(st.id).slice(0,255),
          status:String(st.status).slice(0,40),timestamp:Number(st.timestamp)||null
        });
      }
    }
  }
  return events.slice(0,100);
}
export const allowedAutomationRole=role=>role!=='VIEWER'&&
  ['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER','SDR','SELLER'].includes(role);
export const manageAutomationRole=role=>
  ['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER'].includes(role);
// Conversation text is personal data (LGPD): only roles that attend customers may read it.
export const readWhatsAppRole=role=>
  ['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER','SDR','SELLER'].includes(role);

// Brazilian numbers may arrive with or without the mobile 9th digit and country code.
// Returns comparable keys: national number with and without the 9th digit (DDD + number).
export function phoneMatchKeys(value){
  let d=String(value||'').replace(/\D/g,'');
  if(d.length>=12&&d.startsWith('55'))d=d.slice(2);
  if(d.length===11&&d.startsWith('0'))d=d.slice(1);
  if(d.length!==10&&d.length!==11)return d.length>=8?[d]:[];
  const ddd=d.slice(0,2),rest=d.slice(2);
  if(rest.length===9&&rest.startsWith('9')&&/^[6-9]/.test(rest.slice(1)))return [d,ddd+rest.slice(1)];
  if(rest.length===8&&/^[6-9]/.test(rest))return [d,ddd+'9'+rest];
  return [d];
}
export function samePhone(a,b){
  const ka=phoneMatchKeys(a),kb=new Set(phoneMatchKeys(b));
  return ka.some(k=>kb.has(k));
}
export function validateFollowupRule(value){
  const name=String(value?.name||'').trim().slice(0,100);
  const title=String(value?.task_title||'').trim().slice(0,180);
  const stage=String(value?.stage_id||'');
  const days=Number(value?.delay_days);
  if(name.length<3)return {error:'Informe um nome de pelo menos três caracteres.'};
  if(title.length<3)return {error:'Informe o título da tarefa automática.'};
  if(!isUuid(stage))return {error:'Escolha uma etapa válida do funil.'};
  if(!Number.isInteger(days)||days<0||days>30)return {error:'O prazo deve estar entre 0 e 30 dias.'};
  return {data:{name,task_title:title,stage_id:stage,delay_days:days,trigger_type:'lead_stage_changed',action_type:'create_followup_task'}};
}

// Registra o erro técnico no log do servidor (sem dados pessoais) e devolve só a mensagem
// em português para o cliente. Nunca repassar error.message do banco para a tela.
export function logInternal(scope,error){
  if(!error)return;
  console.error('[nexus-api] '+scope,{code:error.code||null,message:String(error.message||'').slice(0,300)});
}
export const MISSING_SCHEMA_CODES=['42P01','42703','42883','PGRST202','PGRST204','PGRST205'];
export const isMissingSchema=error=>Boolean(error&&(MISSING_SCHEMA_CODES.includes(error.code)||/schema cache|does not exist/i.test(String(error.message||''))));
