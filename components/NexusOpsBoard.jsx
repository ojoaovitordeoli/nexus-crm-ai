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
  return <div className="nxo-desk" aria-label="Mesa de operação do Nexus">
    <header className="nxo-desk-heading">
      <div className="nxo-desk-heading-left">
        <div className="nxo-desk-utility"><span className="nxo-live-dot"/> NEXUS / MESA DE OPERAÇÃO <span className="nxo-desk-slash">/</span> {organizationName}</div>
        <h1>O que precisa <em>acontecer hoje.</em></h1>
        <p>Olá, {firstName}. Comece pelo atendimento que precisa de você. O restante acompanha o trabalho.</p>
      </div>
      <div className="nxo-desk-heading-right">
        <time>{dateNow.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</time>
        <small>{lastSync?'Registros consultados às '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):loading?'Consultando registros':'Consulta pendente'}</small>
        <Link href="/whatsapp"><MessageCircle size={16}/> Ir para atendimentos <ArrowUpRight size={15}/></Link>
      </div>
    </header>
    <div className="nxo-desk-numbers" role="group" aria-label="Resumo da operação">
      <Link href="/tasks" className="nxo-desk-number nxo-desk-number--hot"><span>PRECISAM DE AÇÃO</span><strong>{loading?'—':fmt(attention)}</strong><small>Vencidas ou para hoje</small></Link>
      <Link href="/leads" className="nxo-desk-number"><span>OPORTUNIDADES</span><strong>{loading?'—':fmt(counts.leads)}</strong><small>Total cadastrado</small></Link>
      <Link href="/contacts" className="nxo-desk-number"><span>CONTATOS</span><strong>{loading?'—':fmt(counts.contacts)}</strong><small>Base da empresa</small></Link>
      <Link href="/tasks" className="nxo-desk-number"><span>AGENDA DE HOJE</span><strong>{loading?'—':fmt(todayTasks.length)}</strong><small>Tarefas programadas</small></Link>
    </div>
    <div className="nxo-desk-columns">
      <section className="nxo-desk-primary">
        <section className="nxo-desk-queue" aria-label="Fila de prioridades">
          <div className="nxo-desk-section-title"><span className="nxo-desk-overline">01 / O QUE FAZER</span><div className="nxo-desk-section-line"><h2>Sua fila de decisões</h2><Link href="/tasks">Ver rotina inteira <ArrowUpRight size={16}/></Link></div><p>Sem floreios. Cada linha é um trabalho real para acompanhar.</p></div>
          <div className="nxo-desk-queue-list">
            {tasks.slice(0,7).map((t,i)=>{
              const late=t.due_date&&String(t.due_date).slice(0,10)<today;
              const dueToday=String(t.due_date||'').slice(0,10)===today;
              return <Link key={t.id} href="/tasks" className="nxo-desk-queue-item">
                <span className="nxo-desk-item-index">{String(i+1).padStart(2,'0')}</span>
                <span className="nxo-desk-item-main"><strong>{t.title}</strong><small>{t.due_date?shortDate(t.due_date):'Sem prazo definido'} <span>·</span> {t.priority||'Prioridade normal'}</small></span>
                <span className={'nxo-desk-item-status '+(late?'is-late':dueToday?'is-today':'')}>{late?'Atrasada':dueToday?'Vence hoje':'A fazer'}</span>
                <ArrowUpRight size={17}/>
              </Link>;
            })}
            {!tasks.length&&<div className="nxo-desk-queue-empty"><CheckCircle2 size={26}/><strong>Nenhuma pendência nos registros carregados.</strong><p>Cadastre uma tarefa ou acompanhe um atendimento para movimentar sua operação.</p></div>}
          </div>
          <div className="nxo-desk-queue-actions"><Link href="/tasks?new=1"><Plus size={17}/> Criar tarefa</Link><Link href="/leads"><UsersRound size={17}/> Trabalhar oportunidades <ArrowRight size={15}/></Link></div>
        </section>
        <section className="nxo-desk-activity" aria-label="Atividade recente">
          <div className="nxo-desk-section-title"><span className="nxo-desk-overline">02 / RASTRO DA OPERAÇÃO</span><div className="nxo-desk-section-line"><h2>Últimas movimentações</h2><Link href="/reports">Relatórios <ArrowUpRight size={16}/></Link></div></div>
          <div className="nxo-desk-activity-list">
            {activity.map(x=>{const Icon=names[x.type]||Inbox;return <Link key={x.id} href={x.href} className="nxo-desk-event"><span className="nxo-desk-event-icon"><Icon size={17}/></span><span className="nxo-desk-event-main"><small>{x.type}</small><strong>{x.name}</strong></span><time>{shortDate(x.date)}</time><ArrowUpRight size={15}/></Link>})}
            {!activity.length&&<p className="nxo-desk-activity-empty">Ainda não há movimentações registradas nesta empresa.</p>}
          </div>
        </section>
      </section>
      <aside className="nxo-desk-rail" aria-label="Contexto e ferramentas de trabalho">
        <div className="nxo-desk-rail-intro"><span className="nxo-desk-rail-overline">EM FOCO / OPERAÇÃO</span><h2>O trabalho não<br/>pode parar.</h2><p>Acompanhe a evolução das oportunidades enquanto mantém o atendimento ativo.</p></div>
        <section className="nxo-desk-rail-stages">
          <div className="nxo-desk-rail-title"><span>ESTÁGIOS DO FUNIL</span><Link href="/leads" aria-label="Abrir pipeline"><ArrowUpRight size={18}/></Link></div>
          {stages.slice(0,8).map((s,i)=><Link key={s.id} href="/leads" className="nxo-desk-rail-stage"><span>{String(i+1).padStart(2,'0')}</span><strong>{s.name}</strong><em>{fmt(s.total)}</em></Link>)}
          {unassigned>0&&<Link href="/leads" className="nxo-desk-rail-stage"><span>—</span><strong>Sem etapa</strong><em>{fmt(unassigned)}</em></Link>}
          {!stages.length&&!unassigned&&<p className="nxo-desk-rail-empty">Nenhuma etapa com dados carregados.</p>}
          <small className="nxo-desk-rail-note">Distribuição apenas dos últimos registros carregados</small>
        </section>
        <section className="nxo-desk-rail-links">
          <div className="nxo-desk-rail-title"><span>ABRIR MÓDULO</span></div>
          {[['/whatsapp',MessageCircle,'Atendimentos'],['/contacts',ContactRound,'Pessoas e contatos'],['/agenda',CalendarClock,'Agenda'],['/automations',Layers3,'Automações']].map(([href,Icon,name])=><Link href={href} key={href}><Icon size={17}/>{name}<ArrowUpRight size={16}/></Link>)}
        </section>
        <div className="nxo-desk-rail-mark">NEXUS <span> / </span> OPERATIONS</div>
      </aside>
    </div>
    <footer className="nxo-desk-footer">Indicadores baseados nos registros disponíveis; resultados e limites do banco devem ser validados nos relatórios. <Link href="/reports">Consultar relatórios <ArrowRight size={14}/></Link></footer>
  </div>;
}
