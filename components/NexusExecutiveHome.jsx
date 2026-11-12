'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {normalizeLeadSearch,getSnapshotCoverage} from '../lib/dashboard-snapshot.mjs';
import {dueDate,contactSearchTerm} from '../lib/shell-rules.mjs';
import {
  CalendarDays,Check,ChevronRight,CircleCheck,ContactRound,MessageCircle,Plus,Search
} from 'lucide-react';

const int=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v)||0);
const fullName=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim()||'Nome não informado';
const readable=s=>({new:'Novo',open:'Aberto',pending:'Pendente',won:'Ganho',lost:'Perdido',qualified:'Qualificado'})[String(s||'').toLowerCase()]||String(s||'Sem etapa');
const toDate=value=>{
  if(!value)return null;
  const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(m)return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  const result=new Date(value);return Number.isNaN(result.getTime())?null:result;
};
const day=value=>toDate(value)?.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})||'Sem prazo';
const dueDay=value=>dueDate(value)?.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})||'Sem prazo';
const whatsapp=value=>{const n=String(value||'').replace(/\D/g,'');return n.length>=10&&n.length<=13?'https://wa.me/'+(n.length<=11?'55'+n:n):''};
const taskOpen=t=>!['done','completed','cancelled','canceled'].includes(String(t.status||'').toLowerCase());
function Initial({name}){return <span className="fx-avatar" aria-hidden="true">{name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}</span>}
function Title({title,link,href,children}){return <div className="fx-boxhead"><h2>{title}</h2>{children}{href&&<Link href={href} className="fx-link">{link||'Ver todos'}</Link>}</div>}
export default function NexusExecutiveHome({data,counts,organizationName,onOperation,onReload,readonly=false,loading,openTasks=[],overdueTasks=[],pipelineStages=[],pipelines=[],activePipelineId='',onPipelineChange,lastSync}) {
  const d=data||{},leads=d.leads||[],sales=d.sales||[],tasks=d.tasks||[],appointments=d.appointments||[];
  const pending=Array.isArray(openTasks)?openTasks:tasks.filter(taskOpen);
  const latestMs=Date.now()-30*86400000,leads30=leads.filter(x=>toDate(x.created_at)?.getTime()>=latestMs);
  const sales30=sales.filter(x=>toDate(x.created_at)?.getTime()>=latestMs),revenue=sales30.reduce((acc,x)=>acc+(Number(x.value)||0),0);
  const today=new Date();today.setHours(0,0,0,0);
  const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  // Prazo é data de calendário: dueDate evita que "2026-11-10T00:00:00Z" vire dia 09 no fuso de Brasília.
  const late=pending.filter(x=>dueDate(x.due_date)&&dueDate(x.due_date).getTime()<today.getTime());
  const dueToday=pending.filter(x=>{const t=dueDate(x.due_date)?.getTime();return Number.isFinite(t)&&t>=today.getTime()&&t<tomorrow.getTime()});
  const [tab,setTab]=useState('all'),[term,setTerm]=useState(''),[compose,setCompose]=useState(false);
  const [newTask,setNewTask]=useState(''),[deadline,setDeadline]=useState(''),[submitting,setSubmitting]=useState(false),[activeAction,setActiveAction]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const upcoming=useMemo(()=>{
    return [...pending].filter(x=>tab==='all'||(tab==='today'?dueToday.some(y=>y.id===x.id):late.some(y=>y.id===x.id)))
      .sort((a,b)=>(dueDate(a.due_date)?.getTime()??Infinity)-(dueDate(b.due_date)?.getTime()??Infinity)).slice(0,5);
  },[pending,tab]);
  const recent=useMemo(()=>[...leads].filter(l=>normalizeLeadSearch([fullName(l.contact),l.contact?.whatsapp,l.source].join(' ')).includes(normalizeLeadSearch(term.trim())))
    .sort((a,b)=>(toDate(b.created_at)?.getTime()||0)-(toDate(a.created_at)?.getTime()||0)).slice(0,5),[leads,term]);
  const funnel=useMemo(()=>{
    const out=new Map();
    for(const st of pipelineStages)out.set(st.id,{id:st.id,name:st.name,count:0,value:0,won:Boolean(st.is_won),lost:Boolean(st.is_lost)});
    const multi=pipelines.length>1&&activePipelineId;
    for(const l of leads){
      if(multi&&l.pipeline_id&&l.pipeline_id!==activePipelineId)continue;
      const st=pipelineStages.find(x=>x.id===l.pipeline_stage_id),id=st?.id||'status:'+(l.status||'none');
      if(!out.has(id))out.set(id,{id,name:st?.name||readable(l.status),count:0,value:0,won:false,lost:false});
      const g=out.get(id);g.count++;g.value+=Number(l.estimated_value)||0;
    }
    return [...out.values()];
  },[leads,pipelineStages,pipelines,activePipelineId]);
  const funnelTotal=useMemo(()=>funnel.reduce((n,g)=>n+g.count,0),[funnel]);
  const funnelMax=Math.max(1,...funnel.map(g=>g.count));
  const nextAppointments=useMemo(()=>appointments.filter(x=>x.start_at&&toDate(x.start_at)?.getTime()>=Date.now()&&!['cancelled','completed'].includes(String(x.status||'').toLowerCase()))
    .sort((a,b)=>toDate(a.start_at)-toDate(b.start_at)).slice(0,3),[appointments]);
  const coverage=getSnapshotCoverage(counts,d);
  const filteredCounts=Object.values(coverage).some(Boolean);
  const snapshot=lastSync?'Atualizado às '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Aguardando atualização';
  async function action(payload,kind){
    if(readonly||activeAction)return false;
    setError('');setNotice('');setActiveAction(kind);
    try{const res=await onOperation(payload);await onReload?.();setNotice(res?.message||'Alteração salva.');return true}
    catch(e){setError(e.message||'Não foi possível salvar a alteração.');return false}
    finally{setActiveAction('')}
  }
  async function createTask(e){
    e.preventDefault();
    if(!newTask.trim()||submitting)return;
    setSubmitting(true);
    try{if(await action({action:'task_create',title:newTask.trim().slice(0,190),due_date:deadline||null,priority:'medium'},'create')){setNewTask('');setDeadline('');setCompose(false)}}
    finally{setSubmitting(false)}
  }
  const upcomingAppointments=appointments.filter(x=>x.start_at&&toDate(x.start_at)?.getTime()>=Date.now()&&!['cancelled','completed'].includes(String(x.status||'').toLowerCase())).length;
  const when=v=>toDate(v)?.toLocaleString('pt-BR',{weekday:'short',day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
  return <div className="fx-home" aria-busy={loading}>
    <div className="v14-hero fx-pagehead">
      <div className="fx-pagehead-title"><h1>Visão geral</h1><span className="fx-synced">{snapshot}</span></div>
      <div className="fx-actions">
        {!readonly&&<button type="button" className="fx-btn" onClick={()=>setCompose(x=>!x)}><Plus size={16}/> Nova tarefa</button>}
        <Link className="fx-btn fx-btn--primary" href="/leads">Abrir leads</Link>
      </div>
    </div>
    {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    {notice&&<div className="fx-alert fx-alert--ok" role="status"><CircleCheck size={16}/>{notice}<button type="button" aria-label="Fechar aviso" onClick={()=>setNotice('')}>×</button></div>}
    {compose&&<form className="v14-compose" onSubmit={createTask}>
      <label><span>Nova tarefa</span><input autoFocus required minLength={2} maxLength={190} value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Ex.: Retornar orçamento"/></label>
      <label><span>Prazo</span><input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} aria-label="Prazo da nova tarefa"/></label>
      <button type="submit" disabled={readonly||submitting||!newTask.trim()}>Criar</button>
      <button type="button" className="fx-btn-text" onClick={()=>setCompose(false)}>Cancelar</button>
    </form>}
    <section className="fx-funnel" aria-label="Funil de vendas">
      <div className="fx-funnel-head"><h2>Funil</h2>{pipelines.length>1&&<select className="fx-funnel-select" aria-label="Escolher funil" value={activePipelineId} onChange={e=>onPipelineChange?.(e.target.value)}>{pipelines.map(p=><option key={p.id} value={p.id}>{p.name}{p.is_default?' (padrão)':''}</option>)}</select>}<span>{loading?'—':int(funnelTotal)} {funnelTotal===1?'lead':'leads'}{coverage.leads?' · amostra carregada':''}</span><Link href="/leads" className="fx-link">Ver quadro</Link></div>
      {funnel.length?<ol className="fx-funnel-track">{funnel.map(g=><li key={g.id} className={'fx-stage'+(g.won?' fx-stage--won':'')+(g.lost?' fx-stage--lost':'')}>
        <Link href="/leads">
          <span className="fx-stage-name">{g.name}</span>
          <span className="fx-stage-nums"><strong>{int(g.count)}</strong>{g.value>0&&<small>{brl(g.value)}</small>}</span>
          <span className="fx-stage-bar" aria-hidden="true"><span style={{width:(g.count?Math.max(6,g.count/funnelMax*100):0)+'%'}}/></span>
        </Link>
      </li>)}</ol>:<p className="fx-funnel-empty">Nenhum lead cadastrado. As etapas aparecem aqui assim que o primeiro lead entrar.</p>}
    </section>
    <div className="fx-home-grid">
      <div className="v14-workgrid">
        <section className="fx-box v14-tasks-panel">
          <Title title="Próximas ações" link="Todas as tarefas" href="/tasks">
            <div className="fx-tabs" role="group" aria-label="Filtrar tarefas">
              {[['all','Em aberto'],['today','Hoje'],['late','Vencidas']].map(([key,l])=><button key={key} type="button" className={tab===key?'active':''} aria-pressed={tab===key} onClick={()=>setTab(key)}>{l}{key==='late'&&late.length>0&&<span>{late.length}</span>}{key==='today'&&dueToday.length>0&&<span>{dueToday.length}</span>}</button>)}
            </div>
          </Title>
          <div className="v14-rows">{upcoming.length?upcoming.map(t=>{const overdue=dueDate(t.due_date)&&dueDate(t.due_date).getTime()<today.getTime();return <div key={t.id} className={'fx-row fx-taskrow'+(overdue?' is-late':'')}>
            <button type="button" className="fx-check" aria-label={'Concluir '+(t.title||'tarefa')} disabled={readonly||Boolean(activeAction)} onClick={()=>action({action:'task_status',id:t.id,status:'completed'},t.id)}><Check size={16}/></button>
            <div><strong>{t.title||'Tarefa sem título'}</strong>{(t.priority==='urgent'||t.priority==='high')&&<small className="fx-prio">{t.priority==='urgent'?'Urgente':'Alta prioridade'}</small>}</div>
            <span className={overdue?'fx-late':'fx-due'}>{overdue?'Vencida · '+dueDay(t.due_date):dueDay(t.due_date)}</span>
            <Link aria-label={'Abrir tarefa '+(t.title||'sem título')} href={t.title?'/tasks?q='+encodeURIComponent(t.title):'/tasks'}><ChevronRight size={17}/></Link>
          </div>}):<div className="fx-empty"><CircleCheck size={20}/><strong>Sem tarefas nesta lista</strong><p>{tab==='all'?'Quando a equipe criar tarefas, elas vão aparecer aqui.':'Selecione outro filtro para consultar as atividades.'}</p></div>}</div>
          <div className="fx-subhead"><h3>Agenda</h3><Link href="/agenda" className="fx-link">Abrir agenda</Link></div>
          <div className="fx-agenda">{nextAppointments.length?nextAppointments.map(a=><Link key={a.id} href="/agenda" className="fx-row fx-agendarow">
            <CalendarDays size={16}/><span><strong>{a.title||'Compromisso'}</strong><small>{when(a.start_at)}</small></span><ChevronRight size={17}/>
          </Link>):<div className="fx-empty-small">Sem compromissos futuros.</div>}</div>
        </section>
        <section className="fx-box fx-leadsbox">
          <Title title="Leads recentes" link="Abrir lista" href="/leads"/>
          <div className="v14-rows">{recent.length?recent.map(l=>{
            const who=fullName(l.contact),w=whatsapp(l.contact?.whatsapp),stage=pipelineStages.find(s=>s.id===l.pipeline_stage_id);
            return <div className="fx-row fx-leadrow" key={l.id}>
              <Initial name={who}/><Link href={contactSearchTerm(l.contact)?'/leads?q='+encodeURIComponent(contactSearchTerm(l.contact)):'/leads'}><strong>{who}</strong><small>{l.source||'Origem não informada'} · {day(l.created_at)}</small></Link>
              <span className="fx-pill">{stage?.name||readable(l.status)}</span>
              {w?<a href={w} target="_blank" rel="noopener noreferrer" aria-label={'WhatsApp de '+who}><MessageCircle size={16}/></a>:<Link aria-label={'Abrir lead '+who} href="/leads"><ChevronRight size={16}/></Link>}
            </div> }):<div className="fx-empty"><ContactRound size={20}/><strong>Nenhum lead encontrado</strong><p>{term?'Tente outra busca.':'Os novos contatos aparecerão aqui.'}</p></div>}</div>
        </section>
      </div>
      <aside className="fx-side">
        <section className="v14-stats" aria-label="Indicadores dos últimos 30 dias">
          <h2>Últimos 30 dias</h2>
          <dl className="fx-kv">
            {[
              {label:'Novos leads',value:int(leads30.length),sample:coverage.leads,to:'/leads'},
              {label:'Vendas',value:int(sales30.length),sample:coverage.sales,to:'/sales'},
              {label:'Receita registrada',value:brl(revenue),sample:coverage.sales,to:'/sales'},
              {label:'Compromissos futuros',value:int(upcomingAppointments),sample:false,to:'/agenda'}
            ].map(s=><div key={s.label} className="fx-stat"><dt><Link href={s.to}>{s.label}</Link>{s.sample&&<small>amostra</small>}</dt><dd>{loading?'—':s.value}</dd></div>)}
          </dl>
        </section>
        {filteredCounts&&<p className="fx-note">Há mais registros no banco do que os carregados aqui; números marcados como amostra não são totais. Veja os totais em Relatórios.</p>}
      </aside>
    </div>
  </div>;
}
