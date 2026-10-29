'use client';
import {useMemo} from 'react';
import Link from 'next/link';
import {ArrowUpRight,ArrowRight,CalendarClock,CheckCircle2,CircleAlert,Clock3,ContactRound,Inbox,Layers3,ListTodo,MessageCircle,Plus,UsersRound} from 'lucide-react';

const fmt=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
const shortDate=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem prazo';
const person=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'Contato sem nome';
const completed=t=>['completed','done','cancelled'].includes(String(t?.status||'').toLowerCase());

export default function NexusOpsBoard({data,counts,loading,organizationName,firstName,openTasks=[],overdueTasks=[],lastSync,pipelineStages=[]}){
  const dateNow=new Date();
  const today=[dateNow.getFullYear(),String(dateNow.getMonth()+1).padStart(2,'0'),String(dateNow.getDate()).padStart(2,'0')].join('-');
  const tasks=useMemo(()=>[...openTasks].filter(t=>!completed(t)).sort((a,b)=>{
    const aLate=a.due_date&&String(a.due_date).slice(0,10)<today;
    const bLate=b.due_date&&String(b.due_date).slice(0,10)<today;
    if(aLate!==bLate)return aLate?-1:1;
    return String(a.due_date||'9999').localeCompare(String(b.due_date||'9999'));
  }),[openTasks,today]);
  const todayTasks=tasks.filter(t=>String(t.due_date||'').slice(0,10)===today);
  const stages=useMemo(()=>pipelineStages.map(s=>({
    id:s.id,name:s.name,total:data.leads.filter(l=>l.pipeline_stage_id===s.id).length
  })),[pipelineStages,data.leads]);
  const unassigned=data.leads.filter(l=>!l.pipeline_stage_id).length;
  const activity=useMemo(()=>[
    ...data.leads.map(x=>({id:'l'+x.id,type:'Lead',name:person(x.contact),date:x.created_at,href:'/leads'})),
    ...data.tasks.map(x=>({id:'t'+x.id,type:'Tarefa',name:x.title,date:x.created_at,href:'/tasks'})),
    ...data.appointments.map(x=>({id:'a'+x.id,type:'Agenda',name:x.title||'Compromisso',date:x.created_at,href:'/agenda'})),
    ...data.sales.map(x=>({id:'s'+x.id,type:'Venda',name:'Venda registrada',date:x.created_at,href:'/reports'}))
  ].filter(x=>x.date&&Number.isFinite(Date.parse(x.date))).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,6),[data]);
  const attention=tasks.filter(t=>t.due_date&&String(t.due_date).slice(0,10)<=today).length;
  const names={Lead:UsersRound,Tarefa:ListTodo,Agenda:CalendarClock,Venda:CheckCircle2};
  return <div className="nxo-board" aria-label="Central operacional do Nexus">
    <section className="nxo-editorial">
      <div className="nxo-editorial-copy"><span className="nxo-eyebrow"><span className="nxo-live-dot"/> MESA DE OPERAÇÃO / {organizationName}</span>
        <h1>O trabalho acontece <em>aqui.</em></h1>
        <p>Olá, {firstName}. Uma central para decidir, atender e acompanhar o que importa. Sem indicadores inventados.</p>
        <div className="nxo-hero-actions"><Link href="/whatsapp" className="nxo-hero-primary"><MessageCircle size={17}/> Abrir atendimentos <ArrowUpRight size={15}/></Link><Link href="/leads" className="nxo-hero-secondary">Ver oportunidades <ArrowRight size={16}/></Link></div>
      </div>
      <div className="nxo-editorial-meta"><span>EMPRESA EM FOCO</span><strong>{organizationName}</strong><div className="nxo-meta-rule"/><small>{lastSync?'Dados consultados às '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):loading?'Carregando registros':'Aguardando atualização'}</small><span className="nxo-meta-mark">NX / OPS</span></div>
    </section>

    <section className="nxo-indicators" aria-label="Indicadores operacionais">
      <Link href="/tasks" className="nxo-indicator nxo-indicator--priority"><span>01 / PENDÊNCIAS</span><strong>{loading?'—':fmt(attention)}</strong><small><CircleAlert size={14}/> Tarefas vencidas ou para hoje</small></Link>
      <Link href="/leads" className="nxo-indicator"><span>02 / OPORTUNIDADES</span><strong>{loading?'—':fmt(counts.leads)}</strong><small><UsersRound size={14}/> Total registrado no banco</small></Link>
      <Link href="/tasks" className="nxo-indicator"><span>03 / ROTINA</span><strong>{loading?'—':fmt(todayTasks.length)}</strong><small><Clock3 size={14}/> Tarefas com prazo hoje</small></Link>
      <Link href="/contacts" className="nxo-indicator"><span>04 / RELACIONAMENTO</span><strong>{loading?'—':fmt(counts.contacts)}</strong><small><ContactRound size={14}/> Contatos da empresa</small></Link>
    </section>

    <div className="nxo-work-grid">
      <section className="nxo-work-panel nxo-priority-panel">
        <header className="nxo-panel-header"><div><span className="nxo-eyebrow">FILA DE TRABALHO</span><h2>Próximas decisões</h2><p>Comece pelo que está vencendo.</p></div><Link href="/tasks">Todas as tarefas <ArrowUpRight size={15}/></Link></header>
        <div className="nxo-task-list">{tasks.slice(0,6).map((t,i)=>{
          const late=t.due_date&&String(t.due_date).slice(0,10)<today;
          return <Link key={t.id} href="/tasks" className="nxo-task-item"><span className="nxo-task-n">{String(i+1).padStart(2,'0')}</span><span className="nxo-task-main"><strong>{t.title}</strong><small>{t.due_date?shortDate(t.due_date):'Sem prazo definido'} · {t.priority||'Prioridade não informada'}</small></span><span className={'nxo-task-state '+(late?'late':'')}>{late?'Vencida':t.due_date&&String(t.due_date).slice(0,10)===today?'Hoje':'Pendente'}</span><ArrowUpRight size={15}/></Link>
        })}{!tasks.length&&<div className="nxo-empty"><CheckCircle2 size={25}/><strong>Sem tarefas pendentes nos registros carregados</strong><p>Use a área de tarefas para planejar os próximos atendimentos.</p></div>}</div>
        <Link href="/tasks?new=1" className="nxo-panel-footer"><Plus size={16}/> Registrar nova tarefa <ArrowRight size={15}/></Link>
      </section>

      <section className="nxo-work-panel nxo-pipeline-panel">
        <header className="nxo-panel-header"><div><span className="nxo-eyebrow">JORNADA COMERCIAL</span><h2>Funil em movimento</h2><p>Distribuição dos últimos registros carregados.</p></div><Link href="/leads">Abrir funil <ArrowUpRight size={15}/></Link></header>
        <div className="nxo-stage-list">{stages.slice(0,7).map((s,i)=><Link key={s.id} href="/leads" className="nxo-stage"><span className="nxo-stage-id">{String(i+1).padStart(2,'0')}</span><span className="nxo-stage-title">{s.name}</span><span className="nxo-stage-track"><span style={{width:Math.max(0,Math.min(100,100*s.total/Math.max(1,data.leads.length)))+'%'}}/></span><strong>{fmt(s.total)}</strong></Link>)}
        {unassigned>0&&<Link href="/leads" className="nxo-stage"><span className="nxo-stage-id">—</span><span className="nxo-stage-title">Sem etapa</span><span className="nxo-stage-track"><span style={{width:100*unassigned/Math.max(1,data.leads.length)+'%'}}/></span><strong>{fmt(unassigned)}</strong></Link>}
        {!stages.length&&!unassigned&&<div className="nxo-empty"><Layers3 size={25}/><strong>Nenhum dado de funil disponível</strong><p>As etapas cadastradas na empresa aparecerão aqui.</p></div>}
        </div>
        <div className="nxo-panel-footer nxo-footer-info"><Layers3 size={16}/> Base exibida limitada aos registros carregados</div>
      </section>
    </div>

    <div className="nxo-bottom-grid">
      <section className="nxo-work-panel">
        <header className="nxo-panel-header"><div><span className="nxo-eyebrow">REGISTROS RECENTES</span><h2>O que mudou</h2></div><Link href="/reports">Relatórios <ArrowUpRight size={15}/></Link></header>
        <div className="nxo-activity">{activity.map(x=>{const Icon=names[x.type]||Inbox;return <Link href={x.href} key={x.id} className="nxo-activity-row"><span><Icon size={16}/></span><span><small>{x.type}</small><strong>{x.name}</strong></span><time>{shortDate(x.date)}</time><ArrowUpRight size={14}/></Link>})}{!activity.length&&<div className="nxo-empty"><Inbox size={24}/><strong>Sem movimentações recentes</strong><p>Cadastros, vendas e tarefas aparecerão nesta linha do tempo.</p></div>}</div>
      </section>
      <section className="nxo-work-panel nxo-actions-panel">
        <header className="nxo-panel-header"><div><span className="nxo-eyebrow">ACESSOS DIRETOS</span><h2>Continuar a operação</h2></div></header>
        {[['/whatsapp',MessageCircle,'Atendimentos','Histórico e conexão oficial'],['/leads',Layers3,'Pipeline','Avançar negociações'],['/contacts',ContactRound,'Base de contatos','Consultar e cadastrar pessoas'],['/agenda',CalendarClock,'Agenda','Compromissos e visitas']].map(([href,Icon,name,subtitle])=><Link key={href} href={href} className="nxo-action"><span><Icon size={20}/></span><span><strong>{name}</strong><small>{subtitle}</small></span><ArrowUpRight size={16}/></Link>)}
      </section>
    </div>
  </div>;
}
