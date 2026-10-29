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
    return {executed:0,warning:'Regras de automação indisponíveis: '+ruleError.message};
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
    const due=new Date();
    due.setUTCDate(due.getUTCDate()+rule.delay_days);
    const dueDate=due.toISOString().slice(0,10);
    const {data:task,error:taskError}=await admin.from('tasks')
      .insert({organization_id:organizationId,created_by:actorId,
        title:rule.task_title.slice(0,180),status:'pending',priority:'medium',
        due_date:dueDate})
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
