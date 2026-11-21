import {NextResponse} from 'next/server';
import {adminSupabase} from '../../../lib/tenant-session.js';
import {logInternal} from '../../../lib/workflow-security.mjs';
import {monthRange} from '../../../lib/sale-rules.mjs';
import {createRateLimiter} from '../../../lib/assistant/rules.mjs';
import {empresasPermitidas,PAPEIS_AGENCIA} from '../../../lib/agencia.mjs';

// V63 — Visão da agência. Só leitura. A lista de empresas é decidida AQUI, a partir da sessão:
// super admin vê as ativas; os demais, só as empresas em que têm vínculo ativo de gestão.
// Cada consulta é filtrada por organization_id da empresa permitida; nada vem do navegador.
export const runtime='nodejs';
export const dynamic='force-dynamic';
const MAX_EMPRESAS=60;
const reply=(b,s=200)=>NextResponse.json(b,{status:s,headers:{'cache-control':'no-store'}});
const fail=(error,s=400)=>reply({error},s);
const limiter=createRateLimiter({perUserPerMinute:12,perOrgPerHour:600});
const DIA=86400000;

async function contar(q){const {count,error}=await q;if(error)throw error;return count||0}

async function metricasDe(admin,orgId,agora){
  const iso=t=>new Date(t).toISOString();
  const h=new Date(agora);h.setHours(0,0,0,0);
  const hojeDia=h.toISOString().slice(0,10);
  const sete=iso(agora-7*DIA),trinta=iso(agora-30*DIA),quatorze=iso(agora-14*DIA);
  const range=monthRange(undefined,agora);
  const leads=()=>admin.from('leads').select('id',{count:'exact',head:true}).eq('organization_id',orgId).is('deleted_at',null);
  const [leadsAbertos,parados,leadsNovos30,tarefasVencidas,semPresenca,faltas30,compareceram30,vendas,meta]=await Promise.all([
    contar(leads().is('closed_at',null)),
    contar(leads().is('closed_at',null).or('stage_changed_at.lt.'+sete+',and(stage_changed_at.is.null,created_at.lt.'+sete+')')),
    contar(leads().gte('created_at',trinta)),
    contar(admin.from('tasks').select('id',{count:'exact',head:true}).eq('organization_id',orgId).not('status','in','(completed,done,cancelled)').lt('due_date',hojeDia)),
    contar(admin.from('appointments').select('id',{count:'exact',head:true}).eq('organization_id',orgId).in('status',['scheduled','confirmed']).lt('start_at',iso(agora)).gte('start_at',quatorze)),
    contar(admin.from('appointments').select('id',{count:'exact',head:true}).eq('organization_id',orgId).eq('status','no_show').gte('start_at',trinta).lt('start_at',iso(agora))),
    contar(admin.from('appointments').select('id',{count:'exact',head:true}).eq('organization_id',orgId).eq('status','completed').gte('start_at',trinta).lt('start_at',iso(agora))),
    admin.from('sales').select('value').eq('organization_id',orgId)
      .or('and(sale_date.gte.'+range.fromIso+',sale_date.lt.'+range.toIso+'),and(sale_date.is.null,created_at.gte.'+range.fromIso+',created_at.lt.'+range.toIso+')').limit(20000),
    admin.from('goals').select('target_value').eq('organization_id',orgId).eq('entity_type','org').eq('metric','revenue').eq('period','monthly').eq('start_date',range.start).is('user_id',null).limit(1)
  ]);
  if(vendas.error)throw vendas.error;
  return {leadsAbertos,parados,leadsNovos30,tarefasVencidas,semPresenca,faltas30,compareceram30,
    faturamentoMes:(vendas.data||[]).reduce((n,r)=>n+(Number(r.value)||0),0),vendasMes:(vendas.data||[]).length,
    meta:meta.error?null:(Number(meta.data?.[0]?.target_value)||null)};
}

export async function GET(request){
  const admin=adminSupabase();
  if(!admin)return fail('Configuração do servidor pendente.',503);
  const header=request.headers.get('authorization')||'';
  if(!header.startsWith('Bearer '))return fail('Faça login para continuar.',401);
  const {data:auth,error:authError}=await admin.auth.getUser(header.slice(7).trim());
  if(authError||!auth?.user)return fail('Sua sessão expirou. Entre novamente.',401);
  const {data:profile,error:pe}=await admin.from('profiles').select('id,status,is_super_admin').eq('id',auth.user.id).maybeSingle();
  if(pe||!profile||profile.status!=='active')return fail('Sua conta está inativa ou sem permissão.',403);
  const limited=limiter('agencia',auth.user.id);if(limited)return fail(limited,429);

  let membros=[],orgs=[];
  if(profile.is_super_admin){
    const r=await admin.from('organizations').select('id,name,status').eq('status','active').order('name').limit(MAX_EMPRESAS);
    if(r.error){logInternal('agencia orgs',r.error);return fail('Não foi possível carregar as empresas.',500)}
    orgs=r.data||[];
  }else{
    const m=await admin.from('organization_members').select('organization_id,role,status').eq('user_id',auth.user.id).eq('status','active').in('role',PAPEIS_AGENCIA).limit(MAX_EMPRESAS);
    if(m.error){logInternal('agencia membros',m.error);return fail('Não foi possível carregar as empresas.',500)}
    membros=m.data||[];
    const ids=[...new Set(membros.map(x=>x.organization_id))];
    if(ids.length){
      const r=await admin.from('organizations').select('id,name,status').in('id',ids).order('name');
      if(r.error){logInternal('agencia orgs',r.error);return fail('Não foi possível carregar as empresas.',500)}
      orgs=r.data||[];
    }
  }
  const permitidas=empresasPermitidas({isSuperAdmin:Boolean(profile.is_super_admin),membros,orgs});
  if(!permitidas.length)return reply({empresas:[],aviso:'Você não gerencia nenhuma empresa. A visão da agência é para quem administra ou gerencia empresas.'});

  const agora=Date.now();
  const empresas=await Promise.all(permitidas.map(async o=>{
    try{return {id:o.id,nome:o.name,metricas:await metricasDe(admin,o.id,agora)}}
    catch(e){logInternal('agencia metricas',e);return {id:o.id,nome:o.name,metricas:null,erro:'Não foi possível ler os números desta empresa agora.'}}
  }));
  return reply({empresas,geradoEm:new Date(agora).toISOString()});
}
