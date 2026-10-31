import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {runLeadStageAutomations} from '../../../lib/automation-runner';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fails=(message,status=400)=>NextResponse.json({error:message},{status});
const validId=value=>uuid.test(String(value||''));
const service=()=>process.env.SUPABASE_SERVICE_ROLE_KEY
  ?createClient(process.env.NEXT_PUBLIC_SUPABASE_URL||'https://qhizuqcdxivdvjtefofz.supabase.co',process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}})
  :null;

async function authorize(request,admin,orgId){
  if(!validId(orgId))return {error:'Empresa inválida.',status:400};
  const authorization=request.headers.get('authorization')||'';
  if(!authorization.startsWith('Bearer '))return {error:'Faça login para continuar.',status:401};
  const {data:auth,error:authError}=await admin.auth.getUser(authorization.slice(7).trim());
  if(authError||!auth?.user)return {error:'Sua sessão expirou. Entre novamente.',status:401};
  const {data:profile,error:profileError}=await admin.from('profiles')
    .select('id,status,is_super_admin').eq('id',auth.user.id).maybeSingle();
  if(profileError||!profile||profile.status!=='active')return {error:'Sua conta está inativa ou sem permissão.',status:403};
  const {data:company,error:companyError}=await admin.from('organizations')
    .select('id,status').eq('id',orgId).maybeSingle();
  if(companyError||!company||company.status!=='active')return {error:'A empresa está inativa ou não existe.',status:403};
  if(profile.is_super_admin)return {user:auth.user,role:'AGENCY_ADMIN'};
  const {data:member,error:memberError}=await admin.from('organization_members')
    .select('role,status').eq('user_id',auth.user.id).eq('organization_id',orgId).eq('status','active').maybeSingle();
  if(memberError||!member)return {error:'Você não tem acesso a esta empresa.',status:403};
  return {user:auth.user,role:member.role};
}
function validateDateTime(value){
  const d=new Date(value);
  return Number.isFinite(d.getTime())?d.toISOString():null;
}
function safeDate(value){
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))?String(value):null;
}
const val=(value,max=190)=>String(value||'').trim().slice(0,max);
const reply=(payload,status=200)=>NextResponse.json(payload,{status});

export async function GET(request){
  const admin=service();
  if(!admin)return fails('Configuração do servidor pendente. Confira SUPABASE_SERVICE_ROLE_KEY no Render.',503);
  const orgId=new URL(request.url).searchParams.get('org_id');
  const auth=await authorize(request,admin,orgId);
  if(auth.error)return fails(auth.error,auth.status);

  const names=['leads','tasks','contacts','appointments','sales'];
  const fields=[
    'id,organization_id,source,status,temperature,created_at,pipeline_stage_id,contact:contacts(id,first_name,last_name,whatsapp)',
    'id,title,status,priority,due_date,due_time,created_at,created_by,assigned_to,completed_at',
    'id,first_name,last_name,whatsapp,created_at',
    'id,title,description,type,start_at,end_at,status,location,created_at',
    'id,value,created_at'
  ];
  const requestRows=names.map((name,i)=>admin.from(name).select(fields[i]).eq('organization_id',orgId)
    .order(name==='appointments'?'start_at':'created_at',{ascending:name==='appointments'?true:false}).limit(250));
  const requestCounts=names.map(name=>admin.from(name).select('id',{count:'exact',head:true}).eq('organization_id',orgId));
  const [rows,counts,pipelines]=await Promise.all([
    Promise.all(requestRows),Promise.all(requestCounts),
    admin.from('pipelines').select('id,name').eq('organization_id',orgId).order('created_at',{ascending:true}).limit(1)
  ]);
  const data={};const total={};const warnings=[];
  names.forEach((name,i)=>{
    if(rows[i].error)warnings.push(name+': '+rows[i].error.message);
    data[name]=rows[i].error?[]:(rows[i].data||[]);
    total[name]=counts[i].error?data[name].length:(counts[i].count||0);
    if(counts[i].error)warnings.push('contagem '+name+': '+counts[i].error.message);
  });
  let stages=[];
  let pipeline=null;
  if(pipelines.error)warnings.push('funil: '+pipelines.error.message);
  if(pipelines.data?.[0]){
    pipeline=pipelines.data[0];
    const st=await admin.from('pipeline_stages').select('id,name,position,color')
      .eq('pipeline_id',pipelines.data[0].id).order('position',{ascending:true});
    if(st.error)warnings.push('etapas: '+st.error.message);
    else stages=st.data||[];
  }
  return reply({data,counts:total,pipeline,stages,warnings,read_only:auth.role==='VIEWER'});
}

export async function POST(request){
  const admin=service();
  if(!admin)return fails('Configuração do servidor pendente. Confira SUPABASE_SERVICE_ROLE_KEY no Render.',503);
  let payload;
  try{payload=await request.json()}catch{return fails('Dados inválidos.')}
  const orgId=String(payload?.org_id||'');
  const auth=await authorize(request,admin,orgId);
  if(auth.error)return fails(auth.error,auth.status);
  if(auth.role==='VIEWER')return fails('Seu perfil permite apenas visualizar os dados.',403);
  const action=String(payload?.action||'');
  const base={organization_id:orgId};
  if(action==='task_create'){
    const title=val(payload?.title);
    if(title.length<2)return fails('Digite uma tarefa com pelo menos 2 caracteres.');
    const priority=['low','medium','high','urgent'].includes(payload?.priority)?payload.priority:'medium';
    const due=payload?.due_date?safeDate(payload.due_date):null;
    if(payload?.due_date&&!due)return fails('Data inválida.');
    const {data,error}=await admin.from('tasks').insert({
      ...base,title,priority,due_date:due,created_by:auth.user.id,status:'pending'
    }).select('id,title,status,priority,due_date').single();
    if(error)return fails('Falha ao criar tarefa: '+error.message,500);
    return reply({ok:true,message:'Tarefa criada com sucesso.',item:data},201);
  }
  if(action==='task_status'){
    if(!validId(payload?.id))return fails('Tarefa inválida.');
    const status=['completed','pending','in_progress','cancelled'].includes(payload?.status)?payload.status:null;
    if(!status)return fails('Status inválido.');
    const {data,error}=await admin.from('tasks').update({
      status,completed_at:status==='completed'?new Date().toISOString():null
    }).eq('id',payload.id).eq('organization_id',orgId).select('id,status').maybeSingle();
    if(error)return fails('Falha ao atualizar tarefa: '+error.message,500);
    if(!data)return fails('Tarefa não encontrada nesta empresa.',404);
    return reply({ok:true,message:'Tarefa atualizada.',item:data});
  }
  if(action==='appointment_create'){
    const title=val(payload?.title);
    const start=validateDateTime(payload?.start_at);
    if(title.length<2)return fails('Informe o título do agendamento.');
    if(!start)return fails('Informe data e horário válidos.');
    const type=['call','followup','exam','consultation','visit','meeting','return'].includes(payload?.type)?payload.type:'meeting';
    const location=val(payload?.location,220)||null;
    const end=payload?.end_at?validateDateTime(payload.end_at):null;
    if(end&&new Date(end)<=new Date(start))return fails('O horário final deve ser posterior ao início.');
    const {data,error}=await admin.from('appointments').insert({
      ...base,title,type,start_at:start,end_at:end,location,created_by:auth.user.id,status:'scheduled'
    }).select('id,title,start_at,status,type').single();
    if(error)return fails('Falha ao agendar: '+error.message,500);
    return reply({ok:true,message:'Agendamento criado e salvo na agenda da empresa.',item:data},201);
  }
  if(action==='appointment_status'){
    if(!validId(payload?.id))return fails('Agendamento inválido.');
    const status=['scheduled','confirmed','completed','cancelled','no_show'].includes(payload?.status)?payload.status:null;
    if(!status)return fails('Status inválido.');
    const {data,error}=await admin.from('appointments').update({status})
      .eq('id',payload.id).eq('organization_id',orgId).select('id,status').maybeSingle();
    if(error)return fails('Falha ao atualizar agendamento: '+error.message,500);
    if(!data)return fails('Agendamento não encontrado.',404);
    return reply({ok:true,message:'Agendamento atualizado.',item:data});
  }
  if(action==='lead_stage'){
    if(!validId(payload?.id)||!validId(payload?.stage_id))return fails('Lead ou etapa inválidos.');
    const {data:lead,error:leadError}=await admin.from('leads').select('id,pipeline_id,pipeline_stage_id')
      .eq('id',payload.id).eq('organization_id',orgId).maybeSingle();
    if(leadError||!lead)return fails('Lead não encontrado.',404);
    const {data:stage,error:stageError}=await admin.from('pipeline_stages')
      .select('id,pipeline_id').eq('id',payload.stage_id).maybeSingle();
    if(stageError||!stage)return fails('Etapa não encontrada.',404);
    const {data:pipeline,error:pipelineError}=await admin.from('pipelines')
      .select('id').eq('id',stage.pipeline_id).eq('organization_id',orgId).maybeSingle();
    if(pipelineError||!pipeline)return fails('A etapa não pertence à empresa.',403);
    if(lead.pipeline_id&&lead.pipeline_id!==pipeline.id)return fails('A etapa pertence a outro funil.',400);
    const {error:updateError}=await admin.from('leads').update({pipeline_stage_id:stage.id,pipeline_id:pipeline.id})
      .eq('id',lead.id).eq('organization_id',orgId);
    if(updateError)return fails('Falha ao mover lead: '+updateError.message,500);
    // Execute only after the stage update was saved. Missing migration never blocks the lead.
    const automation=await runLeadStageAutomations(admin,{
      organizationId:orgId,leadId:lead.id,stageId:stage.id,actorId:auth.user.id
    });
    return reply({ok:true,message:'Lead movido no funil.',automation});
  }
  if(action==='pipeline_model_save'){
    const name=val(payload?.name,120);
    const incoming=Array.isArray(payload?.stages)?payload.stages:[];
    if(name.length<2)return fails('Informe um nome para o modelo de funil.');
    if(incoming.length<2||incoming.length>30)return fails('O funil precisa ter entre 2 e 30 etapas.');
    const cleanStages=incoming.map((stage,index)=>({
      id:validId(stage?.id)?stage.id:null,
      name:val(stage?.name,90),
      color:/^#[0-9a-f]{6}$/i.test(String(stage?.color||''))?String(stage.color):'#3b82f6',
      position:index,
      is_won:Boolean(stage?.is_won),
      is_lost:Boolean(stage?.is_lost)
    }));
    if(cleanStages.some(x=>x.name.length<2))return fails('Todas as etapas precisam ter nome.');
    let pipelineId=validId(payload?.pipeline_id)?payload.pipeline_id:null;
    if(pipelineId){
      const {data:owned,error:ownedError}=await admin.from('pipelines').select('id').eq('id',pipelineId).eq('organization_id',orgId).maybeSingle();
      if(ownedError||!owned)return fails('Modelo de funil não encontrado nesta empresa.',404);
      const {error:updateError}=await admin.from('pipelines').update({name}).eq('id',pipelineId).eq('organization_id',orgId);
      if(updateError)return fails('Falha ao atualizar o modelo: '+updateError.message,500);
    }else{
      const {data:newPipeline,error:newError}=await admin.from('pipelines').insert({organization_id:orgId,name,is_default:false,position:0}).select('id').single();
      if(newError)return fails('Falha ao criar o modelo: '+newError.message,500);
      pipelineId=newPipeline.id;
    }
    for(const stage of cleanStages){
      const values={name:stage.name,color:stage.color,position:stage.position,is_won:stage.is_won,is_lost:stage.is_lost};
      const result=stage.id
        ?await admin.from('pipeline_stages').update(values).eq('id',stage.id).eq('pipeline_id',pipelineId)
        :await admin.from('pipeline_stages').insert({pipeline_id:pipelineId,...values});
      if(result.error)return fails('Falha ao salvar etapa: '+result.error.message,500);
    }
    if(payload?.pipeline_id){
      const existing=await admin.from('pipeline_stages').select('id').eq('pipeline_id',pipelineId);
      if(existing.error)return fails('Falha ao verificar etapas removidas: '+existing.error.message,500);
      const keep=new Set(cleanStages.filter(x=>x.id).map(x=>x.id));
      for(const old of (existing.data||[]).filter(x=>!keep.has(x.id))){
        const used=await admin.from('leads').select('id',{count:'exact',head:true}).eq('organization_id',orgId).eq('pipeline_stage_id',old.id);
        if(used.error)return fails('Falha ao verificar leads da etapa: '+used.error.message,500);
        if((used.count||0)>0)continue;
        const removed=await admin.from('pipeline_stages').delete().eq('id',old.id).eq('pipeline_id',pipelineId);
        if(removed.error)return fails('Falha ao remover etapa: '+removed.error.message,500);
      }
    }
    if(payload?.activate){
      const clear=await admin.from('pipelines').update({is_default:false}).eq('organization_id',orgId);
      if(clear.error)return fails('Falha ao preparar ativação: '+clear.error.message,500);
      const activate=await admin.from('pipelines').update({is_default:true}).eq('id',pipelineId).eq('organization_id',orgId);
      if(activate.error)return fails('Falha ao ativar o modelo: '+activate.error.message,500);
    }
    return reply({ok:true,message:payload?.activate?'Modelo salvo e ativado.':'Modelo salvo como rascunho.',pipeline_id:pipelineId});
  }
  if(action==='contact_create'){
    const first_name=val(payload?.first_name,130);
    const whatsapp=String(payload?.whatsapp||'').replace(/\D/g,'');
    if(first_name.length<2)return fails('Informe o nome do contato.');
    if(whatsapp&&!(whatsapp.length>=10&&whatsapp.length<=13))return fails('WhatsApp inválido. Informe DDD e número.');
    const {data,error}=await admin.from('contacts').insert({
      ...base,first_name,whatsapp:whatsapp||null,created_by:auth.user.id
    }).select('id,first_name,whatsapp').single();
    if(error)return fails('Falha ao salvar contato: '+error.message,500);
    return reply({ok:true,message:'Contato criado com sucesso.',item:data},201);
  }
  return fails('Ação não reconhecida.');
}
