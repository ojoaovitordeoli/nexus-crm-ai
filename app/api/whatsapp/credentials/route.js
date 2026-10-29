import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../../lib/tenant-session';
import {isUuid} from '../../../../lib/workflow-security.mjs';
import {encryptMetaToken} from '../../../../lib/whatsapp-crypto.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail=(message,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});

export async function POST(request){
 let body;
 try{body=await request.json()}catch{return fail('Dados inválidos.')}
 const organizationId=String(body?.org_id||'');
 const connectionId=String(body?.connection_id||'');
 const token=String(body?.access_token||'').trim();
 if(!isUuid(connectionId))return fail('Selecione um canal válido.');
 if(token.length<20||token.length>4096||!/^[A-Za-z0-9_.-]+$/.test(token))return fail('Informe um token de acesso válido da Meta.');
 const key=process.env.META_TOKEN_ENCRYPTION_KEY;
 if(!key||!/^[a-f\d]{64}$/i.test(key))return fail('Configure a chave de criptografia no ambiente do servidor.',503);
 const db=adminSupabase();
 if(!db)return fail('Servidor sem conexão ao banco.',503);
 const auth=await authorizeTenant(request,db,organizationId);
 if(auth.error)return fail(auth.error,auth.status);
 // Credential administration is platform-owner only, not company-manager.
 const {data:profile}=await db.from('profiles').select('is_super_admin').eq('id',auth.user.id).maybeSingle();
 if(!profile?.is_super_admin)return fail('Somente o Super Admin pode configurar credenciais da Meta.',403);
 const {data:conn,error:lookupError}=await db.from('whatsapp_connections').select('id,status').eq('id',connectionId).eq('organization_id',organizationId).maybeSingle();
 if(lookupError)return fail('Não foi possível consultar o canal.',500);
 if(!conn||conn.status==='disabled')return fail('Canal inválido ou desabilitado.',404);
 let encrypted;
 try{encrypted=encryptMetaToken(token,key)}catch{return fail('Token ou chave inválidos.')}
 const {error}=await db.from('whatsapp_connection_secrets').upsert({
   connection_id:conn.id,organization_id:organizationId,token_ciphertext:encrypted,
   configured_by:auth.user.id,updated_at:new Date().toISOString()
 },{onConflict:'connection_id'});
 if(error)return fail('Não foi possível salvar a credencial. Confira a migração SQL.',503);
 return NextResponse.json({ok:true,message:'Credencial protegida registrada. O envio depende de canal ativo e janela de atendimento aberta.'},{headers:{'Cache-Control':'no-store'}});
}
