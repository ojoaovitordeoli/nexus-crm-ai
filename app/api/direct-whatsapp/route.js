import {NextResponse} from 'next/server';
import {randomBytes} from 'node:crypto';
import {adminSupabase,authorizeTenant} from '../../../lib/tenant-session';
import {isUuid} from '../../../lib/workflow-security.mjs';
import {evolutionCall,evolutionSettings,qrImage} from '../../../lib/nexus-evolution.mjs';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=20;
const respond=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const fail=(error,status=400)=>respond({error},status);
const manager=role=>['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER'].includes(role);
async function auth(request,org){
 const db=adminSupabase();if(!db)return {error:'Supabase não configurado.',status:503};
 const a=await authorizeTenant(request,db,org);
 return a.error?a:{db,...a};
}
async function permittedConnection(ctx,org,id){
 if(!isUuid(id))return null;
 const {data,error}=await ctx.db.from('nexus_direct_wa_connections').select('id,organization_id,created_by,visibility,instance_name,label,state')
  .eq('organization_id',org).eq('id',id).maybeSingle();
 if(error)throw new Error('Estrutura do WhatsApp direto não instalada.');
 if(!data||!(data.visibility==='team'||data.created_by===ctx.user.id))return null;
 return data;
}
export async function GET(request){
 const url=new URL(request.url),org=url.searchParams.get('org_id'),id=url.searchParams.get('connection_id');
 const ctx=await auth(request,org);if(ctx.error)return fail(ctx.error,ctx.status);
 const {data,error}=await ctx.db.from('nexus_direct_wa_connections').select('id,created_by,visibility,label,state,created_at')
   .eq('organization_id',org).order('created_at',{ascending:false}).limit(40);
 if(error)return fail('Migração de WhatsApp direto ainda não aplicada.',503);
 const accessible=(data||[]).filter(c=>c.visibility==='team'||c.created_by===ctx.user.id);
 if(!id)return respond({connections:accessible,bridge_configured:Boolean(evolutionSettings()&&process.env.NEXUS_DIRECT_WEBHOOK_SECRET&&process.env.NEXUS_PUBLIC_BASE_URL),unofficial:true});
 if(!accessible.some(c=>c.id===id))return fail('Canal não autorizado.',403);
 const {data:messages,error:e}=await ctx.db.from('nexus_direct_wa_messages')
   .select('id,remote_jid,text_body,from_me,occurred_at').eq('organization_id',org).eq('connection_id',id)
   .order('occurred_at',{ascending:false}).limit(250);
 if(e)return fail('Falha ao consultar mensagens.',503);
 return respond({messages:(messages||[]).reverse(),connection:accessible.find(c=>c.id===id)});
}
export async function POST(request){
 let body;try{body=await request.json()}catch{return fail('Dados inválidos.')}
 const org=String(body?.org_id||''),action=String(body?.action||'');
 const ctx=await auth(request,org);if(ctx.error)return fail(ctx.error,ctx.status);
 if(!evolutionSettings())return fail('Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no servidor.',503);
 if(action==='create'){
   if(ctx.role==='VIEWER')return fail('Seu perfil é somente leitura.',403);
   const visibility=body.visibility==='team'?'team':'private';
   if(visibility==='team'&&!manager(ctx.role))return fail('Somente gestores podem criar canais compartilhados.',403);
   const label=String(body.label||'').trim().slice(0,80);
   if(label.length<2)return fail('Informe o nome do canal.');
   const url=process.env.NEXUS_PUBLIC_BASE_URL,secret=process.env.NEXUS_DIRECT_WEBHOOK_SECRET;
   if(!url||!/^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(url)||!secret||secret.length<32)
     return fail('Configure NEXUS_PUBLIC_BASE_URL (HTTPS) e NEXUS_DIRECT_WEBHOOK_SECRET no servidor.',503);
   const {count,error:countErr}=await ctx.db.from('nexus_direct_wa_connections').select('id',{head:true,count:'exact'}).eq('organization_id',org);
   if(countErr)return fail('Migração de WhatsApp direto não aplicada.',503);
   if((count||0)>=12)return fail('Limite de canais da empresa atingido.',409);
   const name='nx_'+randomBytes(12).toString('hex');
   let output;
   try{
     output=await evolutionCall('/instance/create',{method:'POST',body:{
       instanceName:name,integration:'WHATSAPP-BAILEYS',qrcode:true,
       webhook:{enabled:true,url:url.replace(/\/$/,'')+'/api/webhooks/whatsapp/direct',webhookByEvents:false,webhookBase64:false,
         headers:{'x-nexus-webhook-secret':secret},events:['MESSAGES_UPSERT','MESSAGES_UPDATE','CONNECTION_UPDATE']},
       syncFullHistory:false
     }});
   }catch(e){return fail(e.message,502)}
   const {data,error}=await ctx.db.from('nexus_direct_wa_connections').insert({
     organization_id:org,created_by:ctx.user.id,visibility,instance_name:name,label,state:'created'
   }).select('id,visibility,label,state').single();
   if(error){
     try{await evolutionCall('/instance/delete/'+name,{method:'DELETE'})}catch{}
     return fail('A instância foi criada, mas não pôde ser vinculada no banco. Nenhum canal foi liberado.',503);
   }
   return respond({connection:data,qr:qrImage(output),message:'Canal criado. Escaneie o QR na opção Aparelhos conectados.',unofficial:true},201);
 }
 let conn;
 try{conn=await permittedConnection(ctx,org,String(body.connection_id||''))}catch(e){return fail(e.message,503)}
 if(!conn)return fail('Canal não encontrado ou sem permissão.',403);
 if(action==='qr'){
   try{const value=await evolutionCall('/instance/connect/'+conn.instance_name);
     return respond({qr:qrImage(value),state:value?.instance?.state||value?.state||conn.state,unofficial:true})}
   catch(e){return fail(e.message,502)}
 }
 if(action==='status'){
   try{const value=await evolutionCall('/instance/connectionState/'+conn.instance_name);
     const state=String(value?.instance?.state||value?.state||conn.state);
     return respond({state:state==='open'?'open':state==='connecting'?'connecting':'close'})}
   catch(e){return fail(e.message,502)}
 }
 if(action==='logout'){
   if(ctx.role==='VIEWER')return fail('Sem permissão.',403);
   if(conn.visibility==='team'&&!manager(ctx.role))return fail('Somente gestores podem desligar canais da equipe.',403);
   try{await evolutionCall('/instance/logout/'+conn.instance_name,{method:'DELETE'});
     await ctx.db.from('nexus_direct_wa_connections').update({state:'close',updated_at:new Date().toISOString()}).eq('id',conn.id).eq('organization_id',org);
     return respond({ok:true,message:'Sessão desconectada no provedor.'});}
   catch(e){return fail(e.message,502)}
 }
 if(action==='send'){
   if(ctx.role==='VIEWER')return fail('Seu perfil não pode enviar mensagens.',403);
   const jid=String(body.remote_jid||''),text=String(body.text||'').trim();
   if(!/^\d{8,17}@s\.whatsapp\.net$/.test(jid)||text.length<1||text.length>3000)return fail('Destinatário ou mensagem inválidos.');
   const {count,error:rateError}=await ctx.db.from('nexus_direct_wa_messages').select('id',{count:'exact',head:true})
     .eq('organization_id',org).eq('connection_id',conn.id).eq('from_me',true)
     .gte('created_at',new Date(Date.now()-60000).toISOString());
   if(rateError)return fail('Não foi possível conferir o limite de envio.',503);
   if((count||0)>=12)return fail('Limite de envios por minuto atingido.',429);
   try{
     const result=await evolutionCall('/message/sendText/'+conn.instance_name,{method:'POST',body:{number:jid.split('@')[0],text}});
     const providerId=String(result?.key?.id||result?.message?.key?.id||'').slice(0,255);
     if(!providerId)return fail('Provedor não confirmou o envio. Confira a conversa antes de tentar novamente.',502);
     const save=await ctx.db.from('nexus_direct_wa_messages').upsert({
       organization_id:org,connection_id:conn.id,provider_id:providerId,remote_jid:jid,from_me:true,text_body:text,occurred_at:new Date().toISOString()
     },{onConflict:'connection_id,provider_id',ignoreDuplicates:true});
     if(save.error)return respond({ok:true,history_pending:true,message:'O provedor aceitou a mensagem, mas não foi possível atualizar o histórico.'});
     return respond({ok:true,message:'Mensagem aceita pelo conector; entrega não garantida.'});
   }catch(e){return fail(e.message+' Não reenvie sem conferir se foi entregue.',502)}
 }
 return fail('Ação desconhecida.');
}
