import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../lib/tenant-session';
import {isMissingSchema} from '../../../lib/workflow-security.mjs';
import {supabaseProspectingStore} from '../../../lib/prospecting-store';
import {changeStatus,listForMember,parseListFilters,revokeAll,rotateToken} from '../../../lib/prospecting-alerts.mjs';

// Notificações da prospecção automática para o Admin da empresa e o Super Admin.
// Sessão, empresa ativa, vínculo e papel são conferidos aqui (authorizeTenant + canSeeProspecting).
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});

async function guarded(run){
  try{const r=await run();return reply(r.body,r.status)}
  catch(e){
    if(isMissingSchema(e))return reply({error:'As notificações da prospecção ainda não foram ativadas no banco desta instalação.',code:'not_installed'},503);
    return reply({error:'Não foi possível acessar as notificações agora. Tente de novo.'},500);
  }
}
async function context(request,orgId){
  const admin=adminSupabase();
  if(!admin)return {error:reply({error:'Configuração do servidor pendente.'},503)};
  const auth=await authorizeTenant(request,admin,orgId);
  if(auth.error)return {error:reply({error:auth.error},auth.status)};
  return {store:supabaseProspectingStore(admin),access:{isSuperAdmin:auth.isSuperAdmin,role:auth.role},actorId:auth.user.id};
}

export async function GET(request){
  const params=new URL(request.url).searchParams,orgId=params.get('org_id')||'';
  const c=await context(request,orgId);if(c.error)return c.error;
  const f=parseListFilters(params);if(!f.ok)return reply({error:f.error},400);
  return guarded(()=>listForMember({store:c.store,access:c.access,orgId,filters:f.value}));
}

export async function POST(request){
  let input;try{input=await request.json()}catch{return reply({error:'Solicitação inválida.'},400)}
  const orgId=String(input?.org_id||'');
  const c=await context(request,orgId);if(c.error)return c.error;
  const base={store:c.store,access:c.access,orgId,actorId:c.actorId};
  const action=String(input?.action||'');
  if(action==='status')return guarded(()=>changeStatus({...base,alertId:input.alert_id,status:String(input.status||'')}));
  if(action==='rotate_token')return guarded(()=>rotateToken(base));
  if(action==='revoke_token')return guarded(()=>revokeAll(base));
  return reply({error:'Ação desconhecida.'},400);
}
