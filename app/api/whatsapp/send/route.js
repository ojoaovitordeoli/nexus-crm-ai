import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../../lib/tenant-session';
import {isUuid,allowedAutomationRole} from '../../../../lib/workflow-security.mjs';
import {decryptMetaToken} from '../../../../lib/whatsapp-crypto.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=20;
const fail=(message,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
const timeWindowMs=24*60*60*1000;

export async function POST(request){
 let body;
 try{body=await request.json()}catch{return fail('Dados inválidos.')}
 const org=String(body?.org_id||''),connectionId=String(body?.connection_id||'');
 const requestId=String(body?.client_request_id||''),to=String(body?.wa_id||'').replace(/\D/g,'');
 const message=typeof body?.message==='string'?body.message.trim():'';
 if(!isUuid(connectionId)||!isUuid(requestId)||!/^[0-9]{8,24}$/.test(to)||message.length<1||message.length>4096)
   return fail('Informe conversa, identificador de envio e mensagem válidos.');
 const db=adminSupabase();
 if(!db)return fail('Servidor não configurado.',503);
 const auth=await authorizeTenant(request,db,org);
 if(auth.error)return fail(auth.error,auth.status);
 if(!allowedAutomationRole(auth.role))return fail('Seu perfil não pode enviar mensagens.',403);
 const {data:connection,error:connectionError}=await db.from('whatsapp_connections')
   .select('id,phone_number_id,status').eq('id',connectionId).eq('organization_id',org).maybeSingle();
 if(connectionError||!connection||connection.status!=='active')
   return fail('Canal não conectado à empresa ou aguardando ativação pela Meta.',409);
 const cutoff=new Date(Date.now()-timeWindowMs).toISOString();
 const [inbound,secret,rate]=await Promise.all([
   db.from('whatsapp_messages').select('id').eq('organization_id',org).eq('connection_id',connection.id)
     .eq('wa_id',to).eq('direction','inbound').gte('occurred_at',cutoff).limit(1),
   db.from('whatsapp_connection_secrets').select('token_ciphertext').eq('organization_id',org)
     .eq('connection_id',connection.id).maybeSingle(),
   db.from('whatsapp_outbox').select('id',{head:true,count:'exact'}).eq('organization_id',org)
     .eq('created_by',auth.user.id).gte('created_at',new Date(Date.now()-60000).toISOString())
 ]);
 if(inbound.error||secret.error||rate.error)return fail('Migração do envio não aplicada ou consulta indisponível.',503);
 if(!inbound.data?.length)return fail('Janela de atendimento de 24 horas encerrada. Use um modelo aprovado pela Meta para iniciar outra conversa.',409);
 if(!secret.data?.token_ciphertext)return fail('Credencial de envio não configurada pelo Super Admin.',409);
 if((rate.count||0)>=20)return fail('Limite de 20 mensagens por minuto atingido. Tente novamente mais tarde.',429);
 let token;
 try{token=decryptMetaToken(secret.data.token_ciphertext,process.env.META_TOKEN_ENCRYPTION_KEY)}catch{
   return fail('Credencial de envio indisponível. Solicite revisão ao administrador.',503);
 }
 const {data:attempt,error:attemptError}=await db.from('whatsapp_outbox').insert({
   organization_id:org,connection_id:connection.id,client_request_id:requestId,created_by:auth.user.id,
   recipient_wa_id:to,message_text:message,status:'pending'
 }).select('id').maybeSingle();
 if(attemptError)return fail(attemptError.code==='23505'?'Este envio já foi registrado. Atualize a conversa antes de tentar novamente.':'Não foi possível registrar a tentativa de envio.',attemptError.code==='23505'?409:503);
 const version=/^v\d+\.\d+$/.test(process.env.META_GRAPH_API_VERSION||'')?process.env.META_GRAPH_API_VERSION:'v23.0';
 let providerId=null,providerError=null,uncertain=false;
 try{
   const response=await fetch('https://graph.facebook.com/'+version+'/'+encodeURIComponent(connection.phone_number_id)+'/messages',{
     method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
     body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,type:'text',text:{preview_url:false,body:message}}),
     signal:AbortSignal.timeout(14000),cache:'no-store'
   });
   const result=await response.json().catch(()=>({}));
   if(response.ok&&typeof result?.messages?.[0]?.id==='string')providerId=result.messages[0].id;
   else providerError=response.status===401||response.status===403?'Credencial recusada pela Meta.':'Meta não aceitou a mensagem. Revise o canal e as permissões.';
 }catch{
   // A timeout can happen after Meta accepts the message: never retry automatically.
   uncertain=true;providerError='A resposta da Meta não chegou. Verifique o histórico antes de reenviar.';
 }
 if(!providerId){
   await db.from('whatsapp_outbox').update({
     status:uncertain?'uncertain':'failed',failure_code:uncertain?'unknown_outcome':'meta_rejected',completed_at:new Date().toISOString()
   }).eq('id',attempt.id).eq('organization_id',org);
   return fail(providerError,uncertain?504:502);
 }
 const when=new Date().toISOString();
 const {error:saveError}=await db.from('whatsapp_messages').upsert({
   organization_id:org,connection_id:connection.id,provider_message_id:providerId,wa_id:to,
   direction:'outbound',message_type:'text',text_body:message,delivery_status:'accepted',occurred_at:when
 },{onConflict:'organization_id,provider_message_id',ignoreDuplicates:true});
 await db.from('whatsapp_outbox').update({
   status:'accepted',provider_message_id:providerId,completed_at:when,failure_code:saveError?'history_pending':null
 }).eq('id',attempt.id).eq('organization_id',org);
 return NextResponse.json({ok:true,message:'Mensagem aceita pela Meta, aguardando confirmação de entrega.',provider_message_id:providerId,history_pending:Boolean(saveError)},{headers:{'Cache-Control':'no-store'}});
}
