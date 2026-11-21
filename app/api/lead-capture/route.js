import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../lib/tenant-session';
import {isMissingSchema} from '../../../lib/workflow-security.mjs';
import {supabaseCaptureStore} from '../../../lib/lead-capture-store';
import {captureStatus,revokeCaptureTokens,rotateCaptureToken} from '../../../lib/lead-capture.mjs';

// V42: gestão da chave de captura de leads (Configurações). Sessão, empresa ativa, vínculo e
// papel conferidos aqui (authorizeTenant + canManageCapture). A chave só aparece ao ser gerada.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});

async function guarded(run){
  try{const r=await run();return reply(r.body,r.status)}
  catch(e){
    if(isMissingSchema(e))return reply({error:'A captura de leads ainda não foi ativada no banco desta instalação.',code:'not_installed'},503);
    return reply({error:'Não foi possível acessar a captura de leads agora. Tente de novo.'},500);
  }
}
async function context(request,orgId){
  const admin=adminSupabase();
  if(!admin)return {error:reply({error:'Configuração do servidor pendente.'},503)};
  const auth=await authorizeTenant(request,admin,orgId);
  if(auth.error)return {error:reply({error:auth.error},auth.status)};
  return {store:supabaseCaptureStore(admin),access:{isSuperAdmin:auth.isSuperAdmin,role:auth.role},actorId:auth.user.id};
}

export async function GET(request){
  const orgId=new URL(request.url).searchParams.get('org_id')||'';
  const c=await context(request,orgId);if(c.error)return c.error;
  return guarded(()=>captureStatus({store:c.store,access:c.access,orgId}));
}

export async function POST(request){
  let input;try{input=await request.json()}catch{return reply({error:'Solicitação inválida.'},400)}
  const orgId=String(input?.org_id||'');
  const c=await context(request,orgId);if(c.error)return c.error;
  const base={store:c.store,access:c.access,orgId,actorId:c.actorId};
  const action=String(input?.action||'');
  if(action==='rotate_token')return guarded(()=>rotateCaptureToken(base));
  if(action==='revoke_token')return guarded(()=>revokeCaptureTokens(base));
  return reply({error:'Ação desconhecida.'},400);
}
