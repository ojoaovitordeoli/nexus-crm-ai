import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const roles=new Set(['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER','SDR','SELLER','VIEWER']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const error=(message,status)=>NextResponse.json({error:message},{status});
const ok=(message,warning=null)=>NextResponse.json({ok:true,message,warning});
const good=id=>uuid.test(String(id||''));

export async function POST(request){
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qhizuqcdxivdvjtefofz.supabase.co';
  if(!serviceKey)return error('Chave do servidor não configurada no Render (SUPABASE_SERVICE_ROLE_KEY).',503);
  const bearer=request.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return error('Faça login para continuar.',401);
  const supabase=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await supabase.auth.getUser(bearer.slice(7).trim());
  if(authError||!auth?.user)return error('Sua sessão expirou. Entre novamente.',401);
  const {data:admin,error:profileError}=await supabase.from('profiles').select('is_super_admin,status').eq('id',auth.user.id).maybeSingle();
  if(profileError||!admin?.is_super_admin||admin.status!=='active')
    return error('Somente o Super Admin ativo pode alterar acessos.',403);

  let input;
  try{input=await request.json()}catch{return error('Solicitação inválida.',400)}
  const action=String(input?.action||'');
  const userId=String(input?.user_id||'');
  const orgId=String(input?.org_id||'');

  if(action==='assign'){
    if(!good(userId)||!good(orgId)||!roles.has(input?.role))
      return error('Selecione usuário, empresa e função válidos.',400);
    const [userResult,orgResult]=await Promise.all([
      supabase.from('profiles').select('id,is_super_admin,status').eq('id',userId).maybeSingle(),
      supabase.from('organizations').select('id,status').eq('id',orgId).maybeSingle()
    ]);
    if(userResult.error||orgResult.error)return error('Não foi possível verificar o usuário ou a empresa.',500);
    if(!userResult.data||userResult.data.is_super_admin||userResult.data.status!=='active')
      return error('Selecione um usuário comum ativo. O Super Admin não precisa de vínculo.',400);
    if(!orgResult.data||orgResult.data.status!=='active')
      return error('Selecione uma empresa ativa.',400);

    const {data:existing,error:existingError}=await supabase.from('organization_members')
      .select('id,role,status').eq('organization_id',orgId).eq('user_id',userId).maybeSingle();
    if(existingError)return error('Falha ao consultar vínculos: '+existingError.message,500);
    const values={role:input.role,status:'active'};
    const result=existing
      ?await supabase.from('organization_members').update(values).eq('id',existing.id).select('id').single()
      :await supabase.from('organization_members').insert({
        organization_id:orgId,user_id:userId,...values
      }).select('id').single();
    if(result.error)return error('Não foi possível atribuir acesso: '+result.error.message,500);

    const {error:auditError}=await supabase.from('audit_logs').insert({
      user_id:auth.user.id,organization_id:orgId,
      action:existing?'membership_update':'membership_create',
      entity_type:'organization_member',entity_id:result.data.id,
      before:existing?{role:existing.role,status:existing.status}:null,
      after:{user_id:userId,role:input.role,status:'active'}
    });
    return ok('Usuário vinculado à empresa com sucesso.',auditError?'Vínculo salvo; auditoria não registrada.':null);
  }

  if(action==='member_status'){
    const memberId=String(input?.member_id||'');
    const status=String(input?.status||'');
    if(!good(memberId)||!['active','removed'].includes(status))
      return error('Vínculo ou status inválido.',400);
    const {data:member,error:memberError}=await supabase.from('organization_members')
      .select('id,user_id,organization_id,role,status').eq('id',memberId).maybeSingle();
    if(memberError||!member)return error('Vínculo não encontrado.',404);
    if(status==='active'){
      const [userResult,orgResult]=await Promise.all([
        supabase.from('profiles').select('id,status,is_super_admin').eq('id',member.user_id).maybeSingle(),
        supabase.from('organizations').select('id,status').eq('id',member.organization_id).maybeSingle()
      ]);
      if(userResult.error||orgResult.error)return error('Falha ao validar o usuário ou empresa.',500);
      if(!userResult.data||userResult.data.status!=='active'||userResult.data.is_super_admin||
        !orgResult.data||orgResult.data.status!=='active')
        return error('Só é possível reativar o vínculo de usuário comum e empresa ativos.',400);
    }
    const {error:updateError}=await supabase.from('organization_members')
      .update({status}).eq('id',memberId);
    if(updateError)return error('Não foi possível atualizar acesso: '+updateError.message,500);
    const {error:auditError}=await supabase.from('audit_logs').insert({
      user_id:auth.user.id,organization_id:member.organization_id,
      action:'membership_status',entity_type:'organization_member',entity_id:memberId,
      before:{status:member.status},after:{status}
    });
    return ok(status==='active'?'Acesso reativado.':'Acesso à empresa removido.',auditError?'Acesso alterado; auditoria não registrada.':null);
  }

  if(action==='user_status'){
    const status=String(input?.status||'');
    if(!good(userId)||!['active','suspended'].includes(status))return error('Usuário ou status inválido.',400);
    if(userId===auth.user.id)return error('Não é permitido suspender ou modificar sua própria conta administrativa.',403);
    const {data:user,error:userError}=await supabase.from('profiles')
      .select('id,is_super_admin,status').eq('id',userId).maybeSingle();
    if(userError||!user)return error('Usuário não encontrado.',404);
    if(user.is_super_admin)return error('Contas Super Admin não podem ser alteradas por esta ação.',403);
    const {error:updateError}=await supabase.from('profiles').update({status}).eq('id',userId);
    if(updateError)return error('Não foi possível atualizar usuário: '+updateError.message,500);
    const {error:auditError}=await supabase.from('audit_logs').insert({
      user_id:auth.user.id,action:'profile_status',entity_type:'profile',entity_id:userId,
      before:{status:user.status},after:{status}
    });
    return ok(status==='active'?'Usuário reativado.':'Usuário suspenso.',auditError?'Usuário atualizado; auditoria não registrada.':null);
  }

  return error('Ação administrativa inválida.',400);
}
