'use client';

import {useCallback,useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
const NexusAutomationGraph=dynamic(()=>import('./NexusAutomationGraph'),{ssr:false,loading:()=> <div className="fx-flow fx-flow--loading">Carregando prévia...</div>});
import {CheckCircle2,Info,Pause,Play,Plus,RefreshCw,ShieldCheck,Trash2,X} from 'lucide-react';
import {db} from '../lib/supabase';

const formatDate=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const description={success:'Tarefa criada',failed:'Falha na execução',running:'Processando'};
// A API responde com texto técnico quando a estrutura do banco não existe.
// Para o usuário final isso vira um estado "recurso ainda não ativado".
const notActivated=msg=>/migra|instalad|aplicad|supabase/i.test(String(msg||''));

export default function NexusAutomations({organizationId,stages=[],readonly=false}){
  const [rules,setRules]=useState([]);
  const [runs,setRuns]=useState([]);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [canManage,setCanManage]=useState(false);
  const [unavailable,setUnavailable]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [name,setName]=useState('');
  const [stage,setStage]=useState('');
  const [title,setTitle]=useState('Retornar ao lead');
  const [days,setDays]=useState('1');
  const [formOpen,setFormOpen]=useState(false);

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
      setCanManage(Boolean(data.can_manage));setError('');setUnavailable(false);
    }catch(e){
      if(notActivated(e.message)){setUnavailable(true);setError('')}
      else setError(e.message);
    }
    finally{setLoading(false)}
  },[request,organizationId]);
  useEffect(()=>{load()},[load]);
  const failure=e=>setError(notActivated(e.message)?'As automações não estão disponíveis nesta empresa no momento. Fale com o administrador.':e.message);
  async function create(e){
    e.preventDefault();if(busy||readonly||!canManage)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await request({action:'create',name,stage_id:stage,task_title:title,delay_days:Number(days)});
      setNotice(response.message);setName('');setStage('');setTitle('Retornar ao lead');setFormOpen(false);
      await load();
    }catch(e){failure(e)}finally{setBusy(false)}
  }
  async function toggle(rule){
    if(busy||readonly||!canManage)return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await request({action:'toggle',rule_id:rule.id,enabled:!rule.enabled});
      await load();setNotice(response.message);
    }catch(e){failure(e)}finally{setBusy(false)}
  }
  async function remove(rule){
    if(busy||readonly||!canManage)return;
    if(!window.confirm('Excluir a regra "'+rule.name+'"? O histórico dessa regra também será removido.'))return;
    setBusy(true);setError('');setNotice('');
    try{
      const response=await request({action:'delete',rule_id:rule.id});
      await load();setNotice(response.message);
    }catch(e){failure(e)}finally{setBusy(false)}
  }
  const stageLabel=id=>stages.find(s=>s.id===id)?.name||'Etapa não disponível';
  const active=rules.filter(r=>r.enabled).length;
  const editable=canManage&&!readonly&&!unavailable;
  return <div className="fx-page fx-int fx-automations">
    <header className="fx-pagehead">
      <div className="fx-pagehead-title"><h1>Automações</h1>
        {!unavailable&&!loading&&<span className="fx-count">{active} {active===1?'ativa':'ativas'} · {rules.length} {rules.length===1?'regra':'regras'}</span>}
        {unavailable&&<span className="fx-count">Não ativado</span>}
      </div>
      <div className="fx-actions">
        <button type="button" className="fx-btn" disabled={loading} onClick={load}><RefreshCw size={16}/> Atualizar</button>
        {editable&&<button type="button" className="fx-btn fx-btn--primary" aria-expanded={formOpen} onClick={()=>setFormOpen(v=>!v)}>{formOpen?<><X size={16}/> Fechar</>:<><Plus size={16}/> Nova automação</>}</button>}
      </div>
    </header>
    {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    {notice&&<div className="fx-alert fx-alert--ok" role="status"><CheckCircle2 size={16}/>{notice}</div>}

    {unavailable?<section className="fx-box fx-int-off" aria-labelledby="fx-auto-off">
      <div className="fx-int-off-body">
        <Info size={18} aria-hidden="true"/>
        <div><h2 id="fx-auto-off">Automações ainda não ativadas</h2>
          <p>O administrador da sua empresa precisa ativar este recurso. Enquanto isso, nenhuma regra é executada e nenhuma tarefa é criada automaticamente.</p></div>
      </div>
      <p className="fx-boxfoot">Depois de ativadas, as automações criam tarefas de retorno quando um lead muda de etapa no funil.</p>
    </section>:<>
      {!loading&&!editable&&<div className="fx-alert fx-alert--info"><ShieldCheck size={16}/> {readonly?'Seu perfil é somente leitura. Você pode acompanhar as regras, mas não alterá-las.':'Apenas administradores e gerentes podem criar ou alterar automações.'}</div>}

      {editable&&formOpen&&<section className="fx-box fx-auto-new" aria-label="Nova automação">
        <div className="fx-boxhead"><h2>Nova automação</h2><span className="fx-boxmeta">A regra é criada pausada e só executa depois de ativada.</span></div>
        <form onSubmit={create} className="fx-auto-form">
          <label>Nome<input value={name} maxLength={100} minLength={3} required placeholder="Ex.: Retorno dos interessados" onChange={e=>setName(e.target.value)}/></label>
          <label>Quando o lead entrar na etapa<select id="nx-workflow-stage" value={stage} required onChange={e=>setStage(e.target.value)}><option value="">Selecione uma etapa...</option>{stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label>Criar a tarefa<input id="nx-workflow-task" value={title} maxLength={180} minLength={3} required onChange={e=>setTitle(e.target.value)}/></label>
          <label>Prazo da tarefa<select value={days} onChange={e=>setDays(e.target.value)}>{Array.from({length:15},(_,i)=>i).map(n=><option key={n} value={n}>{n===0?'Hoje':n===1?'Em 1 dia':'Em '+n+' dias'}</option>)}</select></label>
          <div className="fx-auto-preview"><span>Prévia</span><NexusAutomationGraph stageName={stages.find(x=>x.id===stage)?.name} taskTitle={title} delayDays={days}/></div>
          <div className="fx-auto-submit">
            {!stages.length&&<small>Nenhuma etapa de funil disponível para usar como gatilho.</small>}
            <button type="submit" disabled={busy||loading||!stage} className="fx-btn fx-btn--primary">{busy?'Salvando...':'Criar regra'}</button>
          </div>
        </form>
      </section>}

      <section className="fx-box">
        <div className="fx-boxhead"><h2>Regras</h2><span className="fx-groupcount">{rules.length}</span></div>
        {rules.length?<div className="fx-table fx-table--rules" role="table" aria-label="Regras de automação">
          <div className="fx-thead" role="row"><span role="columnheader">Regra</span><span role="columnheader">Quando entrar em</span><span role="columnheader">Tarefa criada</span><span role="columnheader">Prazo</span><span role="columnheader" className="fx-cell-end">Ações</span></div>
          {rules.map(rule=><div className="fx-tr" role="row" key={rule.id}>
            <span role="cell"><strong>{rule.name}</strong><span className={'fx-int-status '+(rule.enabled?'is-on':'is-off')}>{rule.enabled?'Ativa':'Pausada'}</span></span>
            <span role="cell" className="fx-muted">{stageLabel(rule.stage_id)}</span>
            <span role="cell">{rule.task_title}</span>
            <span role="cell" className="fx-muted">{rule.delay_days===0?'No mesmo dia':'+'+rule.delay_days+' dia(s)'}</span>
            <span role="cell" className="fx-cell-end fx-auto-actions">
              <button type="button" className="fx-btn" disabled={!canManage||readonly||busy} onClick={()=>toggle(rule)}>{rule.enabled?<><Pause size={14}/> Pausar</>:<><Play size={14}/> Ativar</>}</button>
              <button type="button" className="fx-int-icon" aria-label={'Excluir '+rule.name} disabled={!canManage||readonly||busy} onClick={()=>remove(rule)}><Trash2 size={16}/></button>
            </span>
          </div>)}
        </div>:<div className="fx-empty"><strong>{loading?'Carregando regras...':'Nenhuma regra cadastrada'}</strong>{!loading&&<p>{editable?'Use “Nova automação” para criar uma tarefa automática quando o lead mudar de etapa.':'As regras criadas pela gestão aparecerão aqui.'}</p>}</div>}
      </section>

      <section className="fx-box">
        <div className="fx-boxhead"><h2>Últimas execuções</h2><span className="fx-groupcount">{runs.length}</span><span className="fx-boxmeta fx-int-meta-end">Registro de auditoria</span></div>
        {runs.map(run=><div className="fx-row fx-auto-run" key={run.id}>
          <span className={'fx-int-status '+(run.status==='success'?'is-on':run.status==='failed'?'is-bad':'is-off')}>{description[run.status]||run.status}</span>
          <span className="fx-muted">{run.error_summary||'Evento registrado'}</span>
          <span className="fx-muted fx-auto-when">{formatDate(run.created_at)}</span>
        </div>)}
        {!runs.length&&<p className="fx-empty-small">Nenhuma execução ainda. Os movimentos reais dos leads aparecem aqui quando houver uma regra ativa.</p>}
      </section>
    </>}
  </div>;
}
