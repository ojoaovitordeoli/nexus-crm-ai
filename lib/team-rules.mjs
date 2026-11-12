// Quem pode gerenciar a equipe de uma empresa e o que pode fazer.
// Fonte de verdade é o servidor (app/api/team); a tela só esconde botões.

export const TEAM_ROLES=['ORGANIZATION_ADMIN','MANAGER','SDR','SELLER','VIEWER'];
export const ROLE_LABELS={AGENCY_ADMIN:'Admin da agência',ORGANIZATION_ADMIN:'Admin da empresa',MANAGER:'Gestor',SDR:'Pré-vendas (SDR)',SELLER:'Vendedor',VIEWER:'Somente leitura'};

/** Pode abrir a gestão de equipe desta empresa? */
export function canManageTeam({isSuperAdmin=false,role=''}={}){
  return Boolean(isSuperAdmin)||role==='AGENCY_ADMIN'||role==='ORGANIZATION_ADMIN';
}

/** Papéis que o autor pode atribuir. Admin da agência só o Super Admin concede. */
export function assignableRoles({isSuperAdmin=false}={}){
  return isSuperAdmin?['AGENCY_ADMIN',...TEAM_ROLES]:[...TEAM_ROLES];
}

/**
 * Pode alterar (papel/status) este vínculo?
 * Ninguém altera o próprio vínculo; quem não é Super Admin não mexe em Admin da agência.
 */
export function canChangeMember({actorId,isSuperAdmin=false,target}){
  if(!target)return {ok:false,reason:'Pessoa não encontrada nesta empresa.'};
  if(target.user_id===actorId)return {ok:false,reason:'Você não pode alterar o seu próprio acesso.'};
  if(!isSuperAdmin&&target.role==='AGENCY_ADMIN')return {ok:false,reason:'Este acesso é gerenciado pela agência.'};
  return {ok:true};
}

/** Validação do cadastro de uma pessoa nova. */
export function validateInvite({full_name,email,password,role},{isSuperAdmin=false}={}){
  const name=String(full_name||'').trim(),mail=String(email||'').trim().toLowerCase();
  if(name.length<2||name.length>150)return {ok:false,error:'Informe o nome completo.'};
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)||mail.length>254)return {ok:false,error:'E-mail inválido.'};
  if(typeof password!=='string'||password.length<12||password.length>128)return {ok:false,error:'A senha inicial precisa ter de 12 a 128 caracteres.'};
  if(!assignableRoles({isSuperAdmin}).includes(role))return {ok:false,error:'Escolha uma função válida.'};
  return {ok:true,value:{full_name:name,email:mail,password,role}};
}
