'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {
  ArrowRight,ArrowUpRight,CalendarDays,Check,CheckCircle2,ChevronRight,
  Clock3,Download,MessageCircle,Plus,RefreshCw,Search,UsersRound
} from 'lucide-react';

const n=v=>new Intl.NumberFormat('pt-BR').format(Number(v)||0);
const cash=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v)||0);
const shortDate=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem prazo';
const name=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim()||'Nome não informado';
const status=v=>({new:'Novo',pending:'Pendente',open:'Aberto',qualified:'Qualificado',won:'Ganho',lost:'Perdido'})[String(v||'').toLowerCase()]||String(v||'Sem etapa');
const phoneHref=v=>{
  const d=String(v||'').replace(/\D/g,'');
  return d.length<10||d.length>13?'':'https://wa.me/'+(d.length<=11?'55'+d:d);
};
const isOpen=t=>!['completed','done','cancelled','canceled'].includes(String(t.status||'').toLowerCase());
function Section({title,sub,href,link,children,className=''}) {
  return <section className={'desk-section '+className}>
    <header className="desk-section-header"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>
      {href&&<Link className="desk-section-link" href={href}>{link||'Ver todos'}<ArrowUpRight size={16}/></Link>}</header>
    {children}
  </section>;
}
export default function NexusDesk({data,counts,loading,organizationName,onOperation,onReload,readonly=false,openTasks=[],overdueTasks=[],pipelineStages=[],lastSync}) {
  const records=data||{},leads=records.leads||[],sales=records.sales||[],tasks=records.tasks||[],appointments=records.appointments||[];
  const pending=Array.isArray(openTasks)?openTasks:tasks.filter(isOpen);
  const [taskView,setTaskView]=useState('todos');
  const [leadSearch,setLeadSearch]=useState('');
  const [showCreate,setShowCreate]=useState(false);
  const [taskTitle,setTaskTitle]=useState('');
  const [taskDue,setTaskDue]=useState('');
  const [working,setWorking]=useState('');
  const [feedback,setFeedback]=useState('');
  const [error,setError]=useState('');
  const now=new Date(), todayKey=now.toISOString().slice(0,10);
  const recentStart=Date.now()-30*86400000;
  const newLeads=leads.filter(x=>x.created_at&&new Date(x.created_at).getTime()>=recentStart);
  const newSales=sales.filter(x=>x.created_at&&new Date(x.created_at).getTime()>=recentStart);
  const revenue=newSales.reduce((a,x)=>a+(Number(x.value)||0),0);
  const partial=['leads','sales','tasks'].some(t=>Number(counts?.[t]||0)>(records[t]?.length||0));
  const overdue=Array.isArray(overdueTasks)?overdueTasks:pending.filter(t=>t.due_date&&new Date(t.due_date).getTime()<Date.now());
  const stageOf=lead=>pipelineStages.find(s=>s.id===lead.pipeline_stage_id);
  const filteredTasks=useMemo(()=>{
    const start=new Date();start.setHours(0,0,0,0);
    const end=new Date(start);end.setDate(end.getDate()+1);
    return pending.filter(t=>{
      const time=t.due_date?new Date(t.due_date).getTime():NaN;
      return taskView==='todos' || (taskView==='atrasadas'&&Number.isFinite(time)&&time<start.getTime())||
        (taskView==='hoje'&&Number.isFinite(time)&&time>=start.getTime()&&time<end.getTime());
    }).sort((a,b)=>(a.due_date?new Date(a.due_date).getTime():Infinity)-(b.due_date?new Date(b.due_date).getTime():Infinity)).slice(0,7);
  },[pending,taskView]);
  const filteredLeads=useMemo(()=>[...leads].filter(l=>[name(l.contact),l.contact?.whatsapp,l.source].join(' ').toLocaleLowerCase('pt-BR').includes(leadSearch.toLocaleLowerCase('pt-BR')))
    .sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,7),[leads,leadSearch]);
  const stages=useMemo(()=>{
    const groups=new Map();
    for(const lead of leads){const found=stageOf(lead),key=found?.id||String(lead.status||'Sem etapa');
      if(!groups.has(key))groups.set(key,{key,name:found?.name||status(lead.status),color:found?.color||'#95a4b7',count:0});
      groups.get(key).count++;
    }
    return [...groups.values()].sort((a,b)=>b.count-a.count).slice(0,6);
  },[leads,pipelineStages]);
  const stamp=lastSync?'Atualizado '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Atualização pendente';
  async function action(payload,kind){
    if(readonly||working)return;
    setWorking(kind);setFeedback('');setError('');
    try{const result=await onOperation(payload);await onReload?.();setFeedback(result?.message||'Alteração salva.');return true}
    catch(e){setError('Não foi possível salvar: '+e.message);return false}
    finally{setWorking('')}
  }
  async function create(e){
    e.preventDefault();
    if(!taskTitle.trim())return;
    if(await action({action:'task_create',title:taskTitle.trim(),due_date:taskDue||null,priority:'medium'},'create')){
      setShowCreate(false);setTaskTitle('');setTaskDue('');
    }
  }
  return <div className="desk" aria-busy={loading}>
    <div className="desk-pagehead">
      <div><div className="desk-location">{organizationName||'Empresa'} <span>/</span> Visão geral</div><h1>Visão geral</h1>
        <p>Atendimentos e tarefas da equipe.</p></div>
      <div className="desk-page-actions"><span className="desk-stamp">{stamp}</span>
        <button type="button" className="desk-refresh" onClick={()=>onReload?.()} aria-label="Atualizar indicadores"><RefreshCw size={17}/></button>
        {!readonly&&<button type="button" className="desk-primary" onClick={()=>setShowCreate(v=>!v)}><Plus size={17}/> Nova tarefa</button>}
      </div>
    </div>
    {error&&<div className="desk-banner desk-banner--error" role="alert">{error}</div>}
    {feedback&&<div className="desk-banner desk-banner--success" role="status"><CheckCircle2 size={17}/>{feedback}<button type="button" onClick={()=>setFeedback('')} aria-label="Fechar aviso">×</button></div>}
    {showCreate&&<form className="desk-compose" onSubmit={create}>
      <label><span>Tarefa</span><input autoFocus required minLength={2} maxLength={190} value={taskTitle} placeholder="Ex.: Retornar para o cliente" onChange={e=>setTaskTitle(e.target.value)}/></label>
      <label><span>Prazo</span><input aria-label="Prazo da nova tarefa" type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label>
      <button type="submit" disabled={!!working||taskTitle.trim().length<2}>Salvar</button>
      <button type="button" className="desk-cancel" onClick={()=>setShowCreate(false)}>Cancelar</button>
    </form>}
    <div className="desk-metrics" aria-label="Resumo dos últimos 30 dias">
      {[
        {label:'Leads recebidos',value:loading?'—':n(newLeads.length),href:'/leads',detail:'30 dias'},
        {label:'Vendas',value:loading?'—':n(newSales.length),href:'/sales',detail:'30 dias'},
        {label:'Receita registrada',value:loading?'—':cash(revenue),href:'/sales',detail:'30 dias'},
        {label:'Tarefas em aberto',value:loading?'—':n(pending.length),href:'/tasks',detail:overdue.length?overdue.length+' vencidas':'Equipe'}
      ].map((x,i)=><Link key={x.label} href={x.href} className="desk-metric"><span>{x.label}</span><strong>{x.value}</strong>
        <small>{x.detail}<ArrowUpRight size={14}/></small></Link>)}
    </div>
    <div className="desk-main-grid">
      <Section className="desk-queue" title="Tarefas" sub="O que precisa ser feito" href="/tasks" link="Abrir tarefas">
        <div className="desk-tabs" role="group" aria-label="Filtrar tarefas">
          {[['todos','Em aberto'],['hoje','Hoje'],['atrasadas','Vencidas']].map(([v,l])=><button key={v} type="button" aria-pressed={taskView===v} className={taskView===v?'selected':''} onClick={()=>setTaskView(v)}>{l}{v==='atrasadas'&&overdue.length>0?<b>{overdue.length}</b>:null}</button>)}
        </div>
        <div className="desk-task-list">
          {filteredTasks.length?filteredTasks.map(t=>{
            const late=t.due_date&&new Date(t.due_date).getTime()<Date.now();
            return <div className="desk-task" key={t.id}>
              <button type="button" className="desk-task-check" title="Concluir tarefa" aria-label={'Concluir '+t.title} disabled={readonly||!!working} onClick={()=>action({action:'task_status',id:t.id,status:'completed'},t.id)}>{working===t.id?<Clock3 size={16}/>:<Check size={17}/>}</button>
              <div><strong>{t.title||'Sem título'}</strong><span>{t.due_date?'Prazo '+shortDate(t.due_date):'Sem prazo definido'}{t.priority==='urgent'?' · Urgente':t.priority==='high'?' · Alta prioridade':''}</span></div>
              {late&&<span className="desk-overdue">Vencida</span>}
              <Link href="/tasks" className="desk-task-open" aria-label={'Ver tarefa '+t.title}><ChevronRight size={17}/></Link>
            </div>;
          }):<div className="desk-empty"><strong>Nenhuma tarefa nesta lista.</strong><p>{taskView==='todos'?'Crie uma tarefa ou consulte a agenda.':'Tente outro filtro.'}</p></div>}
        </div>
        <footer className="desk-section-footer">{pending.length} tarefas em aberto <Link href="/tasks">Ver agenda de trabalho <ArrowRight size={14}/></Link></footer>
      </Section>
      <Section className="desk-inbox" title="Leads recentes" sub="Últimos cadastros" href="/leads" link="Todos os leads">
        <label className="desk-search"><Search size={17}/><input value={leadSearch} onChange={e=>setLeadSearch(e.target.value)} aria-label="Buscar leads recentes" placeholder="Buscar por nome ou telefone"/></label>
        <div className="desk-lead-list">{filteredLeads.length?filteredLeads.map(l=>{
          const person=name(l.contact),phone=phoneHref(l.contact?.whatsapp),stage=stageOf(l);
          return <div key={l.id} className="desk-lead">
            <span className="desk-initial">{person.trim().split(/\s+/).slice(0,2).map(t=>t[0]||'').join('').toUpperCase()}</span>
            <Link href={'/leads?q='+encodeURIComponent(person)}><strong>{person}</strong><small>{stage?.name||status(l.status)}{l.source?' · '+l.source:''}</small></Link>
            {phone?<a href={phone} target="_blank" rel="noopener noreferrer" className="desk-whatsapp" title={'Conversar com '+person} aria-label={'WhatsApp de '+person}><MessageCircle size={17}/></a>:<Link href="/leads" className="desk-whatsapp" aria-label={'Abrir lead '+person}><ArrowUpRight size={17}/></Link>}
          </div>;
        }):<div className="desk-empty"><strong>Nenhum lead encontrado.</strong><p>Experimente outra busca.</p></div>}</div>
      </Section>
    </div>
    <div className="desk-bottom-grid">
      <Section title="Funil" sub="Distribuição dos leads carregados" href="/leads" link="Abrir quadro">
        <div className="desk-stage-list">{stages.length?stages.map(s=><div key={s.key} className="desk-stage">
          <span className="desk-stage-color" style={{backgroundColor:s.color}}/><strong>{s.name}</strong><div className="desk-stage-track"><i style={{width:Math.max(3,s.count/Math.max(1,leads.length)*100)+'%',backgroundColor:s.color}}/></div><span className="desk-stage-count">{n(s.count)}</span>
        </div>):<div className="desk-empty"><strong>Sem leads cadastrados.</strong><p>O funil aparece conforme sua equipe recebe contatos.</p></div>}</div>
      </Section>
      <Section title="Agenda" sub="Próximos compromissos" href="/agenda" link="Abrir agenda">
        <div className="desk-appointment-list">{appointments.filter(a=>a.start_at&&new Date(a.start_at).getTime()>=Date.now()&& !['cancelled','completed'].includes(String(a.status))).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at)).slice(0,5).map(a=><Link key={a.id} href="/agenda" className="desk-appointment"><span><CalendarDays size={18}/></span><div><strong>{a.title||'Compromisso'}</strong><small>{new Date(a.start_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div><ChevronRight size={16}/></Link>)}
          {!appointments.some(a=>a.start_at&&new Date(a.start_at).getTime()>=Date.now()&&!['cancelled','completed'].includes(String(a.status)))&&<div className="desk-empty"><strong>Sem compromissos futuros.</strong><p>Agendamentos criados aparecerão aqui.</p></div>}
        </div>
      </Section>
    </div>
    <footer className="desk-footnote">{partial?'Os resultados desta tela consideram até 250 registros recentes por módulo e não representam necessariamente o total histórico.':'Os números desta tela são calculados com os registros carregados da empresa.'} Para totais consolidados, consulte Relatórios.</footer>
  </div>;
}
