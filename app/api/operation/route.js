import {NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {runLeadStageAutomations} from '../../../lib/automation-runner';
import {describeRequirement,evaluateRequirements,statusForStage} from '../../../lib/stage-requirements.mjs';
import {buildLeadTimeline,canManagePipeline,canWriteOperation,localDateISO,parseDateTime,planPipelineStages,READ_ACTIONS,safeCalendarDate} from '../../../lib/operation-rules.mjs';
import {logInternal} from '../../../lib/workflow-security.mjs';
import {buildContacts,parseCsv} from '../../../lib/contact-import.mjs';
import {canDeleteRecord,canEditRecord,canEditSale,contactDeleteBlock} from '../../../lib/record-rules.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fails=(message,status=400)=>NextResponse.json({error:message},{status});
// Erro de banco: detalhe técnico só no log do servidor; a tela recebe mensagem em português.
const dbFail=(message,error)=>{logInternal(message,error);return fails(message+' Tente novamente em instantes.',500)};
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
const validateDateTime=parseDateTime;
const safeDate=safeCalendarDate;
const val=(value,max=190)=>String(value||'').trim().slice(0,max);

// Carrega lead, etapa de destino e requisitos obrigatórios, sempre restritos à empresa autorizada.
async function loadStageGate(admin,orgId,payload){
  if(!validId(payload?.id)||!validId(payload?.stage_id))return {error:'Lead ou etapa inválidos.',status:400};
  const {data:lead,error:leadError}=await admin.from('leads')
    .select('id,pipeline_id,pipeline_stage_id,source,estimated_value,lost_reason,closed_at')
    .eq('id',payload.id).eq('organization_id',orgId).is('deleted_at',null).maybeSingle();
  if(leadError||!lead)return {error:'Lead não encontrado.',status:404};
  const {data:stage,error:stageError}=await admin.from('pipeline_stages')
    .select('id,pipeline_id,name,is_won,is_lost').eq('id',payload.stage_id).maybeSingle();
  if(stageError||!stage)return {error:'Etapa não encontrada.',status:404};
  const {data:pipeline,error:pipelineError}=await admin.from('pipelines')
    .select('id,name').eq('id',stage.pipeline_id).eq('organization_id',orgId).maybeSingle();
  if(pipelineError||!pipeline)return {error:'A etapa não pertence à empresa.',status:403};
  const transfer=Boolean(lead.pipeline_id&&lead.pipeline_id!==pipeline.id);
  if(transfer&&payload?.transfer!==true)return {error:'A etapa pertence a outro funil. Use "Transferir de funil" para mudar o lead de funil.',status:400};

  const {data:reqRows,error:reqError}=await admin.from('pipeline_stage_requirements')
    .select('id,core_field,custom_field_id,question,position')
    .eq('organization_id',orgId).eq('pipeline_id',pipeline.id).eq('stage_id',stage.id).order('position',{ascending:true});
  if(reqError){logInternal('stage-gate',reqError);return {error:'Não foi possível verificar os campos obrigatórios da etapa.',status:500}};
  const cfIds=[...new Set((reqRows||[]).map(r=>r.custom_field_id).filter(Boolean))];
  let fields=[];
  if(cfIds.length){
    const cf=await admin.from('custom_fields').select('id,name,type,options').eq('organization_id',orgId).in('id',cfIds);
    if(cf.error){logInternal('stage-gate',cf.error);return {error:'Falha ao carregar campos personalizados.',status:500}};
    fields=cf.data||[];
  }
  const byId=new Map(fields.map(f=>[f.id,f]));
  // Requisito apontando para campo de outra empresa ou inexistente é ignorado (nunca exposto).
  const requirements=(reqRows||[]).map(r=>describeRequirement(r,byId.get(r.custom_field_id))).filter(Boolean);
  // Origem vira lista quando a empresa cadastrou origens (paridade com o Agendor).
  if(requirements.some(r=>r.kind==='core'&&r.field==='source')){
    const lo=await admin.from('lead_origins').select('name').eq('organization_id',orgId).eq('is_active',true).order('position',{ascending:true});
    const origins=lo.error?[]:(lo.data||[]).map(x=>x.name);
    if(origins.length)for(const r of requirements)if(r.kind==='core'&&r.field==='source'){r.type='select';r.options=origins}
  }

  const needs=new Set(requirements.map(r=>r.field));
  const current={
    'core:source':lead.source||null,
    'core:estimated_value':Number(lead.estimated_value)>0?Number(lead.estimated_value):null,
    'core:lost_reason':lead.lost_reason||null,
    'core:closed_at':lead.closed_at||null,
    'core:products':null
  };
  const ctx={lostReasons:[],products:[]};
  if(needs.has('products')){
    const [lp,pr]=await Promise.all([
      admin.from('lead_products').select('product_id,quantity').eq('lead_id',lead.id).eq('organization_id',orgId),
      admin.from('products').select('id,name,price,unit').eq('organization_id',orgId).eq('is_active',true).order('name',{ascending:true})
    ]);
    if(lp.error||pr.error)return {error:'Falha ao carregar produtos.',status:500};
    current['core:products']=(lp.data||[]).map(x=>({product_id:x.product_id,quantity:Number(x.quantity)||1}));
    ctx.products=pr.data||[];
  }
  if(needs.has('lost_reason')){
    const lr=await admin.from('lost_reasons').select('reason').eq('organization_id',orgId).eq('is_active',true).order('position',{ascending:true});
    if(lr.error)return {error:'Falha ao carregar motivos de perda.',status:500};
    ctx.lostReasons=(lr.data||[]).map(x=>x.reason);
  }
  if(cfIds.length){
    const cfv=await admin.from('custom_field_values').select('custom_field_id,value').eq('entity_id',lead.id).in('custom_field_id',cfIds);
    if(cfv.error){logInternal('stage-gate',cfv.error);return {error:'Falha ao carregar respostas salvas.',status:500}};
    for(const v of cfv.data||[])current['cf:'+v.custom_field_id]=v.value;
  }
  return {lead,stage,pipeline,transfer,requirements,current,ctx};
}
const reply=(payload,status=200)=>NextResponse.json(payload,{status});

export async function GET(request){
  const admin=service();
  if(!admin)return fails('Configuração do servidor pendente. Confira SUPABASE_SERVICE_ROLE_KEY no Render.',503);
  const orgId=new URL(request.url).searchParams.get('org_id');
  const auth=await authorize(request,admin,orgId);
  if(auth.error)return fails(auth.error,auth.status);

  const names=['leads','tasks','contacts','appointments','sales'];
  const fields=[
    'id,organization_id,source,status,temperature,created_at,closed_at,pipeline_id,pipeline_stage_id,estimated_value,contact:contacts(id,first_name,last_name,whatsapp)',
    'id,title,status,priority,due_date,due_time,created_at,created_by,assigned_to,completed_at,lead_id',
    'id,first_name,last_name,whatsapp,email,city,created_at',
    'id,title,description,type,start_at,end_at,status,location,created_at,lead_id',
    'id,value,created_at,sale_date,lead_id,contact_id,seller_id,contact:contacts(id,first_name,last_name)'
  ];
  // Contatos e leads excluídos ficam na "lixeira" (deleted_at) e não aparecem em lugar nenhum.
  const live=(q,name)=>name==='leads'||name==='contacts'?q.is('deleted_at',null):q;
  const requestRows=names.map((name,i)=>live(admin.from(name).select(fields[i]).eq('organization_id',orgId),name)
    .order(name==='appointments'?'start_at':'created_at',{ascending:name==='appointments'?true:false}).limit(250));
  const requestCounts=names.map(name=>live(admin.from(name).select('id',{count:'exact',head:true}).eq('organization_id',orgId),name));
  const [rows,counts,pipelines]=await Promise.all([
    Promise.all(requestRows),Promise.all(requestCounts),
    admin.from('pipelines').select('id,name,is_default,position,created_at').eq('organization_id',orgId)
      .order('position',{ascending:true}).order('created_at',{ascending:true}).limit(50)
  ]);
  const data={};const total={};const warnings=[];
  const LABEL={leads:'leads',tasks:'tarefas',contacts:'contatos',appointments:'agenda',sales:'vendas'};
  names.forEach((name,i)=>{
    if(rows[i].error){logInternal('GET '+name,rows[i].error);warnings.push(LABEL[name])}
    data[name]=rows[i].error?[]:(rows[i].data||[]);
    total[name]=counts[i].error?data[name].length:(counts[i].count||0);
    if(counts[i].error){logInternal('GET contagem '+name,counts[i].error);warnings.push('total de '+LABEL[name])}
  });
  // Funis múltiplos: todos os funis da empresa, padrão primeiro.
  const pipelineList=pipelines.error?[]:(pipelines.data||[]);
  if(pipelines.error){logInternal('GET funil',pipelines.error);warnings.push('funis')}
  const pipeline=pipelineList.find(p=>p.is_default)||pipelineList[0]||null;
  let allStages=[];
  if(pipelineList.length){
    const st=await admin.from('pipeline_stages').select('id,pipeline_id,name,position,color,is_won,is_lost')
      .in('pipeline_id',pipelineList.map(p=>p.id)).order('position',{ascending:true});
    if(st.error){logInternal('GET etapas',st.error);warnings.push('etapas do funil')}
    else allStages=st.data||[];
    const req=await admin.from('pipeline_stage_requirements').select('stage_id')
      .eq('organization_id',orgId).in('pipeline_id',pipelineList.map(p=>p.id));
    if(!req.error){
      const counter=new Map();
      for(const r of req.data||[])counter.set(r.stage_id,(counter.get(r.stage_id)||0)+1);
      allStages=allStages.map(s=>({...s,required_count:counter.get(s.id)||0}));
    }
  }
  const stages=pipeline?allStages.filter(s=>s.pipeline_id===pipeline.id):[];
  return reply({data,counts:total,pipeline,pipelines:pipelineList,stages,all_stages:allStages,warnings,role:auth.role,
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
      .eq('id',payload.lead_id).eq('organization_id',orgId).is('deleted_at',null).maybeSingle();
    if(error){logInternal('stage-gate',error);return {error:'Falha ao validar o lead.',status:500}};
    if(!data)return {error:'Lead não encontrado nesta empresa.',status:404};
    return {lead:data};
  };
  if(action==='lead_timeline'){
    if(!validId(payload?.lead_id))return fails('Lead inválido.');
    const {data:lead,error:leadError}=await admin.from('leads')
      .select('id,source,created_at,pipeline_id,pipeline_stage_id').eq('id',payload.lead_id).eq('organization_id',orgId).is('deleted_at',null).maybeSingle();
    if(leadError)return dbFail('Falha ao consultar o lead.',leadError);
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
    const pick=(name,res)=>{if(res.error){logInternal('timeline '+name,res.error);warnings.push(name);return []}return res.data||[]};
    const parts={history:pick('histórico',history),tasks:pick('tarefas',tasks),appointments:pick('agenda',appointments),sales:pick('vendas',sales),notes:pick('notas',notes)};
    // Nomes das etapas citadas no histórico, restritos aos funis desta empresa.
    const stageIds=[...new Set(parts.history.flatMap(h=>[h.from_stage_id,h.to_stage_id]).filter(validId))];
    let stages=[];
    if(stageIds.length){
      const st=await admin.from('pipeline_stages').select('id,name,pipeline:pipelines!inner(organization_id)')
        .in('id',stageIds).eq('pipeline.organization_id',orgId);
      if(st.error){logInternal('timeline etapas',st.error);warnings.push('nomes das etapas')}else stages=st.data||[];
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
    if(error)return dbFail('Falha ao criar tarefa.',error);
    return reply({ok:true,message:'Tarefa criada com sucesso.',item:data},201);
  }
  if(action==='task_status'){
    if(!validId(payload?.id))return fails('Tarefa inválida.');
    const status=['completed','pending','in_progress','cancelled'].includes(payload?.status)?payload.status:null;
    if(!status)return fails('Status inválido.');
    const {data,error}=await admin.from('tasks').update({
      status,completed_at:status==='completed'?new Date().toISOString():null
    }).eq('id',payload.id).eq('organization_id',orgId).select('id,status').maybeSingle();
    if(error)return dbFail('Falha ao atualizar tarefa.',error);
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
    if(payload?.end_at&&!end)return fails('Horário final inválido.');
    if(end&&new Date(end)<=new Date(start))return fails('O horário final deve ser posterior ao início.');
    const link=await linkedLead();
    if(link.error)return fails(link.error,link.status);
    const {data,error}=await admin.from('appointments').insert({
      ...base,title,type,start_at:start,end_at:end,location,created_by:auth.user.id,status:'scheduled',lead_id:link.lead?.id||null
    }).select('id,title,start_at,status,type,lead_id').single();
    if(error)return dbFail('Falha ao agendar.',error);
    return reply({ok:true,message:'Agendamento criado e salvo na agenda da empresa.',item:data},201);
  }
  if(action==='appointment_status'){
    if(!validId(payload?.id))return fails('Agendamento inválido.');
    const status=['scheduled','confirmed','completed','cancelled','no_show'].includes(payload?.status)?payload.status:null;
    if(!status)return fails('Status inválido.');
    const {data,error}=await admin.from('appointments').update({status})
      .eq('id',payload.id).eq('organization_id',orgId).select('id,status').maybeSingle();
    if(error)return dbFail('Falha ao atualizar agendamento.',error);
    if(!data)return fails('Agendamento não encontrado.',404);
    return reply({ok:true,message:'Agendamento atualizado.',item:data});
  }
  if(action==='lead_stage_requirements'||action==='lead_stage'){
    const gate=await loadStageGate(admin,orgId,payload);
    if(gate.error)return fails(gate.error,gate.status);
    const {lead,stage,pipeline,requirements,current,ctx}=gate;
    if(action==='lead_stage_requirements'){
      return reply({ok:true,stage,pipeline,transfer:gate.transfer,
        requirements:requirements.map(r=>({...r,value:current[r.key]??null})),
        lost_reasons:ctx.lostReasons,products:ctx.products});
    }
    if(lead.pipeline_stage_id===stage.id)return reply({ok:true,message:'O lead já está nesta etapa.'});
    const answers=payload?.answers&&typeof payload.answers==='object'&&!Array.isArray(payload.answers)?payload.answers:{};
    const result=evaluateRequirements(requirements,current,answers,{lostReasons:ctx.lostReasons,productIds:ctx.products.map(p=>p.id)});
    if(result.invalid.length)return reply({error:'Resposta inválida em: '+result.invalid.join(', ')+'.',invalid:result.invalid},422);
    if(result.missing.length)return reply({error:'Preencha os campos obrigatórios da etapa: '+result.missing.join(', ')+'.',missing:result.missing,requirements_required:true},422);

    // 1) grava as respostas (somente campos desta empresa, já validados)
    const leadPatch={};
    for(const {req,value} of result.changes){
      if(req.kind==='core'){
        if(req.field==='products'){
          const removed=await admin.from('lead_products').delete().eq('lead_id',lead.id).eq('organization_id',orgId);
          if(removed.error)return dbFail('Falha ao salvar produtos.',removed.error);
          if(value?.length){
            const price=new Map(ctx.products.map(p=>[p.id,p.price]));
            const inserted=await admin.from('lead_products').insert(value.map(v=>({
              organization_id:orgId,lead_id:lead.id,product_id:v.product_id,quantity:v.quantity,unit_price:price.get(v.product_id)??null
            })));
            if(inserted.error)return dbFail('Falha ao salvar produtos.',inserted.error);
          }
        }else leadPatch[req.field]=value;
      }else{
        const saved=value===null
          ?await admin.from('custom_field_values').delete().eq('custom_field_id',req.field).eq('entity_id',lead.id)
          :await admin.from('custom_field_values').upsert({custom_field_id:req.field,entity_id:lead.id,value,updated_at:new Date().toISOString()},{onConflict:'custom_field_id,entity_id'});
        if(saved.error)return dbFail('Falha ao salvar "'+req.label+'".',saved.error);
      }
    }
    // 2) move o lead
    const now=new Date().toISOString();
    const status=statusForStage(stage);
    const {error:updateError}=await admin.from('leads').update({
      ...leadPatch,pipeline_stage_id:stage.id,pipeline_id:pipeline.id,status,stage_changed_at:now,
      // Data de conclusão no dia local (não UTC). Negócio reaberto volta sem data de conclusão.
      ...(status!=='active'&&!leadPatch.closed_at&&!current['core:closed_at']?{closed_at:localDateISO()}:{}),
      ...(status==='active'&&!('closed_at' in leadPatch)&&current['core:closed_at']?{closed_at:null}:{})
    }).eq('id',lead.id).eq('organization_id',orgId);
    if(updateError)return dbFail('Falha ao mover lead.',updateError);
    // 3) trilha de auditoria da etapa
    const history=await admin.from('lead_stage_history').insert({
      lead_id:lead.id,from_stage_id:lead.pipeline_stage_id||null,to_stage_id:stage.id,changed_by:auth.user.id,
      note:gate.transfer?'Transferido do funil para "'+pipeline.name+'"':null
    });
    // Execute only after the stage update was saved. Missing migration never blocks the lead.
    const automation=await runLeadStageAutomations(admin,{
      organizationId:orgId,leadId:lead.id,stageId:stage.id,actorId:auth.user.id
    });
    return reply({ok:true,message:(gate.transfer?'Lead transferido para '+pipeline.name+'.':'Lead movido para '+stage.name+'.')+(history.error?' O histórico da etapa não foi registrado.':''),
      automation,history_saved:!history.error,history:history.error?'failed':'recorded'});
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
    if(payload?.pipeline_id&&!validId(payload.pipeline_id))return fails('Modelo de funil inválido.');
    let pipelineId=validId(payload?.pipeline_id)?payload.pipeline_id:null;
    let knownIds=new Set();
    if(pipelineId){
      const {data:owned,error:ownedError}=await admin.from('pipelines').select('id').eq('id',pipelineId).eq('organization_id',orgId).maybeSingle();
      if(ownedError||!owned)return fails('Modelo de funil não encontrado nesta empresa.',404);
      const current=await admin.from('pipeline_stages').select('id').eq('pipeline_id',pipelineId);
      if(current.error)return dbFail('Falha ao carregar as etapas do funil.',current.error);
      knownIds=new Set((current.data||[]).map(x=>x.id));
      const {error:updateError}=await admin.from('pipelines').update({name}).eq('id',pipelineId).eq('organization_id',orgId);
      if(updateError)return dbFail('Falha ao atualizar o modelo.',updateError);
    }else{
      const {data:newPipeline,error:newError}=await admin.from('pipelines').insert({organization_id:orgId,name,is_default:false,position:0}).select('id').single();
      if(newError)return dbFail('Falha ao criar o modelo.',newError);
      pipelineId=newPipeline.id;
    }
    // Etapa com id de outro funil (ou repetido) era "atualizada" sem efeito e sumia do modelo salvo.
    const planned=planPipelineStages(cleanStages,knownIds);
    for(const stage of planned){
      const values={name:stage.name,color:stage.color,position:stage.position,is_won:stage.is_won,is_lost:stage.is_lost};
      const result=stage.id
        ?await admin.from('pipeline_stages').update(values).eq('id',stage.id).eq('pipeline_id',pipelineId)
        :await admin.from('pipeline_stages').insert({pipeline_id:pipelineId,...values});
      if(result.error)return dbFail('Falha ao salvar etapa.',result.error);
    }
    let kept=0;
    if(payload?.pipeline_id){
      const existing=await admin.from('pipeline_stages').select('id').eq('pipeline_id',pipelineId);
      if(existing.error)return dbFail('Falha ao verificar etapas removidas.',existing.error);
      const keep=new Set(planned.filter(x=>x.id).map(x=>x.id));
      for(const old of (existing.data||[]).filter(x=>!keep.has(x.id))){
        const used=await admin.from('leads').select('id',{count:'exact',head:true}).eq('organization_id',orgId).eq('pipeline_stage_id',old.id);
        if(used.error)return dbFail('Falha ao verificar leads da etapa.',used.error);
        if((used.count||0)>0){kept++;continue}
        // Etapa com histórico de movimentação é preservada para não quebrar a trilha de auditoria.
        const tracked=await admin.from('lead_stage_history').select('id',{count:'exact',head:true}).or('from_stage_id.eq.'+old.id+',to_stage_id.eq.'+old.id);
        if(tracked.error||(tracked.count||0)>0){kept++;continue}
        const removed=await admin.from('pipeline_stages').delete().eq('id',old.id).eq('pipeline_id',pipelineId);
        if(removed.error)return dbFail('Falha ao remover etapa.',removed.error);
      }
    }
    if(payload?.activate){
      const clear=await admin.from('pipelines').update({is_default:false}).eq('organization_id',orgId);
      if(clear.error)return dbFail('Falha ao preparar ativação.',clear.error);
      const activate=await admin.from('pipelines').update({is_default:true}).eq('id',pipelineId).eq('organization_id',orgId);
      if(activate.error)return dbFail('Falha ao ativar o modelo.',activate.error);
    }
    const keptNote=kept?' '+kept+(kept>1?' etapas removidas foram mantidas':' etapa removida foi mantida')+' porque ainda tem leads ou histórico.':'';
    return reply({ok:true,message:(payload?.activate?'Modelo salvo e ativado.':'Modelo salvo como rascunho.')+keptNote,pipeline_id:pipelineId,kept_stages:kept});
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
    if(error)return dbFail('Falha ao registrar venda.',error);
    return reply({ok:true,message:'Venda registrada e indicadores atualizados.',item:data},201);
  }
  if(action==='lead_create'){
    const contactId=String(payload?.contact_id||'');
    if(!validId(contactId))return fails('Selecione o contato do lead.');
    const contact=await admin.from('contacts').select('id,first_name,last_name')
      .eq('id',contactId).eq('organization_id',orgId).is('deleted_at',null).maybeSingle();
    if(contact.error)return dbFail('Falha ao validar o contato.',contact.error);
    if(!contact.data)return fails('Contato não encontrado nesta empresa.',404);
    // Funil de destino: o informado ou o padrão da empresa.
    const pipes=await admin.from('pipelines').select('id,name,is_default,position,created_at')
      .eq('organization_id',orgId).order('position',{ascending:true}).order('created_at',{ascending:true}).limit(50);
    if(pipes.error)return dbFail('Falha ao carregar os funis.',pipes.error);
    const list=pipes.data||[];
    const fallback=list.find(p=>p.is_default)||list[0]||null;
    let target=fallback;
    if(payload?.pipeline_id){
      if(!validId(payload.pipeline_id))return fails('Funil inválido.');
      target=list.find(p=>p.id===payload.pipeline_id)||null;
      if(!target)return fails('Funil não encontrado nesta empresa.',404);
    }
    if(!target)return fails('Crie um funil antes de cadastrar leads.',409);
    const st=await admin.from('pipeline_stages').select('id,name,position,is_won,is_lost')
      .eq('pipeline_id',target.id).order('position',{ascending:true});
    if(st.error)return dbFail('Falha ao carregar as etapas do funil.',st.error);
    const first=(st.data||[]).find(x=>!x.is_won&&!x.is_lost)||null;
    if(!first)return fails('Configure ao menos uma etapa ativa no funil "'+target.name+'" antes de cadastrar leads.',409);
    // Um atendimento aberto por contato em cada funil (lead sem funil conta no padrão).
    const open=await admin.from('leads').select('id,pipeline_id').eq('organization_id',orgId).is('deleted_at',null)
      .eq('contact_id',contactId).is('closed_at',null).limit(50);
    if(open.error)return dbFail('Falha ao verificar atendimentos abertos.',open.error);
    const defaultId=fallback?.id||null;
    const clash=(open.data||[]).some(l=>(l.pipeline_id||defaultId)===target.id);
    if(clash)return fails('Este contato já tem um atendimento aberto no funil "'+target.name+'". Abra o lead existente em vez de criar outro.',409);
    const source=val(payload?.source,120)||null;
    const {data,error}=await admin.from('leads').insert({
      ...base,contact_id:contactId,pipeline_id:target.id,pipeline_stage_id:first.id,
      status:'active',source,created_by:auth.user.id,stage_changed_at:new Date().toISOString()
    }).select('id,contact_id,pipeline_id,pipeline_stage_id,source,created_at').single();
    if(error)return dbFail('Falha ao criar o lead.',error);
    // Trilha: registra a entrada na primeira etapa; falha aqui não desfaz o lead.
    const trail=await admin.from('lead_stage_history').insert({lead_id:data.id,from_stage_id:null,to_stage_id:first.id,changed_by:auth.user.id});
    if(trail.error)logInternal('Falha ao registrar a trilha do lead criado.',trail.error);
    const person=[contact.data.first_name,contact.data.last_name].filter(Boolean).join(' ').trim()||'contato';
    return reply({ok:true,message:'Lead de '+person+' criado na etapa "'+first.name+'" do funil "'+target.name+'".',item:data},201);
  }
  // ---------- Corrigir e excluir registros (V31) ----------
  const auditLog=async(action,entity,id,before,after)=>{
    const {error}=await admin.from('audit_logs').insert({user_id:auth.user.id,organization_id:orgId,action,entity_type:entity,entity_id:id,before,after});
    if(error)logInternal('audit '+action,error);
  };
  const noDelete=()=>fails('Excluir é permitido só para gestor ou administrador.',403);
  if(action==='contact_update'){
    if(!validId(payload?.id))return fails('Contato inválido.');
    const first_name=val(payload?.first_name,130),last_name=val(payload?.last_name,130)||null;
    const whatsapp=String(payload?.whatsapp||'').replace(/\D/g,'');
    const email=val(payload?.email,200)||null,city=val(payload?.city,120)||null;
    if(first_name.length<2)return fails('Informe o nome do contato.');
    if(whatsapp&&!(whatsapp.length>=10&&whatsapp.length<=13))return fails('WhatsApp inválido. Informe DDD e número.');
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return fails('E-mail inválido.');
    const {data,error}=await admin.from('contacts').update({first_name,last_name,whatsapp:whatsapp||null,email,city,updated_at:new Date().toISOString()})
      .eq('id',payload.id).eq('organization_id',orgId).is('deleted_at',null).select('id').maybeSingle();
    if(error)return dbFail('Falha ao salvar o contato.',error);
    if(!data)return fails('Contato não encontrado nesta empresa.',404);
    await auditLog('contact_update','contact',data.id,null,{first_name,last_name,whatsapp:whatsapp||null,email,city});
    return reply({ok:true,message:'Contato atualizado.'});
  }
  if(action==='contact_delete'){
    if(!canDeleteRecord(auth.role))return noDelete();
    if(!validId(payload?.id))return fails('Contato inválido.');
    const open=await admin.from('leads').select('id',{count:'exact',head:true}).eq('organization_id',orgId).eq('contact_id',payload.id).is('deleted_at',null).is('closed_at',null);
    if(open.error)return dbFail('Falha ao verificar atendimentos.',open.error);
    const block=contactDeleteBlock(open.count);
    if(block)return fails(block,409);
    const {data,error}=await admin.from('contacts').update({deleted_at:new Date().toISOString()})
      .eq('id',payload.id).eq('organization_id',orgId).is('deleted_at',null).select('id,first_name').maybeSingle();
    if(error)return dbFail('Falha ao excluir o contato.',error);
    if(!data)return fails('Contato não encontrado nesta empresa.',404);
    await auditLog('contact_delete','contact',data.id,{first_name:data.first_name},{deleted:true});
    return reply({ok:true,message:'Contato excluído.'});
  }
  if(action==='lead_update'){
    if(!validId(payload?.id))return fails('Lead inválido.');
    const patch={updated_at:new Date().toISOString()};
    if('source' in (payload||{}))patch.source=val(payload.source,120)||null;
    if('estimated_value' in (payload||{})){
      if(payload.estimated_value===null||payload.estimated_value==='')patch.estimated_value=null;
      else{const v=Number(payload.estimated_value);if(!Number.isFinite(v)||v<0||v>1000000000)return fails('Valor inválido.');patch.estimated_value=v}
    }
    const {data,error}=await admin.from('leads').update(patch).eq('id',payload.id).eq('organization_id',orgId).is('deleted_at',null).select('id').maybeSingle();
    if(error)return dbFail('Falha ao salvar o lead.',error);
    if(!data)return fails('Lead não encontrado nesta empresa.',404);
    await auditLog('lead_update','lead',data.id,null,patch);
    return reply({ok:true,message:'Lead atualizado.'});
  }
  if(action==='lead_delete'){
    if(!canDeleteRecord(auth.role))return noDelete();
    if(!validId(payload?.id))return fails('Lead inválido.');
    const {data,error}=await admin.from('leads').update({deleted_at:new Date().toISOString()})
      .eq('id',payload.id).eq('organization_id',orgId).is('deleted_at',null).select('id,contact_id,pipeline_stage_id').maybeSingle();
    if(error)return dbFail('Falha ao excluir o lead.',error);
    if(!data)return fails('Lead não encontrado nesta empresa.',404);
    await auditLog('lead_delete','lead',data.id,{contact_id:data.contact_id,pipeline_stage_id:data.pipeline_stage_id},{deleted:true});
    return reply({ok:true,message:'Lead excluído. Tarefas e vendas ligadas a ele continuam registradas.'});
  }
  if(action==='sale_update'||action==='sale_delete'){
    if(!validId(payload?.id))return fails('Venda inválida.');
    const {data:sale,error:saleError}=await admin.from('sales').select('id,value,lead_id,contact_id,seller_id,sale_date').eq('id',payload.id).eq('organization_id',orgId).maybeSingle();
    if(saleError)return dbFail('Falha ao localizar a venda.',saleError);
    if(!sale)return fails('Venda não encontrada nesta empresa.',404);
    if(action==='sale_delete'){
      if(!canDeleteRecord(auth.role))return noDelete();
      const {error}=await admin.from('sales').delete().eq('id',sale.id).eq('organization_id',orgId);
      if(error)return dbFail('Falha ao excluir a venda.',error);
      await auditLog('sale_delete','sale',sale.id,sale,null);
      return reply({ok:true,message:'Venda excluída.'});
    }
    if(!canEditSale({role:auth.role,actorId:auth.user.id,sellerId:sale.seller_id}))return fails('Você só pode corrigir as suas próprias vendas.',403);
    const value=Number(payload?.value);
    if(!Number.isFinite(value)||value<=0||value>100000000)return fails('Informe um valor de venda válido.');
    const patch={value,updated_at:new Date().toISOString()};
    if('lead_id' in (payload||{})){
      if(!payload.lead_id){patch.lead_id=null;patch.contact_id=null}
      else{const link=await linkedLead();if(link.error)return fails(link.error,link.status);patch.lead_id=link.lead.id;patch.contact_id=link.lead.contact_id||null}
    }
    const {error}=await admin.from('sales').update(patch).eq('id',sale.id).eq('organization_id',orgId);
    if(error)return dbFail('Falha ao salvar a venda.',error);
    await auditLog('sale_update','sale',sale.id,{value:sale.value,lead_id:sale.lead_id},patch);
    return reply({ok:true,message:'Venda corrigida.'});
  }
  if(action==='task_update'||action==='task_delete'){
    if(!validId(payload?.id))return fails('Tarefa inválida.');
    if(action==='task_delete'){
      if(!canEditRecord(auth.role))return fails('Seu perfil permite apenas visualizar os dados.',403);
      const {data,error}=await admin.from('tasks').delete().eq('id',payload.id).eq('organization_id',orgId).select('id,title').maybeSingle();
      if(error)return dbFail('Falha ao excluir a tarefa.',error);
      if(!data)return fails('Tarefa não encontrada nesta empresa.',404);
      await auditLog('task_delete','task',data.id,{title:data.title},null);
      return reply({ok:true,message:'Tarefa excluída.'});
    }
    const title=val(payload?.title,190);
    if(title.length<2)return fails('Informe o título da tarefa.');
    const due=payload?.due_date?safeDate(payload.due_date):null;
    if(payload?.due_date&&!due)return fails('Data inválida.');
    const priority=['low','medium','high','urgent'].includes(payload?.priority)?payload.priority:'medium';
    const {data,error}=await admin.from('tasks').update({title,due_date:due,priority,updated_at:new Date().toISOString()})
      .eq('id',payload.id).eq('organization_id',orgId).select('id').maybeSingle();
    if(error)return dbFail('Falha ao salvar a tarefa.',error);
    if(!data)return fails('Tarefa não encontrada nesta empresa.',404);
    return reply({ok:true,message:'Tarefa atualizada.'});
  }
  if(action==='appointment_update'){
    if(!validId(payload?.id))return fails('Compromisso inválido.');
    const title=val(payload?.title);
    const start=validateDateTime(payload?.start_at);
    if(title.length<2)return fails('Informe o título do compromisso.');
    if(!start)return fails('Data e horário inválidos.');
    const {data,error}=await admin.from('appointments').update({title,start_at:start,location:val(payload?.location,220)||null,updated_at:new Date().toISOString()})
      .eq('id',payload.id).eq('organization_id',orgId).select('id').maybeSingle();
    if(error)return dbFail('Falha ao salvar o compromisso.',error);
    if(!data)return fails('Compromisso não encontrado nesta empresa.',404);
    await auditLog('appointment_update','appointment',data.id,null,{title,start_at:start});
    return reply({ok:true,message:'Compromisso atualizado.'});
  }
  if(action==='contacts_import'){
    // O servidor refaz a leitura e a validação; a prévia do navegador é só conferência.
    const csv=typeof payload?.csv==='string'?payload.csv:'';
    if(!csv.trim())return fails('Envie a planilha em CSV.');
    if(csv.length>1500000)return fails('Planilha grande demais. Divida em arquivos de até 2.000 linhas.',413);
    const parsed=buildContacts(parseCsv(csv));
    if(parsed.error)return fails(parsed.error);
    if(!parsed.contacts.length)return fails('Nenhum contato válido para importar.');
    // Duplicados já cadastrados na empresa (mesmo WhatsApp) não são recriados.
    const phones=[...new Set(parsed.contacts.map(c=>c.whatsapp).filter(Boolean))];
    const existing=new Set();
    for(let i=0;i<phones.length;i+=200){
      const chunk=phones.slice(i,i+200);
      const variants=chunk.flatMap(p=>[p,'55'+p]);
      const {data,error}=await admin.from('contacts').select('whatsapp').eq('organization_id',orgId).is('deleted_at',null).in('whatsapp',variants);
      if(error)return dbFail('Falha ao verificar contatos existentes.',error);
      (data||[]).forEach(r=>{const d=String(r.whatsapp||'').replace(/\D/g,'');existing.add(d.length>11&&d.startsWith('55')?d.slice(2):d)});
    }
    const fresh=parsed.contacts.filter(c=>!c.whatsapp||!existing.has(c.whatsapp));
    let created=0;
    for(let i=0;i<fresh.length;i+=500){
      const rows=fresh.slice(i,i+500).map(c=>({...base,...c,created_by:auth.user.id}));
      const {error}=await admin.from('contacts').insert(rows);
      if(error){
        logInternal('contacts_import',error);
        return reply({ok:false,error:'A importação parou no meio: '+created+' contato(s) foram criados antes do erro. Tente de novo com o restante.',created},500);
      }
      created+=rows.length;
    }
    const skipped=parsed.contacts.length-fresh.length;
    const parts=[created+' contato(s) importado(s)'];
    if(skipped)parts.push(skipped+' já existia(m) na empresa');
    if(parsed.duplicates)parts.push(parsed.duplicates+' repetido(s) na planilha');
    if(parsed.invalid.length)parts.push(parsed.invalid.length+' linha(s) com problema');
    return reply({ok:true,message:parts.join(' · ')+'.',created,skipped,duplicates:parsed.duplicates,invalid:parsed.invalid.slice(0,50),truncated:Boolean(parsed.truncated)},201);
  }
  if(action==='contact_create'){
    const first_name=val(payload?.first_name,130);
    const whatsapp=String(payload?.whatsapp||'').replace(/\D/g,'');
    if(first_name.length<2)return fails('Informe o nome do contato.');
    if(whatsapp&&!(whatsapp.length>=10&&whatsapp.length<=13))return fails('WhatsApp inválido. Informe DDD e número.');
    const {data,error}=await admin.from('contacts').insert({
      ...base,first_name,whatsapp:whatsapp||null,created_by:auth.user.id
    }).select('id,first_name,whatsapp').single();
    if(error)return dbFail('Falha ao salvar contato.',error);
    return reply({ok:true,message:'Contato criado com sucesso.',item:data},201);
  }
  return fails('Ação não reconhecida.');
}
