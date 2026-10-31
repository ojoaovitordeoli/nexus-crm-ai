'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {
  ArrowRight,ArrowUpRight,CalendarDays,CheckCheck,Clock3,ContactRound,
  MessageCircle,ReceiptText,Target,UsersRound,Wallet,AlertTriangle
} from 'lucide-react';

const n=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
const m=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v)||0);
const dt=v=>v&&!Number.isNaN(new Date(v).getTime())?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem data';
const person=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim()||'Sem nome';
const phoneLink=value=>{
  const d=String(value||'').replace(/\D/g,'');
  return d.length<10||d.length>13?'':'https://wa.me/'+(d.length<=11?'55'+d:d);
};
const stageName=(lead,stages)=>stages.find(s=>s.id===lead.pipeline_stage_id)?.name||
 ({new:'Novo',open:'Em aberto',pending:'Pendente',won:'Ganho',lost:'Perdido'})[String(lead.status||'').toLowerCase()]||String(lead.status||'Sem etapa');
const activeTask=t=>!['done','completed','cancelled','canceled'].includes(String(t.status||'').toLowerCase());
const validDate=v=>v&&Number.isFinite(new Date(v).getTime());
function Heading({eyebrow,title,description,action}){
  return <header className="v11-section-heading"><div><span>{eyebrow}</span><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</header>;
}
function Trend({rows,days}){
  const max=Math.max(1,...rows.map(r=>r.total));
  const points=rows.map((r,i)=>({x:40+i*107,y:194-r.total/max*160,...r}));
  const d=points.map((r,i)=>(i?'L':'M')+r.x+' '+r.y).join(' ');
  return <div className="v11-trend"><svg viewBox="0 0 722 230" preserveAspectRatio="xMidYMid meet" role="img" aria-label={'Leads por intervalo nos últimos '+days+' dias'}>
    <defs><linearGradient id="v11-curve" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#9bdccf" stopOpacity=".22"/><stop offset="1" stopColor="#9bdccf" stopOpacity="0"/></linearGradient></defs>
    {[34,87,141,194].map(y=><line key={y} x1="40" x2="682" y1={y} y2={y} className="v11-trend-guide"/>)}
    <path d={d+' L '+points[6].x+' 194 L 40 194 Z'} fill="url(#v11-curve)"/>
    <path d={d} className="v11-trend-line"/>
    {points.map((p,i)=><g key={i}><circle className="v11-trend-dot" cx={p.x} cy={p.y} r="4.5" tabIndex="0"><title>{p.label+': '+p.total+' leads'}</title></circle><text x={p.x} y="222" textAnchor="middle" className="v11-trend-tick">{p.label}</text></g>)}
  </svg></div>;
}
export default function NexusV11Dashboard({data,counts,loading,organizationName,openTasks=[],overdueTasks=[],lastSync,pipelineStages=[]}){
  const [period,setPeriod]=useState(30);
  const d=data||{},leads=d.leads||[],sales=d.sales||[],tasks=d.tasks||[],appointments=d.appointments||[];
  const since=Date.now()-period*86400000;
  const recent=rows=>rows.filter(r=>validDate(r.created_at)&&new Date(r.created_at).getTime()>=since);
  const recentLeads=recent(leads);
  const recentSales=recent(sales);
  const revenue=recentSales.reduce((sum,s)=>sum+(Number(s.value)||0),0);
  const toDo=Array.isArray(openTasks)?openTasks:tasks.filter(activeTask);
  const late=Array.isArray(overdueTasks)?overdueTasks:[];
  const sorted=[...toDo].sort((a,b)=>(validDate(a.due_date)?new Date(a.due_date).getTime():Infinity)-(validDate(b.due_date)?new Date(b.due_date).getTime():Infinity));
  const newLeads=[...leads].sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0)).slice(0,6);
  const partial=Object.keys(counts||{}).some(k=>['leads','tasks','sales'].includes(k)&&Number(counts[k])>(d[k]?.length||0));
  const steps=useMemo(()=>{
    const grouped=new Map();
    for(const lead of leads){
      const stage=pipelineStages.find(s=>s.id===lead.pipeline_stage_id);
      const key=stage?.id||lead.status||'Sem etapa';
      if(!grouped.has(key))grouped.set(key,{key,name:stageName(lead,pipelineStages),count:0,color:stage?.color||'#839ba7'});
      grouped.get(key).count+=1;
    }
    return [...grouped.values()].sort((a,b)=>b.count-a.count).slice(0,5);
  },[leads,pipelineStages]);
  const trend=useMemo(()=>{
    const end=Date.now(),duration=period*86400000,interval=duration/6;
    return Array.from({length:7},(_,i)=>{
      const from=end-duration+i*interval,to=end-duration+(i+1)*interval;
      return {label:new Date(from).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}),
        total:leads.filter(x=>validDate(x.created_at)&&new Date(x.created_at).getTime()>=from&&new Date(x.created_at).getTime()<to).length};
    });
  },[leads,period]);
  const activity=useMemo(()=>[
    ...leads.map(x=>({id:'l'+x.id,date:x.created_at,title:person(x.contact),type:'Lead recebido',href:'/leads',icon:UsersRound})),
    ...sales.map(x=>({id:'s'+x.id,date:x.created_at,title:m(x.value),type:'Venda registrada',href:'/sales',icon:ReceiptText})),
    ...appointments.map(x=>({id:'a'+x.id,date:x.created_at,title:x.title||'Agendamento',type:'Agenda',href:'/agenda',icon:CalendarDays})),
    ...tasks.map(x=>({id:'t'+x.id,date:x.created_at,title:x.title||'Tarefa',type:'Atividade criada',href:'/tasks',icon:Clock3}))
  ].filter(x=>validDate(x.date)).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5),[leads,sales,appointments,tasks]);
  const sync=lastSync?'Sincronizado '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Aguardando sincronização';

  return <div className="v11-dashboard" aria-busy={loading}>
    <div className="v11-pageheading">
      <div><span className="v11-location"><span className="v11-live-dot"/> {organizationName||'Empresa'} <span className="v11-location-slash">/</span> Comercial</span>
        <h1>Central de vendas</h1><p>Atendimentos que precisam de ação e resultados da operação.</p></div>
      <div className="v11-page-actions"><span className="v11-synced">{sync}</span><Link href="/leads" className="v11-add-button">Abrir oportunidades <ArrowUpRight size={17}/></Link></div>
    </div>
    <div className="v11-summary" aria-label="Indicadores comerciais">
      <Link href="/leads" className="v11-summary-item v11-summary-main">
        <div className="v11-summary-head"><UsersRound size={18}/><span>Leads recebidos</span></div>
        <div className="v11-summary-data"><strong>{loading?'—':n(recentLeads.length)}</strong><span>{period} dias</span></div>
      </Link>
      <Link href="/sales" className="v11-summary-item"><span>Vendas registradas</span><strong>{loading?'—':n(recentSales.length)}</strong><small>No período</small></Link>
      <Link href="/sales" className="v11-summary-item"><span>Receita registrada</span><strong>{loading?'—':m(revenue)}</strong><small>Conforme vendas carregadas</small></Link>
      <Link href="/tasks" className="v11-summary-item"><span>Tarefas pendentes</span><strong>{loading?'—':n(toDo.length)}</strong><small className={late.length?'v11-danger':''}>{late.length?late.length+' vencidas':'Nenhuma vencida'}</small></Link>
    </div>
    <div className="v11-focus-grid">
      <section className="v11-focus" aria-label="Prioridades da operação">
        <Heading eyebrow="01 / TRABALHO" title="Prioridades" description="Retornos que precisam acontecer." action={<Link href="/tasks" className="v11-small-action">Abrir tarefas <ArrowUpRight size={16}/></Link>}/>
        {late.length>0&&<Link className="v11-pending-alert" href="/tasks"><AlertTriangle size={18}/><span><strong>{late.length} {late.length===1?'prazo vencido':'prazos vencidos'}</strong><small>Revise os retornos da equipe</small></span><ArrowRight size={16}/></Link>}
        <div className="v11-queue">{sorted.length?sorted.slice(0,5).map(t=><Link href="/tasks" className="v11-queue-row" key={t.id}>
          <span className="v11-queue-mark"><Clock3 size={18}/></span>
          <span className="v11-queue-copy"><strong>{t.title||'Tarefa sem título'}</strong><small>{t.due_date?'Prazo '+dt(t.due_date):'Sem prazo definido'}</small></span>
          <span className="v11-queue-status">{t.priority==='urgent'?'Urgente':t.priority==='high'?'Alta prioridade':'Pendente'}</span><ArrowUpRight size={16}/>
        </Link>):<div className="v11-blank"><CheckCheck size={22}/><strong>Sem retornos pendentes</strong><p>As atividades da equipe aparecerão aqui.</p><Link href="/tasks">Ver tarefas <ArrowRight size={15}/></Link></div>}</div>
      </section>
      <section className="v11-opportunities" aria-label="Leads recentes">
        <Heading eyebrow="02 / OPORTUNIDADES" title="Leads recentes" description="Pessoas que chegaram à operação." action={<Link href="/leads" className="v11-small-action">Ver todos <ArrowUpRight size={16}/></Link>}/>
        <div className="v11-people">{newLeads.length?newLeads.slice(0,5).map(lead=>{
          const name=person(lead.contact),phone=phoneLink(lead.contact?.whatsapp);
          return <div className="v11-person" key={lead.id}><span className="v11-person-avatar">{name.split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()}</span>
            <Link href={'/leads?q='+encodeURIComponent(name)} className="v11-person-text"><strong>{name}</strong><small>{stageName(lead,pipelineStages)} · {lead.source||'Origem não informada'}</small></Link>
            {phone?<a href={phone} target="_blank" rel="noopener noreferrer" className="v11-person-action" aria-label={'WhatsApp de '+name}><MessageCircle size={17}/></a>:<Link className="v11-person-action" href="/leads"><ArrowUpRight size={16}/></Link>}
          </div>;
        }):<div className="v11-blank"><ContactRound size={22}/><strong>Sem leads cadastrados</strong><p>Os novos atendimentos aparecerão aqui.</p></div>}</div>
      </section>
    </div>
    <div className="v11-analytics-grid">
      <section className="v11-analytics" aria-label="Evolução de leads">
        <Heading eyebrow="03 / DESEMPENHO" title="Evolução dos leads" description={'Entradas registradas em '+period+' dias'} action={<div className="v11-date-pills" role="group" aria-label="Período de análise">{[7,30,90].map(day=><button type="button" key={day} aria-pressed={period===day} className={period===day?'active':''} onClick={()=>setPeriod(day)}>{day}d</button>)}</div>}/>
        {recentLeads.length?<Trend rows={trend} days={period}/>:<div className="v11-chart-empty"><span>Não há entradas neste período.</span><Link href="/leads">Consultar leads <ArrowRight size={15}/></Link></div>}
        <div className="v11-panel-footer"><span>{n(recentLeads.length)} leads no período</span><Link href="/reports">Relatórios <ArrowRight size={15}/></Link></div>
      </section>
      <section className="v11-stages">
        <Heading eyebrow="04 / FUNIL" title="Etapas do atendimento" description="Leads entre os registros carregados" action={<Link href="/leads" className="v11-small-action">Abrir quadro <ArrowUpRight size={16}/></Link>}/>
        {steps.length?<div className="v11-stage-list">{steps.map((s,i)=><div className="v11-stage" key={s.key}><div><span className="v11-stage-num">{String(i+1).padStart(2,'0')}</span><strong>{s.name}</strong><span>{s.count}</span></div><div className="v11-stage-track"><i style={{backgroundColor:s.color,width:Math.max(4,s.count/Math.max(1,leads.length)*100)+'%'}}/></div></div>)}</div>:<div className="v11-blank"><Target size={22}/><strong>Funil sem registros</strong><p>As etapas serão exibidas quando houver leads.</p></div>}
        <div className="v11-panel-footer"><span>{n(counts?.leads||0)} leads cadastrados na empresa</span></div>
      </section>
    </div>
    <section className="v11-activity">
      <Heading eyebrow="05 / HISTÓRICO" title="Últimas movimentações" description="Registros recentes da empresa" action={<Link href="/reports" className="v11-small-action">Relatórios <ArrowUpRight size={16}/></Link>}/>
      {activity.length?<div className="v11-activity-list">{activity.map(a=>{const Icon=a.icon;return <Link href={a.href} className="v11-activity-item" key={a.id}><span className="v11-activity-icon"><Icon size={17}/></span><span><small>{a.type}</small><strong>{a.title}</strong></span><time dateTime={a.date}>{dt(a.date)}</time><ArrowUpRight size={16}/></Link>})}</div>:<div className="v11-blank">Sem movimentações recentes.</div>}
    </section>
    <footer className="v11-disclaimer">{partial?'Alguns indicadores consideram apenas os registros recentes carregados (até 250 por módulo).':'Indicadores calculados a partir dos registros carregados da empresa.'} Consulte os relatórios para validar resultados consolidados.</footer>
  </div>;
}
