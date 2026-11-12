import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {authCreateUserError,logInternal} from '../../../lib/workflow-security.mjs';
import {ROLE_LABELS,assignableRoles,canChangeMember,canManageTeam,validateInvite} from '../../../lib/team-rules.mjs';

// Equipe da empresa: o admin da empresa (ou o Super Admin) cadastra, muda função e desativa pessoas.
// Tudo é verificado aqui no servidor: sessão, empresa ativa, vínculo e papel de quem pede.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});
const fail=(error,status=400)=>reply({error},status);

async function context(request,orgId){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL||'https://qhizuqcdxivdvjtefofz.supabase.co';
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!key)return {error:fail('Configuração do servidor pendente.',503)};
  const bearer=request.headers.get('authorization')||'';
  if(!bearer.startsWith('Bearer '))return {error:fail('Faça login para continuar.',401)};
  if(!UUID.test(orgId||''))return {error:fail('Empresa inválida.')};
  const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:auth,error:authError}=await admin.auth.getUser(bearer.slice(7).trim());
  if(authError||!auth?.user)return {error:fail('Sessão inválida ou expirada.',401)};
  const [profile,org,membership]=await Promise.all([
    admin.from('profiles').select('is_super_admin,status').eq('id',auth.user.id).maybeSingle(),
    admin.from('organizations').select('id,name,status').eq('id',orgId).maybeSingle(),
    admin.from('organization_members').select('role,status').eq('organization_id',orgId).eq('user_id',auth.user.id).maybeSingle()
  ]);
  if(profile.error||org.error||membership.error)return {error:fail('Não foi possível verificar seu acesso.',500)};
  if(profile.data?.status!=='active')return {error:fail('Seu usuário está inativo.',403)};
  if(!org.data||org.data.status!=='active')return {error:fail('Empresa não encontrada ou inativa.',404)};
  const isSuperAdmin=profile.data?.is_super_admin===true;
  const role=membership.data?.status==='active'?membership.data.role:'';
  if(!canManageTeam({isSuperAdmin,role}))return {error:fail('Só o administrador da empresa gerencia a equipe.',403)};
  return {admin,actorId:auth.user.id,isSuperAdmin,org:org.data};
}
async function audit(admin,c,action,entityId,before,after){
  const {error}=await admin.from('audit_logs').insert({user_id:c.actorId,organization_id:c.org.id,action,entity_type:'organization_member',entity_id:entityId,before,after});
  if(error)logInternal('team audit',error);
}

export async function GET(request){
  const orgId=new URL(request.url).searchParams.get('org_id')||'';
  const c=await context(request,orgId);if(c.error)return c.error;
  const {data:members,error}=await c.admin.from('organization_members')
    .select('id,user_id,role,status,joined_at').eq('organization_id',orgId).order('joined_at',{ascending:true}).limit(200);
  if(error){logInternal('team list',error);return fail('Falha ao carregar a equipe.',500)}
  const ids=(members||[]).map(m=>m.user_id);
  const {data:profiles}=ids.length?await c.admin.from('profiles').select('id,full_name,status').in('id',ids):{data:[]};
  const emails=await Promise.all(ids.map(id=>c.admin.auth.admin.getUserById(id).then(r=>[id,r.data?.user?.email||'']).catch(()=>[id,''])));
  const emailOf=Object.fromEntries(emails),profileOf=Object.fromEntries((profiles||[]).map(p=>[p.id,p]));
  return reply({
    organization:{id:c.org.id,name:c.org.name},
    can_assign:assignableRoles({isSuperAdmin:c.isSuperAdmin}).map(r=>({value:r,label:ROLE_LABELS[r]})),
    members:(members||[]).map(m=>({id:m.id,user_id:m.user_id,role:m.role,role_label:ROLE_LABELS[m.role]||m.role,status:m.status,
      joined_at:m.joined_at,full_name:profileOf[m.user_id]?.full_name||'Sem nome',email:emailOf[m.user_id]||'',
      is_me:m.user_id===c.actorId,editable:canChangeMember({actorId:c.actorId,isSuperAdmin:c.isSuperAdmin,target:m}).ok}))
  });
}

export async function POST(request){
  let input;try{input=await request.json()}catch{return fail('Solicitação inválida.')}
  const c=await context(request,String(input?.org_id||''));if(c.error)return c.error;
  const action=String(input?.action||'');

  if(action==='invite'){
    const v=validateInvite(input,{isSuperAdmin:c.isSuperAdmin});
    if(!v.ok)return fail(v.error);
    const {email,full_name,password,role}=v.value;
    const {data:created,error:createError}=await c.admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{full_name}});
    if(createError||!created?.user){
      const mapped=authCreateUserError(createError);
      // E-mail que já tem conta: o vínculo é feito pelo suporte, para uma empresa não "adotar" usuários de outra.
      if(mapped.status===409)return fail('Este e-mail já tem uma conta no sistema. Peça ao suporte para vincular essa pessoa à sua empresa.',409);
      return fail(mapped.message,mapped.status);
    }
    const userId=created.user.id;
    const prof=await c.admin.from('profiles').upsert({id:userId,full_name,status:'active',is_super_admin:false},{onConflict:'id'});
    if(prof.error){await c.admin.auth.admin.deleteUser(userId);logInternal('team profile',prof.error);return fail('Não foi possível criar o cadastro. Nada foi salvo.',500)}
    const mem=await c.admin.from('organization_members').insert({organization_id:c.org.id,user_id:userId,role,status:'active',invited_by:c.actorId,invited_at:new Date().toISOString()}).select('id').single();
    if(mem.error){await c.admin.auth.admin.deleteUser(userId);logInternal('team member',mem.error);return fail('Não foi possível vincular a pessoa. Nada foi salvo.',500)}
    await audit(c.admin,c,'membership_create',mem.data.id,null,{user_id:userId,email,role,status:'active'});
    return reply({ok:true,message:full_name+' foi cadastrado(a) como '+ROLE_LABELS[role]+'. Passe o e-mail e a senha inicial; a pessoa pode trocar a senha em "Esqueci minha senha".'},201);
  }

  if(action==='role'||action==='status'){
    const memberId=String(input?.member_id||'');
    if(!UUID.test(memberId))return fail('Pessoa inválida.');
    const {data:target,error}=await c.admin.from('organization_members').select('id,user_id,role,status')
      .eq('id',memberId).eq('organization_id',c.org.id).maybeSingle();
    if(error){logInternal('team target',error);return fail('Falha ao localizar a pessoa.',500)}
    const allowed=canChangeMember({actorId:c.actorId,isSuperAdmin:c.isSuperAdmin,target});
    if(!allowed.ok)return fail(allowed.reason,target?403:404);
    let values;
    if(action==='role'){
      if(!assignableRoles({isSuperAdmin:c.isSuperAdmin}).includes(input?.role))return fail('Escolha uma função válida.');
      values={role:input.role};
    }else{
      if(!['active','removed'].includes(input?.status))return fail('Situação inválida.');
      values={status:input.status};
    }
    const {error:updateError}=await c.admin.from('organization_members').update(values).eq('id',target.id).eq('organization_id',c.org.id);
    if(updateError){logInternal('team update',updateError);return fail('Não foi possível salvar.',500)}
    await audit(c.admin,c,'membership_update',target.id,{role:target.role,status:target.status},values);
    return reply({ok:true,message:action==='role'?'Função atualizada.':(values.status==='active'?'Acesso reativado.':'Acesso desativado. O histórico da pessoa continua na empresa.')});
  }
  return fail('Ação não reconhecida.');
}
