'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {
  Activity,ArrowRight,ArrowUpRight,CalendarDays,Check,ChevronRight,
  CircleCheck,Clock3,ContactRound,MessageCircle,Plus,RefreshCcw,
  Search,Target,UsersRound,Wallet2
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
const whatsapp=value=>{const n=String(value||'').replace(/\D/g,'');return n.length>=10&&n.length<=13?'https://wa.me/'+(n.length<=11?'55'+n:n):''};
const taskOpen=t=>!['done','completed','cancelled','canceled'].includes(String(t.status||'').toLowerCase());
function Initial({name}){return <span className="v14-initial" aria-hidden="true">{name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}</span>}
function Title({index,title,sub,link,href}){return <div className="v14-panel-heading"><div><span className="v14-eyebrow">{index}</span><h2>{title}</h2><p>{sub}</p></div><Link href={href} className="v14-quiet-link">{link||'Ver todos'} <ArrowUpRight size={15}/></Link></div>}
export default function NexusExecutiveHome({data,counts,organizationName,onOperation,onReload,readonly=false,loading,openTasks=[],overdueTasks=[],pipelineStages=[],lastSync}) {
  const d=data||{},leads=d.leads||[],sales=d.sales||[],tasks=d.tasks||[],appointments=d.appointments||[];
  const pending=Array.isArray(openTasks)?openTasks:tasks.filter(taskOpen);
  const latestMs=Date.now()-30*86400000,leads30=leads.filter(x=>toDate(x.created_at)?.getTime()>=latestMs);
  const sales30=sales.filter(x=>toDate(x.created_at)?.getTime()>=latestMs),revenue=sales30.reduce((acc,x)=>acc+(Number(x.value)||0),0);
  const today=new Date();today.setHours(0,0,0,0);
  const tomorrow=new Date(today);tomorrow.setDate(tomorrow.getDate()+1);
  const late=pending.filter(x=>toDate(x.due_date)&&toDate(x.due_date).getTime()<today.getTime());
  const dueToday=pending.filter(x=>{const t=toDate(x.due_date)?.getTime();return Number.isFinite(t)&&t>=today.getTime()&&t<tomorrow.getTime()});
  const [tab,setTab]=useState('all'),[term,setTerm]=useState(''),[compose,setCompose]=useState(false);
  const [newTask,setNewTask]=useState(''),[deadline,setDeadline]=useState(''),[submitting,setSubmitting]=useState(false),[activeAction,setActiveAction]=useState('');
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const upcoming=useMemo(()=>{
    return [...pending].filter(x=>tab==='all'||(tab==='today'?dueToday.some(y=>y.id===x.id):late.some(y=>y.id===x.id)))
      .sort((a,b)=>(toDate(a.due_date)?.getTime()??Infinity)-(toDate(b.due_date)?.getTime()??Infinity)).slice(0,5);
  },[pending,tab]);
  const recent=useMemo(()=>[...leads].filter(l=>fullName(l.contact).toLowerCase().includes(term.trim().toLowerCase())||String(l.contact?.whatsapp||'').includes(term.trim()))
    .sort((a,b)=>(toDate(b.created_at)?.getTime()||0)-(toDate(a.created_at)?.getTime()||0)).slice(0,5),[leads,term]);
  const groups=useMemo(()=>{
    const out=new Map();
    for(const l of leads){const st=pipelineStages.find(x=>x.id===l.pipeline_stage_id),id=st?.id||l.status||'Sem etapa';
      if(!out.has(id))out.set(id,{name:st?.name||readable(l.status),count:0,color:st?.color||'#9a9faa'});
      out.get(id).count++}
    return [...out.values()].sort((a,b)=>b.count-a.count).slice(0,5);
  },[leads,pipelineStages]);
  const nextAppointments=useMemo(()=>appointments.filter(x=>x.start_at&&toDate(x.start_at).getTime()>=Date.now()&&!['cancelled','completed'].includes(String(x.status||'').toLowerCase()))
    .sort((a,b)=>toDate(a.start_at)-toDate(b.start_at)).slice(0,3),[appointments]);
  const filteredCounts=['leads','sales','tasks'].some(key=>Number(counts?.[key]||0)>(d[key]?.length||0));
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
  return <div className="v14-home" aria-busy={loading}>
    <div className="v14-topline"><span className="v14-kicker"><span/> {organizationName||'Sua empresa'} <span className="v14-kicker-div">/</span> Comercial</span><span className="v14-synced">{snapshot}</span></div>
    <div className="v14-hero">
      <div className="v14-hero-main">
        <span className="v14-hero-eyebrow">ÁREA DE TRABALHO <span>01 / COMERCIAL</span></span>
        <h1>Visão geral<span className="v14-hero-period">.</span></h1>
        <p>Os números da operação e o que precisa acontecer agora.</p>
        <div className="v14-hero-actions">
          <Link className="v14-action-primary" href="/leads">Abrir leads <ArrowUpRight size={17}/></Link>
          {!readonly&&<button type="button" className="v14-action-ghost" onClick={()=>setCompose(x=>!x)}><Plus size={17}/> Nova tarefa</button>}
        </div>
      </div>
      <div className="v14-hero-right" aria-label="Tarefas e prioridades">
        <div className="v14-hero-right-top"><span>EM ABERTO</span><Clock3 size={18}/></div>
        <div className="v14-hero-number">{loading?'—':int(pending.length)}<span>tarefas</span></div>
        <div className="v14-hero-rule"/>
        <div className="v14-hero-right-bottom"><span>{late.length?late.length+' '+(late.length===1?'vencida':'vencidas'):'Sem tarefas vencidas'}</span><Link href="/tasks" aria-label="Abrir lista de tarefas"><ArrowRight size={18}/></Link></div>
      </div>
      <svg className="v14-hero-motif" viewBox="0 0 500 380" aria-hidden="true"><circle cx="310" cy="183" r="126"/><circle cx="310" cy="183" r="184"/><circle cx="310" cy="183" r="245"/><path d="M-50 345L500 -25 M-50 378L500 8"/></svg>
    </div>
    {error&&<div className="v14-home-alert v14-home-error" role="alert">{error}</div>}
    {notice&&<div className="v14-home-alert v14-home-success" role="status"><CircleCheck size={16}/>{notice}<button type="button" aria-label="Fechar aviso" onClick={()=>setNotice('')}>×</button></div>}
    {compose&&<form className="v14-compose" onSubmit={createTask}>
      <label><span>Nova tarefa</span><input autoFocus required maxLength={190} value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Ex.: Retornar orçamento"/></label>
      <label><span>Prazo</span><input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} aria-label="Prazo da nova tarefa"/></label>
      <button type="submit" disabled={readonly||submitting||!newTask.trim()}>Criar <ArrowRight size={16}/></button>
      <button type="button" className="v14-cancel" onClick={()=>setCompose(false)}>Cancelar</button>
    </form>}
    <div className="v14-stats" aria-label="Indicadores dos últimos 30 dias">
      {[
        {label:'Novos leads',value:int(leads30.length),detail:'Últimos 30 dias',to:'/leads',symbol:UsersRound},
        {label:'Vendas',value:int(sales30.length),detail:'Últimos 30 dias',to:'/sales',symbol:CircleCheck},
        {label:'Receita registrada',value:brl(revenue),detail:'Últimos 30 dias',to:'/sales',symbol:Wallet2},
        {label:'Compromissos futuros',value:int(nextAppointments.length),detail:'Nos registros carregados',to:'/agenda',symbol:CalendarDays}
      ].map((s,i)=>{const Icon=s.symbol;return <Link key={s.label} href={s.to} className="v14-stat">
        <div className="v14-stat-head"><span>{s.label}</span><Icon size={18}/></div>
        <strong>{loading?'—':s.value}</strong><div className="v14-stat-bottom"><small>{s.detail}</small><ArrowUpRight size={15}/></div>
      </Link>})}
    </div>
    <div className="v14-workgrid">
      <section className="v14-panel v14-tasks-panel">
        <Title index="01 / ACOMPANHAMENTO" title="Próximos passos" sub="Tarefas que aguardam uma ação da equipe" link="Todas as tarefas" href="/tasks"/>
        <div className="v14-filters" role="group" aria-label="Filtrar tarefas">
          {[['all','Em aberto'],['today','Hoje'],['late','Vencidas']].map(([key,l])=><button key={key} type="button" className={tab===key?'active':''} aria-pressed={tab===key} onClick={()=>setTab(key)}>{l}{key==='late'&&late.length>0&&<span>{late.length}</span>}</button>)}
        </div>
        <div className="v14-rows">{upcoming.length?upcoming.map(t=><div key={t.id} className="v14-taskrow">
          <button type="button" className="v14-check" aria-label={'Concluir '+t.title} disabled={readonly||Boolean(activeAction)} onClick={()=>action({action:'task_status',id:t.id,status:'completed'},t.id)}><Check size={17}/></button>
          <div><strong>{t.title||'Tarefa sem título'}</strong><small>{t.due_date?'Prazo '+day(t.due_date):'Sem prazo definido'}{t.priority==='urgent'?' · Urgente':t.priority==='high'?' · Alta prioridade':''}</small></div>
          {toDate(t.due_date)&&toDate(t.due_date).getTime()<today.getTime()&&<span className="v14-late">Vencida</span>}
          <Link aria-label={'Abrir tarefa '+t.title} href="/tasks"><ChevronRight size={17}/></Link>
        </div>):<div className="v14-empty"><CircleCheck size={24}/><strong>Sem tarefas nesta lista</strong><p>{tab==='all'?'Quando a equipe criar tarefas, elas vão aparecer aqui.':'Selecione outro filtro para consultar as atividades.'}</p></div>}</div>
        <div className="v14-panel-foot"><span>{int(pending.length)} em aberto</span><Link href="/tasks">Gerenciar tarefas <ArrowRight size={15}/></Link></div>
      </section>
      <section className="v14-panel v14-leads-panel">
        <Title index="02 / CARTEIRA" title="Leads recentes" sub="Contatos que chegaram à empresa" link="Abrir lista" href="/leads"/>
        <label className="v14-search"><Search size={17}/><input type="search" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Buscar lead" aria-label="Buscar lead"/></label>
        <div className="v14-rows">{recent.length?recent.map(l=>{
          const who=fullName(l.contact),w=whatsapp(l.contact?.whatsapp),stage=pipelineStages.find(s=>s.id===l.pipeline_stage_id);
          return <div className="v14-leadrow" key={l.id}>
            <Initial name={who}/><Link href={'/leads?q='+encodeURIComponent(who)}><strong>{who}</strong><small>{stage?.name||readable(l.status)} <span>·</span> {l.source||'Origem não informada'}</small></Link>
            {w?<a href={w} target="_blank" rel="noopener noreferrer" aria-label={'WhatsApp de '+who}><MessageCircle size={17}/></a>:<Link aria-label={'Abrir lead '+who} href="/leads"><ArrowUpRight size={16}/></Link>}
          </div> }):<div className="v14-empty"><ContactRound size={24}/><strong>Nenhum lead encontrado</strong><p>{term?'Tente outra busca.':'Os novos contatos aparecerão aqui.'}</p></div>}</div>
      </section>
    </div>
    <div className="v14-lowergrid">
      <section className="v14-panel">
        <Title index="03 / PIPELINE" title="Distribuição do funil" sub="Leads entre os registros carregados" link="Ver quadro" href="/leads"/>
        <div className="v14-stage-list">{groups.length?groups.map((g,i)=><div key={i} className="v14-stage"><span className="v14-stage-marker" style={{background:g.color}}/><strong>{g.name}</strong><div className="v14-stage-track"><span style={{background:g.color,width:Math.max(4,g.count/Math.max(1,leads.length)*100)+'%'}}/></div><b>{g.count}</b></div>):<div className="v14-empty-small">As etapas do funil aparecerão conforme os leads forem cadastrados.</div>}</div>
      </section>
      <section className="v14-panel">
        <Title index="04 / CALENDÁRIO" title="Agenda" sub="Próximos compromissos" link="Abrir agenda" href="/agenda"/>
        <div className="v14-agenda-list">{nextAppointments.length?nextAppointments.map(a=><Link key={a.id} href="/agenda" className="v14-agenda-row">
          <CalendarDays size={18}/><span><strong>{a.title||'Compromisso'}</strong><small>{toDate(a.start_at)?.toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></span><ChevronRight size={17}/>
        </Link>):<div className="v14-empty-small">Sem compromissos futuros entre os registros carregados.</div>}</div>
      </section>
    </div>
    <div className="v14-home-note">{filteredCounts?'Atenção: alguns indicadores consideram somente os 250 registros recentes carregados, não o histórico completo.':'Indicadores calculados a partir dos registros carregados na empresa.'} Consulte os relatórios para os totais consolidados.</div>
  </div>;
}
