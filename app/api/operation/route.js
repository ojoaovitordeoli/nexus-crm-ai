import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {runLeadStageAutomations} from '../../../lib/automation-runner';
import {buildLeadTimeline,canManagePipeline,canWriteOperation,READ_ACTIONS} from '../../../lib/operation-rules.mjs';

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
    'id,title,status,priority,due_date,due_time,created_at,created_by,assigned_to,completed_at,lead_id',
    'id,first_name,last_name,whatsapp,created_at',
    'id,title,description,type,start_at,end_at,status,location,created_at,lead_id',
    'id,value,created_at,sale_date,lead_id,contact_id,seller_id'
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
    const st=await admin.from('pipeline_stages').select('id,name,position,color,is_won,is_lost')
      .eq('pipeline_id',pipelines.data[0].id).order('position',{ascending:true});
    if(st.error)warnings.push('etapas: '+st.error.message);
    else stages=st.data||[];
  }
  return reply({data,counts:total,pipeline,stages,warnings,role:auth.role,
    read_only:!canWriteOperation(auth.role),can_manage_pipeline:canManagePipeline(auth.role)});
}

export async function POST(request){
  const admin=service();
  if(!admin)return fails('Configuração do servidor pendente. Confira SUPABASE_SERVICE_ROLE_KEY no Render.',503);
  let payload;
  try{payload=await request.json()}catch{return fails('Dados inválidos.')}
  const orgId=String(payload?.org_id||'');
  const auth=await authorize(request,admin,orgId);
  if(auth.error)return fails(auth.error,auth.status);
  const action=String(payload?.action||'');
  if(!READ_ACTIONS.has(action)&&!canWriteOperation(auth.role))return fails('Seu perfil permite apenas visualizar os dados.',403);
  const base={organization_id:orgId};
  // Vínculo opcional com lead: só aceito se o lead pertencer à empresa autorizada.
  const linkedLead=async()=>{
    if(payload?.lead_id==null||payload?.lead_id==='')return {lead:null};
    if(!validId(payload.lead_id))return {error:'Lead inválido.',status:400};
    const {data,error}=await admin.from('leads').select('id,contact_id')
      .eq('id',payload.lead_id).eq('organization_id',orgId).maybeSingle();
    if(error)return {error:'Falha ao validar o lead: '+error.message,status:500};
    if(!data)return {error:'Lead não encontrado nesta empresa.',status:404};
    return {lead:data};
  };
  if(action==='lead_timeline'){
    if(!validId(payload?.lead_id))return fails('Lead inválido.');
    const {data:lead,error:leadError}=await admin.from('leads')
      .select('id,source,created_at,pipeline_id,pipeline_stage_id').eq('id',payload.lead_id).eq('organization_id',orgId).maybeSingle();
    if(leadError)return fails('Falha ao consultar o lead: '+leadError.message,500);
    if(!lead)return fails('Lead não encontrado nesta empresa.',404);
    const limit=100;
    const [history,tasks,appointments,sales,notes]=await Promise.all([
      admin.from('lead_stage_history').select('id,from_stage_id,to_stage_id,changed_by,changed_at').eq('lead_id',lead.id).order('changed_at',{ascending:false}).limit(limit),
      admin.from('tasks').select('id,title,status,due_date,created_at').eq('organization_id',orgId).eq('lead_id',lead.id).order('created_at',{ascending:false}).limit(limit),
      admin.from('appointments').select('id,title,status,start_at').eq('organization_id',orgId).eq('lead_id',lead.id).order('start_at',{ascending:false}).limit(limit),
      admin.from('sales').select('id,value,sale_date,created_at').eq('organization_id',orgId).eq('lead_id',lead.id).order('created_at',{ascending:false}).limit(limit),
      admin.from('notes').select('id,content,created_at').eq('organization_id',orgId).eq('lead_id',lead.id).order('created_at',{ascending:false}).limit(limit)
    ]);
    const warnings=[];
    const pick=(name,res)=>{if(res.error){warnings.push(name+': '+res.error.message);return []}return res.data||[]};
    const parts={history:pick('histórico',history),tasks:pick('tarefas',tasks),appointments:pick('agenda',appointments),sales:pick('vendas',sales),notes:pick('notas',notes)};
    // Nomes das etapas citadas no histórico, restritos aos funis desta empresa.
    const stageIds=[...new Set(parts.history.flatMap(h=>[h.from_stage_id,h.to_stage_id]).filter(validId))];
    let stages=[];
    if(stageIds.length){
      const st=await admin.from('pipeline_stages').select('id,name,pipeline:pipelines!inner(organization_id)')
        .in('id',stageIds).eq('pipeline.organization_id',orgId);
      if(st.error)warnings.push('etapas: '+st.error.message);else stages=st.data||[];
    }
    const events=buildLeadTimeline({lead,stages,...parts});
    return reply({ok:true,events,warnings,truncated:Object.values(parts).some(x=>x.length>=limit)});
  }
  if(action==='task_create'){
    const title=val(payload?.title);
    if(title.length<2)return fails('Digite uma tarefa com pelo menos 2 caracteres.');
    const priority=['low','medium','high','urgent'].includes(payload?.priority)?payload.priority:'medium';
    const due=payload?.due_date?safeDate(payload.due_date):null;
    if(payload?.due_date&&!due)return fails('Data inválida.');
    const link=await linkedLead();
    if(link.error)return fails(link.error,link.status);
    const {data,error}=await admin.from('tasks').insert({
      ...base,title,priority,due_date:due,created_by:auth.user.id,status:'pending',lead_id:link.lead?.id||null
    }).select('id,title,status,priority,due_date,lead_id').single();
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
    const link=await linkedLead();
    if(link.error)return fails(link.error,link.status);
    const {data,error}=await admin.from('appointments').insert({
      ...base,title,type,start_at:start,end_at:end,location,created_by:auth.user.id,status:'scheduled',lead_id:link.lead?.id||null
    }).select('id,title,start_at,status,type,lead_id').single();
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
    if(lead.pipeline_stage_id===stage.id)return reply({ok:true,message:'O lead já está nesta etapa.',history:'unchanged'});
    const {error:updateError}=await admin.from('leads').update({pipeline_stage_id:stage.id,pipeline_id:pipeline.id})
      .eq('id',lead.id).eq('organization_id',orgId);
    if(updateError)return fails('Falha ao mover lead: '+updateError.message,500);
    // Trilha de etapas. Ainda não é transacional com o update acima (próximo passo: RPC);
    // se falhar, a resposta informa explicitamente em vez de esconder.
    const trail=await admin.from('lead_stage_history').insert({
      lead_id:lead.id,from_stage_id:lead.pipeline_stage_id||null,to_stage_id:stage.id,changed_by:auth.user.id
    });
    // Execute only after the stage update was saved. Missing migration never blocks the lead.
    const automation=await runLeadStageAutomations(admin,{
      organizationId:orgId,leadId:lead.id,stageId:stage.id,actorId:auth.user.id
    });
    return reply({ok:true,message:trail.error?'Lead movido, mas o histórico da etapa não foi registrado.':'Lead movido no funil.',
      history:trail.error?'failed':'recorded',automation});
  }
  if(action==='pipeline_model_save'){
    if(!canManagePipeline(auth.role))return fails('Somente gerente ou administrador pode alterar a estrutura do funil.',403);
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
    if(cleanStages.some(x=>x.is_won&&x.is_lost))return fails('Uma etapa não pode ser ganha e perdida ao mesmo tempo.');
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
  if(action==='sale_create'){
    const value=Number(payload?.value);
    if(!Number.isFinite(value)||value<=0||value>100000000)return fails('Informe um valor de venda válido.');
    const link=await linkedLead();
    if(link.error)return fails(link.error,link.status);
    const {data,error}=await admin.from('sales').insert({
      organization_id:orgId,value,seller_id:auth.user.id,sale_date:new Date().toISOString(),
      lead_id:link.lead?.id||null,contact_id:link.lead?.contact_id||null
    }).select('id,value,created_at,lead_id').single();
    if(error)return fails('Falha ao registrar venda: '+error.message,500);
    return reply({ok:true,message:'Venda registrada e indicadores atualizados.',item:data},201);
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
