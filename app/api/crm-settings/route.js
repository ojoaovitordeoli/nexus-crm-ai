import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../lib/tenant-session';
import {logInternal} from '../../../lib/workflow-security.mjs';
import {CATALOGS,CATALOG_KINDS,AGENDOR_TEMPLATE,canConfigureCrm,isId,validateCatalogName,validateField,validateRequirements,missingNames,sameName} from '../../../lib/crm-catalogs.mjs';

// Cadastros do funil (paridade com Agendor). Toda leitura/escrita é restrita à empresa
// autorizada no servidor; escrita somente para gestão (canConfigureCrm).
export const runtime='nodejs';
export const dynamic='force-dynamic';

const reply=(payload,status=200)=>NextResponse.json(payload,{status});
const fail=(message,status=400)=>reply({error:message},status);
// Detalhe técnico só no log do servidor; a tela recebe texto em português.
const dbFail=(message,error)=>{logInternal('crm-settings: '+message,typeof error==='string'?{message:error}:error);return fail(message+' Tente novamente em instantes.',500)};
const MISSING=['42P01','PGRST205','42703','PGRST204'];

async function context(request,orgId){
  const admin=adminSupabase();
  if(!admin)return {error:'Configuração do servidor pendente. Confira SUPABASE_SERVICE_ROLE_KEY no Render.',status:503};
  const auth=await authorizeTenant(request,admin,orgId);
  return auth.error?auth:{admin,...auth};
}

async function loadCatalog(admin,orgId,kind){
  const c=CATALOGS[kind];
  const {data,error}=await admin.from(c.table).select(`id,${c.column},position,is_active`)
    .eq('organization_id',orgId).order('position',{ascending:true}).order(c.column,{ascending:true});
  if(error)return {kind,installed:!MISSING.includes(error.code),items:[],error:MISSING.includes(error.code)?null:(logInternal('crm-settings catálogo '+kind,error),'Falha ao carregar.')};
  return {kind,installed:true,items:(data||[]).map(r=>({id:r.id,name:r[c.column],position:r.position,is_active:r.is_active}))};
}

export async function GET(request){
  const orgId=new URL(request.url).searchParams.get('org_id');
  const ctx=await context(request,orgId);
  if(ctx.error)return fail(ctx.error,ctx.status);
  const {admin}=ctx;
  const [catalogs,fields,pipelines]=await Promise.all([
    Promise.all(CATALOG_KINDS.map(k=>loadCatalog(admin,orgId,k))),
    admin.from('custom_fields').select('id,name,key,type,options,entity_type,position').eq('organization_id',orgId).order('position',{ascending:true}),
    admin.from('pipelines').select('id,name,is_default,position').eq('organization_id',orgId).order('position',{ascending:true})
  ]);
  if(fields.error||pipelines.error)return dbFail('Falha ao carregar configurações.',fields.error||pipelines.error);
  const ids=(pipelines.data||[]).map(p=>p.id);
  let stages={data:[]},reqs={data:[]};
  if(ids.length){
    [stages,reqs]=await Promise.all([
      admin.from('pipeline_stages').select('id,pipeline_id,name,position,idle_days,is_won,is_lost,color').in('pipeline_id',ids).order('position',{ascending:true}),
      admin.from('pipeline_stage_requirements').select('id,pipeline_id,stage_id,core_field,custom_field_id,question,position').eq('organization_id',orgId).order('position',{ascending:true})
    ]);
    if(stages.error||reqs.error)return dbFail('Falha ao carregar etapas.',stages.error||reqs.error);
  }
  return reply({
    catalogs:Object.fromEntries(catalogs.map(c=>[c.kind,c])),
    fields:fields.data||[],pipelines:pipelines.data||[],stages:stages.data||[],requirements:reqs.data||[],
    can_manage:ctx.isSuperAdmin===true||canConfigureCrm(ctx.role)
  });
}

export async function POST(request){
  let body;
  try{body=await request.json()}catch{return fail('Dados inválidos.')}
  const orgId=String(body?.org_id||'');
  const ctx=await context(request,orgId);
  if(ctx.error)return fail(ctx.error,ctx.status);
  if(!(ctx.isSuperAdmin===true||canConfigureCrm(ctx.role)))
    return fail('Somente gerente ou administrador pode alterar os cadastros do funil.',403);
  const {admin}=ctx;const action=String(body?.action||'');

  if(action==='catalog_add'||action==='catalog_update'||action==='catalog_delete'){
    const c=CATALOGS[body?.kind];
    if(!c)return fail('Cadastro inválido.');
    const current=await loadCatalog(admin,orgId,body.kind);
    if(!current.installed)return fail('Este cadastro ainda não foi instalado no banco. Peça para aplicar a migração de categorias e setores.',503);
    if(current.error)return dbFail('Falha ao carregar cadastro.',current.error);
    if(action==='catalog_add'){
      // Nome igual a um item desativado: reativa em vez de bloquear com "Já existe" (o item fica oculto na lista).
      const off=current.items.find(i=>!i.is_active&&sameName(i.name,body?.name));
      if(off){
        const {error}=await admin.from(c.table).update({is_active:true}).eq('id',off.id).eq('organization_id',orgId);
        if(error)return dbFail('Falha ao reativar.',error);
        return reply({ok:true,message:'Item reativado.'});
      }
      const v=validateCatalogName(body.kind,body.name,current.items.map(i=>i.name));
      if(v.error)return fail(v.error,v.error.startsWith('Já existe')?409:400);
      const {error}=await admin.from(c.table).insert({organization_id:orgId,[c.column]:v.value,position:current.items.length,is_active:true});
      if(error)return dbFail('Falha ao salvar.',error);
      return reply({ok:true,message:'Adicionado.'});
    }
    if(!isId(body?.id)||!current.items.some(i=>i.id===body.id))return fail('Item não encontrado nesta empresa.',404);
    if(action==='catalog_delete'){
      // Inativa em vez de apagar: registros antigos continuam legíveis e auditáveis.
      const {error}=await admin.from(c.table).update({is_active:false}).eq('id',body.id).eq('organization_id',orgId);
      if(error)return dbFail('Falha ao remover.',error);
      return reply({ok:true,message:'Item desativado. Registros antigos não são alterados.'});
    }
    const patch={};
    if(body.name!==undefined){
      const v=validateCatalogName(body.kind,body.name,current.items.filter(i=>i.id!==body.id).map(i=>i.name));
      if(v.error)return fail(v.error,v.error.startsWith('Já existe')?409:400);
      patch[c.column]=v.value;
    }
    if(body.is_active!==undefined){
      if(typeof body.is_active!=='boolean')return fail('Status inválido.');
      patch.is_active=body.is_active;
    }
    if(!Object.keys(patch).length)return fail('Nada para alterar.');
    const {error}=await admin.from(c.table).update(patch).eq('id',body.id).eq('organization_id',orgId);
    if(error)return dbFail('Falha ao salvar.',error);
    return reply({ok:true,message:'Atualizado.'});
  }

  if(action==='field_save'){
    const v=validateField(body?.field);
    if(v.error)return fail(v.error);
    const {data:existing,error:listError}=await admin.from('custom_fields').select('id,name,entity_type,type').eq('organization_id',orgId);
    if(listError)return dbFail('Falha ao carregar campos.',listError);
    const id=isId(body?.field?.id)?body.field.id:null;
    const own=id?existing.find(f=>f.id===id):null;
    if(id&&!own)return fail('Campo não encontrado nesta empresa.',404);
    // Na edição o local (negócio/pessoa) não muda: a checagem de nome usa o valor salvo, não o enviado.
    const entity=own?own.entity_type:v.data.entity_type;
    if(existing.some(f=>f.id!==id&&f.entity_type===entity&&sameName(f.name,v.data.name)))return fail('Já existe um campo com esse nome.',409);
    if(own&&own.type!==v.data.type){
      // Trocar o tipo de um campo já respondido deixaria respostas incompatíveis (ex.: texto em campo de data).
      const used=await admin.from('custom_field_values').select('custom_field_id',{count:'exact',head:true}).eq('custom_field_id',id);
      if(used.error)return dbFail('Falha ao verificar respostas do campo.',used.error);
      if((used.count||0)>0)return fail('Este campo já tem respostas salvas. Para mudar o tipo, crie um novo campo.',409);
    }
    const result=id
      ?await admin.from('custom_fields').update({name:v.data.name,type:v.data.type,options:v.data.options}).eq('id',id).eq('organization_id',orgId)
      :await admin.from('custom_fields').insert({...v.data,organization_id:orgId,position:existing.length,is_required:false});
    if(result.error)return dbFail('Falha ao salvar campo.',result.error);
    return reply({ok:true,message:id?'Campo atualizado.':'Campo criado.'});
  }

  if(action==='requirements_save'){
    if(!isId(body?.stage_id))return fail('Etapa inválida.');
    const {data:stage,error:stageError}=await admin.from('pipeline_stages').select('id,pipeline_id').eq('id',body.stage_id).maybeSingle();
    if(stageError||!stage)return fail('Etapa não encontrada.',404);
    const {data:pipe,error:pipeError}=await admin.from('pipelines').select('id').eq('id',stage.pipeline_id).eq('organization_id',orgId).maybeSingle();
    if(pipeError||!pipe)return fail('A etapa não pertence à empresa.',403);
    const {data:fields,error:fieldsError}=await admin.from('custom_fields').select('id').eq('organization_id',orgId).eq('entity_type','lead');
    if(fieldsError)return dbFail('Falha ao carregar campos.',fieldsError);
    const v=validateRequirements(body?.items,(fields||[]).map(f=>f.id));
    if(v.error)return fail(v.error);
    const removed=await admin.from('pipeline_stage_requirements').delete().eq('organization_id',orgId).eq('stage_id',stage.id);
    if(removed.error)return dbFail('Falha ao salvar.',removed.error);
    if(v.data.length){
      const inserted=await admin.from('pipeline_stage_requirements').insert(v.data.map(r=>({...r,organization_id:orgId,pipeline_id:stage.pipeline_id,stage_id:stage.id})));
      if(inserted.error)return dbFail('Falha ao salvar.',inserted.error);
    }
    return reply({ok:true,message:v.data.length?'Campos obrigatórios da etapa salvos.':'Etapa sem campos obrigatórios.'});
  }

  if(action==='template_apply'){
    const t=AGENDOR_TEMPLATE;const report={catalogs:{},fields:0,pipeline:null,skipped:[]};
    for(const kind of Object.keys(t.catalogs)){
      const c=CATALOGS[kind];const current=await loadCatalog(admin,orgId,kind);
      if(!current.installed){report.skipped.push(c.label);continue}
      if(current.error)return dbFail('Falha ao carregar '+c.label+'.',current.error);
      const add=missingNames(t.catalogs[kind],current.items.map(i=>i.name));
      if(add.length){
        const {error}=await admin.from(c.table).insert(add.map((name,i)=>({organization_id:orgId,[c.column]:name,position:current.items.length+i,is_active:true})));
        if(error)return dbFail('Falha ao criar '+c.label+'.',error);
      }
      report.catalogs[kind]=add.length;
    }
    const {data:existingFields,error:fe}=await admin.from('custom_fields').select('id,name,entity_type').eq('organization_id',orgId);
    if(fe)return dbFail('Falha ao carregar campos.',fe);
    const fieldRows=t.fields.filter(f=>!existingFields.some(e=>e.entity_type===f.entity_type&&sameName(e.name,f.name)))
      .map((f,i)=>({...validateField(f).data,organization_id:orgId,position:existingFields.length+i,is_required:false}));
    if(fieldRows.length){
      const {error}=await admin.from('custom_fields').insert(fieldRows);
      if(error)return dbFail('Falha ao criar campos.',error);
    }
    report.fields=fieldRows.length;
    const {data:pipes,error:pe}=await admin.from('pipelines').select('id,name').eq('organization_id',orgId);
    if(pe)return dbFail('Falha ao carregar funis.',pe);
    if(!pipes.some(p=>sameName(p.name,t.name))){
      const {data:fields,error:fe2}=await admin.from('custom_fields').select('id,name').eq('organization_id',orgId).eq('entity_type','lead');
      if(fe2)return dbFail('Falha ao carregar campos.',fe2);
      const byName=name=>fields.find(f=>sameName(f.name,name))?.id;
      const {data:pipe,error:ce}=await admin.from('pipelines').insert({organization_id:orgId,name:t.name,is_default:!pipes.length,position:pipes.length}).select('id').single();
      if(ce)return dbFail('Falha ao criar funil.',ce);
      for(const [i,s] of t.stages.entries()){
        const {data:st,error:se}=await admin.from('pipeline_stages').insert({pipeline_id:pipe.id,name:s.name,color:s.color,position:i,
          idle_days:s.idle_days,is_won:Boolean(s.is_won),is_lost:Boolean(s.is_lost)}).select('id').single();
        if(se){await admin.from('pipelines').delete().eq('id',pipe.id).eq('organization_id',orgId);return dbFail('Falha ao criar etapa.',se)}
        const items=s.requires.map((r,k)=>r.core?{core_field:r.core,custom_field_id:null,question:null,position:k}:{core_field:null,custom_field_id:byName(r.field),question:null,position:k})
          .filter(r=>r.core_field||r.custom_field_id);
        if(items.length){
          const {error:re}=await admin.from('pipeline_stage_requirements').insert(items.map(r=>({...r,organization_id:orgId,pipeline_id:pipe.id,stage_id:st.id})));
          if(re){await admin.from('pipeline_stage_requirements').delete().eq('pipeline_id',pipe.id).eq('organization_id',orgId);
            await admin.from('pipeline_stages').delete().eq('pipeline_id',pipe.id);
            await admin.from('pipelines').delete().eq('id',pipe.id).eq('organization_id',orgId);
            return dbFail('Falha ao criar campos obrigatórios.',re)}
        }
      }
      report.pipeline=t.name;
    }
    return reply({ok:true,report,message:'Modelo aplicado. Só foi criado o que ainda não existia.'});
  }

  return fail('Ação desconhecida.');
}
