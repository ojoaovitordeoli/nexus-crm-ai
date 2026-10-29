import {NextResponse} from 'next/server';
import {verifyWebhookQuery,verifyWebhookSignature,extractWhatsAppEvents} from '../../../../lib/workflow-security.mjs';
import {adminSupabase} from '../../../../lib/tenant-session';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=20;

export async function GET(request){
  const token=process.env.META_WEBHOOK_VERIFY_TOKEN;
  if(!verifyWebhookQuery(request.url,token))return new NextResponse('Forbidden',{status:403});
  const challenge=new URL(request.url).searchParams.get('hub.challenge');
  return new NextResponse(challenge,{status:200,headers:{'Content-Type':'text/plain;charset=utf-8','Cache-Control':'no-store'}});
}

export async function POST(request){
  const appSecret=process.env.META_APP_SECRET;
  if(!appSecret)return new NextResponse('Not configured',{status:503});
  const raw=Buffer.from(await request.arrayBuffer());
  if(raw.length>1024*1024)return new NextResponse('Payload too large',{status:413});
  const signature=request.headers.get('x-hub-signature-256');
  if(!verifyWebhookSignature(raw,signature,appSecret))
    return new NextResponse('Signature mismatch',{status:401});
  let payload;
  try{payload=JSON.parse(raw.toString('utf8'))}catch{return new NextResponse('Bad JSON',{status:400})}
  const events=extractWhatsAppEvents(payload);
  if(!events.length)return NextResponse.json({ok:true});

  const db=adminSupabase();
  if(!db)return new NextResponse('Storage unavailable',{status:503});
  // Only phone numbers previously registered by a platform administrator can receive messages.
  // Never trust the organization identifier or custom metadata from a webhook payload.
  const phones=[...new Set(events.map(e=>e.phone_number_id))];
  const {data:connections,error:connectionError}=await db.from('whatsapp_connections')
    .select('id,organization_id,phone_number_id,status').in('phone_number_id',phones).neq('status','disabled');
  if(connectionError)return new NextResponse('Storage unavailable',{status:503});
  const byPhone=new Map((connections||[]).map(c=>[c.phone_number_id,c]));
  for(const event of events){
    const conn=byPhone.get(event.phone_number_id);
    if(!conn)continue;
    if(event.kind==='message'){
      const when=event.timestamp&&event.timestamp>1000000000&&event.timestamp<9999999999
        ?new Date(event.timestamp*1000).toISOString():new Date().toISOString();
      const {error}=await db.from('whatsapp_messages').upsert({
        organization_id:conn.organization_id,
        connection_id:conn.id,
        provider_message_id:event.message_id,
        wa_id:event.from,
        direction:'inbound',
        message_type:event.type,
        text_body:event.text||null,
        occurred_at:when
      },{onConflict:'organization_id,provider_message_id',ignoreDuplicates:true});
      if(error)return new NextResponse('Persist failed',{status:503});
      if(conn.status==='pending'){
        await db.from('whatsapp_connections').update({
          status:'active',activated_at:new Date().toISOString()
        }).eq('id',conn.id).eq('status','pending');
        conn.status='active';
      }
    }else if(event.kind==='status'){
      // Update status only for known messages of the registered organization.
      await db.from('whatsapp_messages').update({delivery_status:event.status})
        .eq('organization_id',conn.organization_id)
        .eq('connection_id',conn.id).eq('provider_message_id',event.message_id);
    }
  }
  return NextResponse.json({ok:true});
}
