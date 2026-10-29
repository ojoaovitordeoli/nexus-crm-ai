import {NextResponse} from 'next/server';
import {adminSupabase} from '../../../../../lib/tenant-session';
import {constantSecret,parseDirectMessage} from '../../../../../lib/nexus-evolution.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(status,message)=>NextResponse.json({message},{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request){
 const configured=process.env.NEXUS_DIRECT_WEBHOOK_SECRET;
 if(!configured||configured.length<32)return reply(503,'Webhook unavailable');
 if(!constantSecret(request.headers.get('x-nexus-webhook-secret'),configured))return reply(401,'Unauthorized');
 const raw=await request.text();
 if(raw.length>1024*1024)return reply(413,'Too large');
 let payload;try{payload=JSON.parse(raw)}catch{return reply(400,'Invalid JSON')}
 const name=String(payload?.instance||'');
 if(!/^nx_[a-f\d]{24}$/.test(name))return reply(200,'Ignored instance');
 const db=adminSupabase();if(!db)return reply(503,'Storage unavailable');
 const {data:connection,error:err}=await db.from('nexus_direct_wa_connections')
   .select('id,organization_id,state').eq('instance_name',name).maybeSingle();
 if(err)return reply(503,'Storage unavailable');
 if(!connection)return reply(200,'Unknown instance');
 const event=String(payload?.event||'').toUpperCase().replace(/[.\s-]/g,'_');
 if(event==='CONNECTION_UPDATE'){
  const state=String(payload?.data?.state||'');
  if(['open','connecting','close'].includes(state))
    await db.from('nexus_direct_wa_connections').update({state,updated_at:new Date().toISOString()})
      .eq('id',connection.id).eq('organization_id',connection.organization_id);
  return reply(200,'OK');
 }
 if(event==='MESSAGES_UPSERT'||event==='MESSAGES_SET'){
  const messages=Array.isArray(payload?.data)?payload.data.slice(0,100):[payload?.data];
  for(const item of messages){
    const parsed=parseDirectMessage({event,data:item});
    if(!parsed)continue;
    const {error}=await db.from('nexus_direct_wa_messages').upsert({
      organization_id:connection.organization_id,connection_id:connection.id,...parsed
    },{onConflict:'connection_id,provider_id',ignoreDuplicates:true});
    if(error)return reply(503,'Store failed');
  }
 }
 return reply(200,'OK');
}
