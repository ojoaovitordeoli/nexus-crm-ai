import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../lib/tenant-session';
import {isUuid,manageAutomationRole,validateFollowupRule} from '../../../lib/workflow-security.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const fail=(error,status=400)=>NextResponse.json({error},{status});
const response=payload=>NextResponse.json(payload);

async function context(request,orgId){
  const admin=adminSupabase();
  if(!admin)return {error:'Serviço indisponível: configuração do Supabase pendente.',status:503};
  const auth=await authorizeTenant(request,admin,orgId);
  return auth.error?auth:{admin,...auth};
}
export async function GET(request){
  const orgId=new URL(request.url).searchParams.get('org_id');
  const auth=await context(request,orgId);
  if(auth.error)return fail(auth.error,auth.status);
  const [rules,runs]=await Promise.all([
    auth.admin.from('automation_rules')
      .select('id,name,trigger_type,action_type,stage_id,task_title,delay_days,enabled,created_at')
      .eq('organization_id',orgId).order('created_at',{ascending:false}).limit(150),
    auth.admin.from('automation_executions')
      .select('id,rule_id,status,created_at,task_id,error_summary')
      .eq('organization_id',orgId).order('created_at',{ascending:false}).limit(50)
  ]);
  if(rules.error){
    const migration=rules.error.code==='42P01'||rules.error.code==='PGRST205';
    return fail(migration?
      'A migração das automações ainda não foi aplicada no Supabase. Execute o arquivo supabase/20261028_automation_whatsapp_foundation.sql.':
      rules.error.message,migration?503:500);
  }
  return response({rules:rules.data||[],executions:runs.data||[],can_manage:manageAutomationRole(auth.role)});
}

export async function POST(request){
  let body;
  try{body=await request.json()}catch{return fail('Dados inválidos.')}
  const orgId=String(body.org_id||'');
  const auth=await context(request,orgId);
  if(auth.error)return fail(auth.error,auth.status);
  if(!manageAutomationRole(auth.role))return fail('Somente gerente ou administrador pode alterar automações.',403);
  const action=String(body.action||'');
  if(action==='create'){
    const validated=validateFollowupRule(body);
    if(validated.error)return fail(validated.error);
    const {stage_id}=validated.data;
    const {data:stage,error:stageError}=await auth.admin.from('pipeline_stages')
      .select('id,pipeline_id').eq('id',stage_id).maybeSingle();
    if(stageError||!stage)return fail('Etapa inválida.',404);
    const {data:pipeline,error:pipelineError}=await auth.admin.from('pipelines')
      .select('id').eq('id',stage.pipeline_id).eq('organization_id',orgId).maybeSingle();
    if(pipelineError||!pipeline)return fail('Essa etapa não pertence à empresa.',403);
    const {count,error:countError}=await auth.admin.from('automation_rules')
      .select('id',{count:'exact',head:true}).eq('organization_id',orgId);
    if(countError)return fail('Automações não configuradas no Supabase.',503);
    if(count>=40)return fail('Limite de 40 regras por empresa atingido.',409);
    const {data,error}=await auth.admin.from('automation_rules').insert({
      ...validated.data,organization_id:orgId,created_by:auth.user.id,enabled:false
    }).select('id,name').single();
    if(error)return fail('Não foi possível criar regra: '+error.message,500);
    return response({ok:true,message:'Regra cadastrada. Ative quando estiver pronta.',rule:data});
  }
  if(action==='toggle'){
    if(!isUuid(body.rule_id)||typeof body.enabled!=='boolean')return fail('Regra ou status inválido.');
    const {data,error}=await auth.admin.from('automation_rules')
      .update({enabled:body.enabled,updated_at:new Date().toISOString()})
      .eq('organization_id',orgId).eq('id',body.rule_id)
      .select('id,enabled').maybeSingle();
    if(error)return fail('Falha ao alterar regra: '+error.message,500);
    if(!data)return fail('Regra não encontrada.',404);
    return response({ok:true,message:data.enabled?'Automação ativada.':'Automação pausada.',rule:data});
  }
  if(action==='delete'){
    if(!isUuid(body.rule_id))return fail('Regra inválida.');
    const {data,error}=await auth.admin.from('automation_rules')
      .delete().eq('organization_id',orgId).eq('id',body.rule_id).select('id').maybeSingle();
    if(error)return fail('Falha ao excluir regra: '+error.message,500);
    if(!data)return fail('Regra não encontrada.',404);
    return response({ok:true,message:'Regra excluída.'});
  }
  return fail('Ação desconhecida.');
}
