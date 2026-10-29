import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../../lib/tenant-session';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail=(message,status=400)=>NextResponse.json({error:message},{status});
async function authRequest(request,orgId){
  const admin=adminSupabase();
  if(!admin)return {error:'Supabase não configurado no servidor.',status:503};
  const auth=await authorizeTenant(request,admin,orgId);
  return auth.error?auth:{admin,...auth};
}
export async function GET(request){
  const organizationId=new URL(request.url).searchParams.get('org_id');
  const ctx=await authRequest(request,organizationId);
  if(ctx.error)return fail(ctx.error,ctx.status);
  const [connections,messages]=await Promise.all([
    ctx.admin.from('whatsapp_connections')
      .select('id,phone_number_id,display_name,status,created_at,activated_at')
      .eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(20),
    ctx.admin.from('whatsapp_messages')
      .select('id,wa_id,direction,message_type,text_body,delivery_status,occurred_at,connection_id')
      .eq('organization_id',organizationId).order('occurred_at',{ascending:false}).limit(250)
  ]);
  if(connections.error||messages.error){
    const err=connections.error||messages.error;
    const missing=['42P01','PGRST205'].includes(err.code);
    return fail(missing?
      'A estrutura do WhatsApp ainda não foi instalada. Execute a migração SQL do NEXUS no Supabase.':
      'Falha ao carregar a caixa de entrada: '+err.message,missing?503:500);
  }
  return NextResponse.json({
    connections:connections.data||[],
    messages:messages.data||[],
    verified_server:Boolean(process.env.META_APP_SECRET&&process.env.META_WEBHOOK_VERIFY_TOKEN),
    can_register:ctx.role==='AGENCY_ADMIN'
  });
}

export async function POST(request){
  let body;
  try{body=await request.json()}catch{return fail('Dados inválidos.')}
  const orgId=String(body?.org_id||'');
  const ctx=await authRequest(request,orgId);
  if(ctx.error)return fail(ctx.error,ctx.status);
  // Only the platform's actual super admin may associate phone IDs with companies.
  const {data:actor}=await ctx.admin.from('profiles')
    .select('is_super_admin').eq('id',ctx.user.id).maybeSingle();
  if(!actor?.is_super_admin)return fail('Somente o Super Admin pode registrar números da Meta.',403);
  const phoneId=String(body.phone_number_id||'').trim();
  const display=String(body.display_name||'WhatsApp Business').trim().slice(0,100);
  if(!/^[0-9]{6,24}$/.test(phoneId))return fail('Informe o Phone Number ID numérico obtido no painel da Meta.');
  if(!process.env.META_APP_SECRET||!process.env.META_WEBHOOK_VERIFY_TOKEN)
    return fail('Configure META_APP_SECRET e META_WEBHOOK_VERIFY_TOKEN no Render antes de registrar o número.',503);
  const {count,error:countError}=await ctx.admin.from('whatsapp_connections')
    .select('id',{head:true,count:'exact'}).eq('organization_id',orgId);
  if(countError)return fail('Migração do WhatsApp não instalada no Supabase.',503);
  if(count>=10)return fail('Limite de dez números por empresa.',409);
  const {data,error}=await ctx.admin.from('whatsapp_connections').insert({
    organization_id:orgId,phone_number_id:phoneId,
    display_name:display||'WhatsApp Business',
    created_by:ctx.user.id,status:'pending'
  }).select('id,phone_number_id,status').maybeSingle();
  if(error)return fail(error.code==='23505'?'Esse Phone Number ID já está registrado.':error.message,error.code==='23505'?409:500);
  return NextResponse.json({ok:true,message:'Número registrado. Aguardando o primeiro evento assinado da Meta.',connection:data});
}
