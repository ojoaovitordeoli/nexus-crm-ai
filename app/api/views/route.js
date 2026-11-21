import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../lib/tenant-session.js';
import {logInternal} from '../../../lib/workflow-security.mjs';
import {validarReceita} from '../../../lib/views/spec.mjs';
import {montarTela} from '../../../lib/views/run.mjs';
import {createRateLimiter} from '../../../lib/assistant/rules.mjs';
import {vocabulario} from '../../../lib/vocabulario.mjs';

// V51 — Minhas telas: salvar, listar, abrir (buscar dados de novo) e apagar telas montadas pelo assistente.
// Sempre: sessão + empresa conferidas no servidor (authorizeTenant), receita revalidada e dono = quem está logado.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_TELAS=30;
const MAX_INICIO=4; // V53: telas fixadas na tela inicial
const reply=(b,s=200)=>NextResponse.json(b,{status:s,headers:{'cache-control':'no-store'}});
const fail=(error,s=400,extra={})=>reply({error,...extra},s);
const limiter=createRateLimiter({perUserPerMinute:40,perOrgPerHour:2000});
const isUuid=v=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v||''));
const semTabela=e=>e&&(e.code==='42P01'||e.code==='PGRST205'||/user_views/.test(String(e.message||''))&&/does not exist|schema cache/.test(String(e.message||'')));
const INDISPONIVEL='"Minhas telas" ainda não foi ativado no banco. Você pode montar telas pelo assistente; salvar fica disponível depois da ativação.';

async function contexto(request,orgId){
  const admin=adminSupabase();
  if(!admin)return {erro:fail('Configuração do servidor pendente.',503)};
  const auth=await authorizeTenant(request,admin,orgId);
  if(auth.error)return {erro:fail(auth.error,auth.status)};
  const limited=limiter(orgId,auth.user.id);
  if(limited)return {erro:fail(limited,429)};
  return {admin,auth};
}

export async function GET(request){
  const orgId=new URL(request.url).searchParams.get('org_id')||'';
  const c=await contexto(request,orgId);if(c.erro)return c.erro;
  // V53: palavras do ramo da empresa (organizations.segment) para o assistente e a tela inicial.
  const {data:org}=await c.admin.from('organizations').select('segment').eq('id',orgId).maybeSingle();
  const vocab=vocabulario(org?.segment);
  let {data,error}=await c.admin.from('user_views').select('id,name,spec,position,updated_at,on_home')
    .eq('organization_id',orgId).eq('user_id',c.auth.user.id).order('position').order('created_at').limit(MAX_TELAS);
  // Antes da migração V53 a coluna on_home não existe: lista sem ela (ninguém fica sem as telas).
  if(error&&/on_home/.test(String(error.message||''))){
    ({data,error}=await c.admin.from('user_views').select('id,name,spec,position,updated_at')
      .eq('organization_id',orgId).eq('user_id',c.auth.user.id).order('position').order('created_at').limit(MAX_TELAS));
  }
  if(error){if(semTabela(error))return reply({telas:[],indisponivel:true,aviso:INDISPONIVEL,vocab});logInternal('views list',error);return fail('Não consegui carregar suas telas.',500)}
  return reply({vocab,telas:(data||[]).map(t=>({id:t.id,nome:t.name,spec:t.spec,atualizado:t.updated_at,inicio:t.on_home===true}))});
}

export async function POST(request){
  let input;try{input=await request.json()}catch{return fail('Solicitação inválida.')}
  const orgId=String(input?.org_id||'');
  const c=await contexto(request,orgId);if(c.erro)return c.erro;
  if(String(input?.acao||'')==='fixar'){
    // V53: fixar/desafixar na tela inicial. Só a própria tela, nesta empresa; no máximo MAX_INICIO.
    const id=String(input?.id||'');if(!isUuid(id))return fail('Tela inválida.');
    const on=input?.inicio===true;
    if(on){
      const {count,error:e1}=await c.admin.from('user_views').select('id',{count:'exact',head:true}).eq('organization_id',orgId).eq('user_id',c.auth.user.id).eq('on_home',true).neq('id',id);
      if(e1){if(/on_home/.test(String(e1.message||'')))return fail('Fixar na tela inicial ainda não foi ativado no banco.',503,{indisponivel:true});logInternal('views pin count',e1);return fail('Não consegui fixar agora.',500)}
      if((count||0)>=MAX_INICIO)return fail('Você já tem '+MAX_INICIO+' telas na tela inicial. Tire uma para fixar outra.',409);
    }
    const {data,error}=await c.admin.from('user_views').update({on_home:on,updated_at:new Date().toISOString()}).eq('id',id).eq('organization_id',orgId).eq('user_id',c.auth.user.id).select('id');
    if(error){if(/on_home/.test(String(error.message||'')))return fail('Fixar na tela inicial ainda não foi ativado no banco.',503,{indisponivel:true});logInternal('views pin',error);return fail('Não consegui fixar agora.',500)}
    if(!data?.length)return fail('Tela não encontrada.',404);
    return reply({ok:true,inicio:on});
  }
  const v=validarReceita(input?.spec);
  if(!v.ok)return fail(v.erro);
  const acao=String(input?.acao||'');

  if(acao==='abrir'){
    try{return reply({tela:await montarTela({admin:c.admin,orgId,spec:v.spec})})}
    catch(e){logInternal('views run',e?.cause||e);return fail('Não consegui montar a tela agora.',500)}
  }
  if(acao==='salvar'){
    const nome=String(input?.nome||v.spec.titulo).replace(/[\u0000-\u001f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,80)||v.spec.titulo;
    const {count,error:countError}=await c.admin.from('user_views').select('id',{count:'exact',head:true}).eq('organization_id',orgId).eq('user_id',c.auth.user.id);
    if(countError){if(semTabela(countError))return fail(INDISPONIVEL,503,{indisponivel:true});logInternal('views count',countError);return fail('Não consegui salvar agora.',500)}
    if((count||0)>=MAX_TELAS)return fail('Você já tem '+MAX_TELAS+' telas salvas. Apague uma para salvar outra.',409);
    const {data,error}=await c.admin.from('user_views').insert({organization_id:orgId,user_id:c.auth.user.id,name:nome,spec:{...v.spec,titulo:nome},position:count||0}).select('id,name,spec').single();
    if(error){if(semTabela(error))return fail(INDISPONIVEL,503,{indisponivel:true});logInternal('views save',error);return fail('Não consegui salvar agora.',500)}
    return reply({tela:{id:data.id,nome:data.name,spec:data.spec}},201);
  }
  return fail('Ação inválida.');
}

export async function DELETE(request){
  const url=new URL(request.url);
  const orgId=url.searchParams.get('org_id')||'',id=url.searchParams.get('id')||'';
  if(!isUuid(id))return fail('Tela inválida.');
  const c=await contexto(request,orgId);if(c.erro)return c.erro;
  // Dono conferido no próprio filtro: só apaga se a tela for de quem está logado, nesta empresa.
  const {data,error}=await c.admin.from('user_views').delete().eq('id',id).eq('organization_id',orgId).eq('user_id',c.auth.user.id).select('id');
  if(error){if(semTabela(error))return fail(INDISPONIVEL,503,{indisponivel:true});logInternal('views delete',error);return fail('Não consegui apagar agora.',500)}
  if(!data?.length)return fail('Tela não encontrada.',404);
  return reply({ok:true});
}
