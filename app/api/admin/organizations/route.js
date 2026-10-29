import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Actions reversíveis no servidor. Exclusão permanente é feita apenas
// pela RPC protegida de banco, após verificar todos os vínculos de dados.
export async function POST(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://qhizuqcdxivdvjtefofz.supabase.co';
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return NextResponse.json({
    error: 'A chave SUPABASE_SERVICE_ROLE_KEY não está disponível no servidor. No Render, abra Environment, confira a variável e salve com redeploy.'
  },{status:503});
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) return NextResponse.json({
    error:'Faça login novamente para gerenciar empresas.'
  },{status:401});

  let input;
  try { input = await request.json(); }
  catch { return NextResponse.json({error:'Solicitação inválida.'},{status:400}) }
  const orgId = String(input?.org_id || '');
  const action = String(input?.action || '');
  if (!/^[a-f0-9-]{36}$/i.test(orgId) || !['archive','restore'].includes(action)) {
    return NextResponse.json({error:'Empresa ou ação inválida.'},{status:400});
  }

  const supabase = createClient(url,secret,{
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const token = header.slice(7).trim();
  const {data:auth,error:authError}=await supabase.auth.getUser(token);
  if(authError||!auth?.user) return NextResponse.json({
    error:'Sessão inválida. Faça login novamente.'
  },{status:401});

  const {data:profile,error:profileError}=await supabase.from('profiles')
    .select('is_super_admin,status').eq('id',auth.user.id).maybeSingle();
  if(profileError||!profile?.is_super_admin||profile.status!=='active') {
    return NextResponse.json({error:'Somente Super Admin ativo pode alterar empresas.'},{status:403});
  }

  const {data:company,error:findError}=await supabase.from('organizations')
    .select('id,name,status').eq('id',orgId).maybeSingle();
  if(findError||!company)return NextResponse.json({error:'Empresa não encontrada.'},{status:404});

  const desired=action==='archive'?'archived':'active';
  if(action==='restore'&&company.status!=='archived') {
    return NextResponse.json({error:'Somente empresas arquivadas podem ser restauradas.'},{status:400});
  }
  if(action==='archive'&&company.status==='archived') {
    return NextResponse.json({ok:true,status:'archived',message:'Empresa já arquivada.'});
  }

  const {error:updateError}=await supabase.from('organizations')
    .update({status:desired}).eq('id',orgId).eq('status',company.status);
  if(updateError) return NextResponse.json({error:'Falha ao atualizar empresa: '+updateError.message},{status:500});

  const {error:auditError}=await supabase.from('audit_logs').insert({
    user_id:auth.user.id,organization_id:orgId,action:'organization_'+action,
    entity_type:'organization',entity_id:orgId,
    before:{name:company.name,status:company.status},
    after:{name:company.name,status:desired}
  });
  return NextResponse.json({
    ok:true,status:desired,
    message:action==='archive'?'Empresa arquivada com dados preservados.':'Empresa restaurada.',
    warning:auditError?'Operação concluída, mas registro de auditoria falhou.':null
  });
}
