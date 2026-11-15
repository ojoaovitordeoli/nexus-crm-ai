import {NextResponse} from 'next/server';
import {adminSupabase} from '../../../../lib/tenant-session';
import {isMissingSchema} from '../../../../lib/workflow-security.mjs';
import {supabaseProspectingStore} from '../../../../lib/prospecting-store';
import {MAX_BODY_BYTES,ingestAlerts} from '../../../../lib/prospecting-alerts.mjs';

// Entrada do vigia local (vigia_nexo.py): servidor → servidor, com token por empresa.
// A empresa é descoberta pelo hash do token; nada do corpo define organização ou permissão.
// Contrato completo: docs/prospeccao-notificacoes.md
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=15;
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});

export async function POST(request){
  const type=request.headers.get('content-type')||'';
  if(!type.toLowerCase().startsWith('application/json'))return reply({error:'Use Content-Type: application/json.'},415);
  const raw=Buffer.from(await request.arrayBuffer());
  if(raw.length>MAX_BODY_BYTES)return reply({error:'Envio grande demais (máx. 64 KB).'},413);
  let body;try{body=JSON.parse(raw.toString('utf8'))}catch{return reply({error:'JSON inválido.'},400)}
  const admin=adminSupabase();
  if(!admin)return reply({error:'Servidor sem configuração de banco.'},503);
  try{
    const r=await ingestAlerts({store:supabaseProspectingStore(admin),authorization:request.headers.get('authorization'),body});
    return reply(r.body,r.status);
  }catch(e){
    if(isMissingSchema(e))return reply({error:'Notificações da prospecção não instaladas no banco.',code:'not_installed'},503);
    return reply({error:'Falha ao gravar. Tente de novo (o reenvio não duplica).'},503);
  }
}

export function GET(){return reply({error:'Use POST.'},405)}
