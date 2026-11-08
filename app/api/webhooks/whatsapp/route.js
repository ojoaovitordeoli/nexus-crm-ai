import {NextResponse} from 'next/server';
import {verifyWebhookQuery,verifyWebhookSignature,extractWhatsAppEvents,samePhone} from '../../../../lib/workflow-security.mjs';
import {adminSupabase} from '../../../../lib/tenant-session';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=20;

// Resolves the sender to a contact of the SAME organization only. Never creates records.
// Failures here must not block persisting the message: link is best effort and can be redone.
async function linkSender(db,organizationId,waId){
  const tail=String(waId||'').replace(/\D/g,'').slice(-4);
  if(tail.length<4)return {};
  const {data:contacts,error}=await db.from('contacts')
    .select('id,whatsapp,phone').eq('organization_id',organizationId)
    .or(`whatsapp.ilike.%${tail},phone.ilike.%${tail}`).limit(50);
  if(error||!contacts?.length)return {};
  const matches=contacts.filter(c=>samePhone(waId,c.whatsapp)||samePhone(waId,c.phone));
  if(matches.length!==1)return {}; // ambiguous or none: leave for human linking
  const contactId=matches[0].id;
  const {data:lead}=await db.from('leads').select('id')
    .eq('organization_id',organizationId).eq('contact_id',contactId)
    .order('created_at',{ascending:false}).limit(1).maybeSingle();
  return {contact_id:contactId,lead_id:lead?.id||null};
}

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
      const link=await linkSender(db,conn.organization_id,event.from);
      const row={
        organization_id:conn.organization_id,
        connection_id:conn.id,
        provider_message_id:event.message_id,
        wa_id:event.from,
        direction:'inbound',
        message_type:event.type,
        text_body:event.text||null,
        occurred_at:when
      };
      const opts={onConflict:'organization_id,provider_message_id',ignoreDuplicates:true};
      let {error}=await db.from('whatsapp_messages').upsert({...row,...link},opts);
      // Link columns come from 20261107_whatsapp_contact_link.sql; never lose the message if absent.
      if(error&&link.contact_id&&['42703','PGRST204'].includes(error.code))
        ({error}=await db.from('whatsapp_messages').upsert(row,opts));
      if(error)return new NextResponse('Persist failed',{status:503});
      if(conn.status==='pending'){
        await db.from('whatsapp_connections').update({
          status:'active',activated_at:new Date().toISOString()
        }).eq('id',conn.id).eq('status','pending');
        conn.status='active';
      }
    }else if(event.kind==='status'){
      // Update status only for known messages of the registered organization.
      const {error}=await db.from('whatsapp_messages').update({delivery_status:event.status})
        .eq('organization_id',conn.organization_id)
        .eq('connection_id',conn.id).eq('provider_message_id',event.message_id);
      // Status loss is recoverable (Meta resends); log without personal data and keep going.
      if(error)console.error('[whatsapp-webhook] status update failed',{code:error.code,connection:conn.id});
    }
  }
  return NextResponse.json({ok:true});
}
