'use client';

import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {
  Activity,ArrowRight,CheckCircle2,ChevronDown,Clock3,
  GitBranch,Info,Layers3,PauseCircle,PlayCircle,Plus,
  RefreshCw,ShieldCheck,Trash2,Workflow,Zap
} from 'lucide-react';
import {db} from '../lib/supabase';

const formatDate=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const description={success:'Tarefa criada',failed:'Falha na execução',running:'Processando'};

export default function NexusAutomations({organizationId,stages=[],readonly=false}){
  const [rules,setRules]=useState([]);
  const [runs,setRuns]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [canManage,setCanManage]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [name,setName]=useState('');
  const [stage,setStage]=useState('');
  const [title,setTitle]=useState('Retornar ao lead');
  const [days,setDays]=useState('1');
  const [expanded,setExpanded]=useState(true);

  const request=useCallback(async(body=null)=>{
    const {data:{session},error:authError}=await db.auth.getSession();
    if(authError||!session?.access_token)throw new Error('Sessão expirada. Entre novamente.');
    const response=await fetch(body?'/api/automations':'/api/automations?org_id='+encodeURIComponent(organizationId),{
      method:body?'POST':'GET',
      headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify({org_id:organizationId,...body})}:{})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Erro ao acessar as automações.');
    return data;
  },[organizationId]);
  const load=useCallback(async()=>{
    if(!organizationId){setLoading(false);return}
    setLoading(true);
    try{
      const data=await request();
      setRules(data.rules||[]);setRuns(data.executions||[]);
      setCanManage(Boolean(data.can_manage));setError('');
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  },[request,organizationId]);
  useEffect(()=>{load()},[load]);
  async function create(e){
    e.preventDefault();if(busy||readonly||!canManage)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await request({action:'create',name,stage_id:stage,task_title:title,delay_days:Number(days)});
      setNotice(response.message);setName('');setStage('');setTitle('Retornar ao lead');
      await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function toggle(rule){
    if(busy||readonly||!canManage)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await request({action:'toggle',rule_id:rule.id,enabled:!rule.enabled});
      await load();setNotice(response.message);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  async function remove(rule){
    if(busy||readonly||!canManage)return;
    if(!window.confirm('Excluir a regra "'+rule.name+'"? O histórico dessa regra também será removido.'))return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await request({action:'delete',rule_id:rule.id});
      await load();setNotice(response.message);
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  const stageLabel=id=>stages.find(s=>s.id===id)?.name||'Etapa não disponível';
  return <div className="nx-workflow-page">
    <div className="nx-workflow-head">
      <div><span className="nx-workflow-kicker"><Zap size={15}/> NEXUS / AUTOMAÇÕES</span>
        <h1>Automações</h1><p>Crie regras que transformam mudanças no funil em tarefas de acompanhamento, sem depender de integrações externas.</p></div>
      <button type="button" className="nx-workflow-refresh" disabled={loading} onClick={load}><RefreshCw size={16}/> Atualizar</button>
    </div>
    <section className="nx-workflow-hero"><div><span><GitBranch size={20}/> CONSTRUTOR DE ROTINAS</span><h2>Seu CRM trabalhando junto com você.</h2><p>Quando um lead entra na etapa escolhida, o sistema cria automaticamente uma tarefa com prazo definido. Você pode pausar ou excluir cada regra.</p>
    <div className="nx-workflow-chips"><span><ShieldCheck size={14}/> Por empresa</span><span><CheckCircle2 size={14}/> Execução rastreável</span><span><Clock3 size={14}/> Prazos automáticos</span></div></div>
    <div className="nx-workflow-illustration" aria-hidden="true"><span className="nx-workflow-node"><Layers3 size={22}/><small>Lead mudou</small></span><ArrowRight size={20}/><span className="nx-workflow-node"><Zap size={22}/><small>Regra</small></span><ArrowRight size={20}/><span className="nx-workflow-node"><CheckCircle2 size={22}/><small>Tarefa</small></span></div></section>
    {error&&<div className="nx-workflow-alert nx-workflow-alert--error" role="alert"><Info size={18}/><span>{error}</span>{error.includes('migração')&&<a href="https://github.com/ojoaovitordeoli/nexus-crm-ai/blob/main/supabase/20261028_automation_whatsapp_foundation.sql" target="_blank" rel="noopener noreferrer">Ver arquivo SQL</a>}</div>}
    {notice&&<div className="nx-workflow-alert nx-workflow-alert--ok" role="status"><CheckCircle2 size={18}/>{notice}</div>}
    <div className="nx-workflow-layout">
      <section className="nx-workflow-card">
        <button className="nx-workflow-card-head" type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
          <span><Plus size={20}/><strong>Criar automação</strong></span><ChevronDown size={19} style={{transform:expanded?'rotate(180deg)':'rotate(0deg)'}}/>
        </button>
        {expanded&&<div className="nx-workflow-card-inner">
          <p className="nx-workflow-intro">Configure um gatilho e uma ação. A regra começa pausada e só executa depois de você ativá-la.</p>
          <form onSubmit={create} className="nx-workflow-form">
            <label>Nome da automação<input value={name} maxLength={100} minLength={3} required placeholder="Ex.: Follow-up dos interessados" onChange={e=>setName(e.target.value)}/></label>
            <label>Quando o lead mudar para<select value={stage} required onChange={e=>setStage(e.target.value)}><option value="">Selecione uma etapa...</option>{stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label>Tarefa a ser criada<input value={title} maxLength={180} minLength={3} required onChange={e=>setTitle(e.target.value)}/></label>
            <label>Prazo para execução da tarefa<select value={days} onChange={e=>setDays(e.target.value)}>{Array.from({length:15},(_,i)=>i).map(n=><option key={n} value={n}>{n===0?'Hoje':n===1?'Em 1 dia':'Em '+n+' dias'}</option>)}</select></label>
            <button type="submit" disabled={busy||readonly||!canManage||loading||!stage} className="nx-workflow-primary"><Plus size={17}/>{busy?'Salvando...':'Criar regra'}</button>
            {!canManage&&<p className="nx-workflow-help">Apenas administradores e gerentes podem gerenciar regras.</p>}
          </form>
        </div>}
      </section>
      <section className="nx-workflow-card">
        <div className="nx-workflow-card-head nx-workflow-card-head--static"><span><Workflow size={20}/><strong>Minhas regras</strong></span><small>{rules.filter(r=>r.enabled).length} ativas / {rules.length} total</small></div>
        <div className="nx-workflow-rules">
          {rules.map(rule=><article key={rule.id} className="nx-workflow-rule">
            <div className="nx-workflow-rule-title"><span className={rule.enabled?'active':'paused'}>{rule.enabled?<PlayCircle size={18}/>:<PauseCircle size={18}/>}</span><div><strong>{rule.name}</strong><small>{rule.enabled?'Automação ativa':'Regra pausada'}</small></div></div>
            <div className="nx-workflow-rule-detail"><span>Gatilho</span><strong>{stageLabel(rule.stage_id)}</strong></div>
            <div className="nx-workflow-rule-detail"><span>Ação</span><strong>{rule.task_title}</strong></div>
            <div className="nx-workflow-rule-detail"><span>Prazo</span><strong>{rule.delay_days===0?'No mesmo dia':'+'+rule.delay_days+' dia(s)'}</strong></div>
            <div className="nx-workflow-rule-actions"><button type="button" disabled={!canManage||readonly||busy} onClick={()=>toggle(rule)}>{rule.enabled?'Pausar':'Ativar'}</button><button type="button" aria-label={'Excluir '+rule.name} disabled={!canManage||readonly||busy} onClick={()=>remove(rule)}><Trash2 size={16}/></button></div>
          </article>)}
          {!rules.length&&<div className="nx-workflow-empty"><Workflow size={30}/><strong>Nenhuma regra cadastrada</strong><p>Crie uma regra para começar a automatizar tarefas do seu funil.</p></div>}
        </div>
      </section>
    </div>
    <section className="nx-workflow-card nx-workflow-log"><div className="nx-workflow-card-head nx-workflow-card-head--static"><span><Activity size={20}/><strong>Últimas execuções</strong></span><small>Auditoria de eventos</small></div>
      {runs.map(run=><div className="nx-workflow-run" key={run.id}><span className={run.status==='success'?'good':run.status==='failed'?'bad':'pending'}><Activity size={17}/></span><div><strong>{description[run.status]||run.status}</strong><small>{formatDate(run.created_at)}</small></div><span>{run.error_summary||'Evento registrado'}</span></div>)}
      {!runs.length&&<div className="nx-workflow-empty"><Activity size={27}/><strong>Sem execuções ainda</strong><p>Movimentos reais dos leads irão aparecer aqui quando houver uma regra ativa.</p></div>}
    </section>
  </div>;
}
