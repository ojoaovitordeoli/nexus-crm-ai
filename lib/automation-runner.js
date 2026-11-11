import {addDaysISO,localDateISO} from './operation-rules.mjs';
import {isMissingSchema,logInternal} from './workflow-security.mjs';

// Server-only automation executor. This is intentionally limited to safe internal task creation.
// No message sending, external HTTP calls, recurring background jobs or AI actions.
export async function runLeadStageAutomations(admin,{organizationId,leadId,stageId,actorId}){
  const {data:rules,error:ruleError}=await admin.from('automation_rules')
    .select('id,task_title,delay_days')
    .eq('organization_id',organizationId).eq('enabled',true)
    .eq('trigger_type','lead_stage_changed').eq('stage_id',stageId)
    .order('created_at',{ascending:true}).limit(20);
  if(ruleError){
    // Missing schema is an expected state until the SQL migration is applied.
    if(!isMissingSchema(ruleError))logInternal('automation rules',ruleError);
    return {executed:0,warning:isMissingSchema(ruleError)?'Automações ainda não instaladas no banco.':'Não foi possível verificar as automações desta etapa.'};
  }
  const result={executed:0,already_processed:0,failed:0};
  for(const rule of rules||[]){
    const eventKey='lead-stage:'+leadId+':'+stageId;
    const {data:claimed,error:claimError}=await admin.from('automation_executions')
      .insert({organization_id:organizationId,rule_id:rule.id,event_key:eventKey,status:'running'})
      .select('id').maybeSingle();
    if(claimError){
      if(claimError.code==='23505'){result.already_processed++;continue}
      result.failed++;continue;
    }
    if(!claimed)continue;
    // Prazo contado no dia local da operação (UTC adiantaria um dia após as 21h).
    const dueDate=addDaysISO(localDateISO(),rule.delay_days);
    const {data:task,error:taskError}=await admin.from('tasks')
      .insert({organization_id:organizationId,created_by:actorId,
        title:rule.task_title.slice(0,180),status:'pending',priority:'medium',
        due_date:dueDate,lead_id:leadId})
      .select('id').maybeSingle();
    if(taskError||!task){
      await admin.from('automation_executions').update({
        status:'failed',finished_at:new Date().toISOString(),
        error_summary:String(taskError?.message||'Tarefa não foi criada').slice(0,300)
      }).eq('id',claimed.id).eq('organization_id',organizationId);
      result.failed++;
    }else{
      await admin.from('automation_executions').update({
        status:'success',task_id:task.id,finished_at:new Date().toISOString()
      }).eq('id',claimed.id).eq('organization_id',organizationId);
      result.executed++;
    }
  }
  return result;
}
