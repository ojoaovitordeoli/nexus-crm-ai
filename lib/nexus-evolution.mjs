import {timingSafeEqual,createHash} from 'node:crypto';
const short=(value,limit=255)=>String(value||'').slice(0,limit);
export function constantSecret(a,b){
 if(typeof a!=='string'||typeof b!=='string'||!a||!b)return false;
 return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest());
}
export function evolutionSettings(env=process.env){
 const base=String(env.EVOLUTION_API_URL||'').replace(/\/+$/,'');
 const key=String(env.EVOLUTION_API_KEY||'');
 if(!base||key.length<16)return null;
 let u;try{u=new URL(base)}catch{return null}
 const local=['localhost','127.0.0.1'].includes(u.hostname);
 if(u.protocol!=='https:'&&!(u.protocol==='http:'&&local))return null;
 if(u.username||u.password||u.search||u.hash)return null;
 return {base,key};
}
export async function evolutionCall(path,{method='GET',body}={}){
 const config=evolutionSettings();
 if(!config)throw new Error('Servidor da conexão direta não configurado.');
 if(!/^\/[a-zA-Z0-9_\/-]+$/.test(path))throw new Error('Caminho do provedor inválido.');
 const resp=await fetch(config.base+path,{method,headers:{apikey:config.key,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(14000),cache:'no-store'});
 const result=await resp.json().catch(()=>({}));
 if(!resp.ok)throw new Error('O serviço de WhatsApp recusou a operação ('+resp.status+').');
 return result;
}
export function parseDirectMessage(input){
 const event=String(input?.event||'').toUpperCase().replace(/[.\s-]/g,'_');
 if(event!=='MESSAGES_UPSERT'&&event!=='MESSAGES_SET')return null;
 const data=Array.isArray(input?.data)?input.data[0]:input?.data;
 const key=data?.key||{};
 const jid=short(key.remoteJid,140),id=short(key.id,255);
 if(!jid||!id||jid.endsWith('@g.us')||jid.endsWith('@broadcast')||jid==='status@broadcast')return null;
 if(!/@(s\.whatsapp\.net|lid)$/.test(jid))return null;
 const msg=data?.message||{};
 const body=msg.conversation??msg.extendedTextMessage?.text??msg.imageMessage?.caption??msg.videoMessage?.caption??'';
 const epoch=Number(data.messageTimestamp?.low??data.messageTimestamp);
 const occurred_at=epoch>1000000000&&epoch<9999999999?new Date(epoch*1000).toISOString():new Date().toISOString();
 return {provider_id:id,remote_jid:jid,from_me:Boolean(key.fromMe),text_body:short(body,4096),occurred_at};
}
export function qrImage(result){
 const raw=result?.base64||result?.qrcode?.base64||result?.qrcode?.image||'';
 if(typeof raw!=='string')return null;
 const v=raw.startsWith('data:image/png;base64,')?raw:'data:image/png;base64,'+raw;
 return /^data:image\/png;base64,[A-Za-z0-9+/=]{100,300000}$/.test(v)?v:null;
}
