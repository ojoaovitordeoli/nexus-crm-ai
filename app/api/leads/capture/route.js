import {NextResponse} from 'next/server';
import {adminSupabase} from '../../../../lib/tenant-session';
import {isMissingSchema} from '../../../../lib/workflow-security.mjs';
import {supabaseCaptureStore} from '../../../../lib/lead-capture-store';
import {MAX_BODY_BYTES,captureLead} from '../../../../lib/lead-capture.mjs';

// V42: entrada de leads servidor → servidor (n8n, função do site, Make, Zapier), com chave por empresa.
// A empresa é descoberta pelo hash da chave; nada do corpo define organização, funil ou permissão.
// Não chame direto do navegador (a chave ficaria exposta). Contrato: docs/captura-de-leads.md
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=15;
const reply=(body,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store'}});

export async function POST(request){
  const type=request.headers.get('content-type')||'';
  if(!type.toLowerCase().startsWith('application/json'))return reply({error:'Use Content-Type: application/json.'},415);
  const raw=Buffer.from(await request.arrayBuffer());
  if(raw.length>MAX_BODY_BYTES)return reply({error:'Envio grande demais (máx. 16 KB).'},413);
  let body;try{body=JSON.parse(raw.toString('utf8'))}catch{return reply({error:'JSON inválido.'},400)}
  const admin=adminSupabase();
  if(!admin)return reply({error:'Servidor sem configuração de banco.'},503);
  try{
    const r=await captureLead({store:supabaseCaptureStore(admin),authorization:request.headers.get('authorization'),body});
    return reply(r.body,r.status);
  }catch(e){
    if(isMissingSchema(e))return reply({error:'Captura de leads não instalada no banco.',code:'not_installed'},503);
    return reply({error:'Falha ao gravar o lead. Tente de novo.'},503);
  }
}

export function GET(){return reply({error:'Use POST.'},405)}
