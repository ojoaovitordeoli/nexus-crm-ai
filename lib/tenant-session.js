import {createClient} from '@supabase/supabase-js';
import {isUuid} from './workflow-security.mjs';

export function adminSupabase(){
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  if(!key||!url)return null;
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
export async function authorizeTenant(request,admin,organizationId){
  if(!isUuid(organizationId))return {error:'Empresa inválida.',status:400};
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Bearer '))return {error:'Faça login para continuar.',status:401};
  const {data:auth,error:authError}=await admin.auth.getUser(header.slice(7).trim());
  if(authError||!auth?.user)return {error:'Sua sessão expirou. Entre novamente.',status:401};
  const {data:profile,error:profileError}=await admin.from('profiles')
    .select('id,is_super_admin,status').eq('id',auth.user.id).maybeSingle();
  if(profileError||!profile||profile.status!=='active')return {error:'Conta inativa ou acesso inválido.',status:403};
  const {data:company,error:companyError}=await admin.from('organizations')
    .select('id,status').eq('id',organizationId).maybeSingle();
  if(companyError||!company||company.status!=='active')return {error:'Empresa inativa ou inexistente.',status:403};
  if(profile.is_super_admin)return {user:auth.user,role:'AGENCY_ADMIN'};
  const {data:member,error:memberError}=await admin.from('organization_members')
    .select('role').eq('organization_id',organizationId).eq('user_id',auth.user.id)
    .eq('status','active').maybeSingle();
  if(memberError||!member)return {error:'Você não tem permissão nesta empresa.',status:403};
  return {user:auth.user,role:member.role};
}
