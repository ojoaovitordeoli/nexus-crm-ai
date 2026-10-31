'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {
  ArrowRight,ArrowUpRight,CalendarDays,CheckCircle2,Clock3,
  ContactRound,MessageCircle,ReceiptText,TrendingUp,UsersRound,
  Wallet,ListTodo,AlertCircle
} from 'lucide-react';

const formatNumber=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
const formatMoney=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(n)||0);
const formatDate=d=>d&&!Number.isNaN(new Date(d).getTime())?new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem data';
const person=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'Contato sem nome';
const validTime=value=>Number.isFinite(new Date(value).getTime());
const shortPhone=value=>{
  const digits=String(value||'').replace(/\D/g,'');
  if(digits.length<10||digits.length>13)return '';
  return 'https://wa.me/'+(digits.length<=11?'55'+digits:digits);
};
const shortText=(v,fallback='Não informado')=>{
  const text=String(v||fallback).replace(/[_-]/g,' ');
  return ({new:'Novo',pending:'Pendente',open:'Aberto',won:'Ganho',lost:'Perdido',completed:'Concluído'})[text.toLowerCase()]||text;
};
const isClosed=(lead,stages)=>{
  const found=stages.find(s=>s.id===lead.pipeline_stage_id);
  if(found)return Boolean(found.is_won||found.is_lost);
  return ['won','closed','sold','converted','fechado','lost','perdido','desqualificado'].includes(String(lead.status||'').toLowerCase());
};
function Panel({title,description,action,children,className=''}) {
  return <section className={'n9-panel '+className}>
    <header className="n9-panel-heading"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</header>
    {children}
  </section>;
}
function Kpi({icon:Icon,label,value,detail,tone='blue',href}) {
  return <Link href={href} className={'n9-kpi n9-kpi--'+tone}>
    <div className="n9-kpi-top"><span>{label}</span><span className="n9-kpi-icon"><Icon size={20} strokeWidth={1.9}/></span></div>
    <strong>{value}</strong>
    <span className="n9-kpi-bottom">{detail}<ArrowUpRight size={16}/></span>
  </Link>;
}

export default function NexusDashboard({data,counts,loading,organizationName,firstName,openTasks=[],overdueTasks=[],lastSync,pipelineStages=[]}) {
  const [period,setPeriod]=useState(30);
  const [activePoint,setActivePoint]=useState(null);
  const raw=data||{};
  const leads=raw.leads||[];
  const sales=raw.sales||[];
  const tasks=raw.tasks||[];
  const contacts=raw.contacts||[];
  const appointments=raw.appointments||[];
  const since=Date.now()-period*86400000;
  const inPeriod=rows=>rows.filter(item=>item.created_at&&validTime(item.created_at)&&new Date(item.created_at).getTime()>=since);
  const recentLeads=inPeriod(leads);
  const recentSales=inPeriod(sales);
  const revenue=recentSales.reduce((total,sale)=>total+Number(sale.value||0),0);
  const pending=Array.isArray(openTasks)?openTasks:tasks.filter(t=>!['completed','done','cancelled'].includes(String(t.status).toLowerCase()));
  const overdue=Array.isArray(overdueTasks)?overdueTasks:[];
  const recentAppointments=inPeriod(appointments);
  const latestLeads=[...leads].filter(x=>validTime(x.created_at)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  const priorityTasks=[...pending].sort((a,b)=>{
    const ta=a.due_date?new Date(a.due_date).getTime():Infinity;
    const tb=b.due_date?new Date(b.due_date).getTime():Infinity;
    return ta-tb;
  }).slice(0,4);
  const hasPartial=(counts?.leads||0)>leads.length||(counts?.sales||0)>sales.length;

  const trend=useMemo(()=>{
    const today=new Date();
    const start=new Date(today.getFullYear(),today.getMonth(),today.getDate());
    return Array.from({length:7},(_,index)=>{
      const from=start.getTime()-(6-index)*(period/7)*86400000;
      const to=start.getTime()-(5-index)*(period/7)*86400000;
      const value=leads.filter(x=>x.created_at&&validTime(x.created_at)&&new Date(x.created_at).getTime()>=from&&new Date(x.created_at).getTime()<to).length;
      const dateLabel=new Date(from).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
      return {name:dateLabel,value};
    });
  },[leads,period]);
  const stageRows=useMemo(()=>{
    const map=new Map();
    leads.forEach(l=>{
      const stage=pipelineStages.find(s=>s.id===l.pipeline_stage_id);
      const name=stage?.name||shortText(l.status,'Sem etapa');
      const key=stage?.id||name;
      if(!map.has(key))map.set(key,{name,count:0,color:stage?.color||'#94a3b8'});
      map.get(key).count+=1;
    });
    return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,5);
  },[leads,pipelineStages]);
  const activity=useMemo(()=>[
    ...leads.map(item=>({id:'lead'+item.id,type:'Novo lead',name:person(item.contact),date:item.created_at,href:'/leads',icon:UsersRound})),
    ...sales.map(item=>({id:'sale'+item.id,type:'Venda registrada',name:formatMoney(item.value),date:item.created_at,href:'/sales',icon:ReceiptText})),
    ...appointments.map(item=>({id:'appointment'+item.id,type:'Agendamento',name:item.title||'Sem título',date:item.created_at,href:'/agenda',icon:CalendarDays})),
    ...tasks.map(item=>({id:'task'+item.id,type:'Tarefa',name:item.title||'Sem título',date:item.created_at,href:'/tasks',icon:ListTodo})),
  ].filter(x=>x.date&&validTime(x.date)).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,5),[leads,sales,appointments,tasks]);

  const maximum=Math.max(1,...trend.map(d=>d.value));
  const coords=trend.map((d,i)=>[26+(i*84),210-d.value/maximum*170]);
  const path=coords.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' ');
  const area=path+' L 530 210 L 26 210 Z';
  const synced=lastSync?'Atualizado às '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Aguardando atualização';


  return <div className="n9-dashboard">
    <div className="n9-overview-top">
      <div className="n9-heading">
        <span className="n9-overline">Painel comercial <span aria-hidden="true">/</span> {organizationName}</span>
        <h1>Visão geral<span className="n9-heading-period">.</span></h1>
        <p>Leads, vendas e próximos atendimentos em um só lugar.</p>
      </div>
      <div className="n9-overview-actions">
        <span className="n9-sync"><span className="n9-sync-dot"/>{synced}</span>
        <Link href="/leads" className="n9-primary-button">Abrir funil <ArrowUpRight size={17}/></Link>
      </div>
    </div>

    {overdue.length>0&&<div className="n9-attention" role="status">
      <span className="n9-attention-icon"><AlertCircle size={19}/></span>
      <div><strong>{overdue.length} {overdue.length===1?'tarefa precisa':'tarefas precisam'} de atenção</strong><span>Há prazos vencidos. Revise os retornos para não perder oportunidades.</span></div>
      <Link href="/tasks">Ver tarefas <ArrowRight size={17}/></Link>
    </div>}

    <div className="n9-filterline">
      <div><strong>Desempenho</strong><span>Indicadores dos registros disponíveis</span></div>
      <div className="n9-period" role="group" aria-label="Período de análise">
        {[7,30,90].map(value=><button key={value} type="button" className={period===value?'is-active':''} aria-pressed={period===value} onClick={()=>{setPeriod(value);setActivePoint(null)}}>{value} dias</button>)}
      </div>
    </div>

    <div className="n9-metrics" aria-busy={loading}>
      <Kpi href="/leads" icon={UsersRound} tone="blue" label="Leads recebidos" value={loading?'—':formatNumber(recentLeads.length)} detail={'Nos últimos '+period+' dias'}/>
      <Kpi href="/sales" icon={ReceiptText} tone="green" label="Vendas registradas" value={loading?'—':formatNumber(recentSales.length)} detail={'Ticket médio '+formatMoney(recentSales.length?revenue/recentSales.length:0)}/>
      <Kpi href="/sales" icon={Wallet} tone="indigo" label="Receita registrada" value={loading?'—':formatMoney(revenue)} detail="Conforme as vendas carregadas"/>
      <Kpi href="/tasks" icon={ListTodo} tone={overdue.length?'orange':'blue'} label="Tarefas em aberto" value={loading?'—':formatNumber(pending.length)} detail={overdue.length?overdue.length+' com prazo vencido':'Nenhum prazo vencido'}/>
    </div>

    <div className="n9-main-grid">
      <Panel title="Entrada de leads" description={'Evolução dos registros nos últimos '+period+' dias'} className="n9-chart-panel" action={<Link className="n9-text-action" href="/leads">Ver leads <ArrowUpRight size={16}/></Link>}>
        <div className="n9-chart-total"><strong>{formatNumber(recentLeads.length)}</strong><span>leads recebidos</span></div>
        <div className="n9-chart-box">
          <svg viewBox="0 0 556 236" role="img" aria-label={'Tendência de leads nos últimos '+period+' dias'} preserveAspectRatio="xMidYMid meet">
            <defs><linearGradient id="n9-graph-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5164d9" stopOpacity=".23"/><stop offset="100%" stopColor="#5164d9" stopOpacity="0"/></linearGradient></defs>
            {[40,95,150,210].map(y=><line x1="26" x2="530" y1={y} y2={y} key={y} className="n9-chart-guide"/>)}
            {recentLeads.length>0&&<><path d={area} fill="url(#n9-graph-fill)"/><path d={path} className="n9-chart-path"/>{coords.map(([x,y],index)=><circle key={index} cx={x} cy={y} r={activePoint===index?6:4.5} tabIndex="0" className="n9-chart-dot" onMouseEnter={()=>setActivePoint(index)} onMouseLeave={()=>setActivePoint(null)} onFocus={()=>setActivePoint(index)} onBlur={()=>setActivePoint(null)}><title>{trend[index].name}: {trend[index].value} leads</title></circle>)}</>}
            {!recentLeads.length&&<text x="278" y="112" textAnchor="middle" className="n9-chart-empty">Nenhum lead neste período</text>}
          </svg>
          <div className="n9-chart-labels">{trend.map((d,i)=><span key={i}>{d.name}</span>)}</div>
          {activePoint!==null&&<span className="n9-chart-tooltip">{trend[activePoint].name}: {trend[activePoint].value} leads</span>}
        </div>
      </Panel>
      <Panel title="Etapas do funil" description="Distribuição dos registros carregados" className="n9-funnel-panel" action={<Link className="n9-text-action" href="/leads">Abrir funil <ArrowUpRight size={16}/></Link>}>
        {stageRows.length?<div className="n9-stages">{stageRows.map(s=><div className="n9-stage" key={s.name}><div className="n9-stage-top"><span><i style={{background:s.color}}/>{s.name}</span><strong>{formatNumber(s.count)}</strong></div><div className="n9-stage-track"><span style={{width:(100*s.count/Math.max(1,leads.length))+'%',background:s.color}}/></div></div>)}</div>:<div className="n9-empty-panel">As etapas aparecerão quando houver leads.</div>}
        <div className="n9-funnel-footer"><span>{formatNumber(counts?.leads||0)} leads cadastrados na empresa</span><span>{pipelineStages.length} etapas configuradas</span></div>
      </Panel>
    </div>

    <div className="n9-main-grid n9-main-grid--bottom">
      <Panel title="Próximas tarefas" description="Retornos e atividades para acompanhar" className="n9-task-panel" action={<Link className="n9-text-action" href="/tasks">Todas as tarefas <ArrowUpRight size={16}/></Link>}>
        {priorityTasks.length?<div className="n9-list">{priorityTasks.map(t=><Link key={t.id} href="/tasks" className="n9-list-row"><span className="n9-check"><Clock3 size={17}/></span><span className="n9-list-copy"><strong>{t.title}</strong><small>{t.due_date?'Prazo: '+formatDate(t.due_date):'Sem prazo definido'}</small></span><span className="n9-row-arrow"><ArrowUpRight size={16}/></span></Link>)}</div>:<div className="n9-empty-panel"><CheckCircle2 size={23}/><strong>Nenhuma tarefa pendente</strong><span>Seus próximos retornos aparecerão aqui.</span></div>}
      </Panel>
      <Panel title="Leads recentes" description="Quem entrou na operação por último" className="n9-leads-panel" action={<Link className="n9-text-action" href="/leads">Todos os leads <ArrowUpRight size={16}/></Link>}>
        {latestLeads.length?<div className="n9-list">{latestLeads.map(l=>{
          const name=person(l.contact),phone=shortPhone(l.contact?.whatsapp);
          const stage=pipelineStages.find(s=>s.id===l.pipeline_stage_id);
          return <div className="n9-list-row" key={l.id}><span className="n9-avatar">{name.split(/\s+/).slice(0,2).map(s=>s[0]||'').join('').toUpperCase()}</span><span className="n9-list-copy"><strong>{name}</strong><small>{stage?.name||shortText(l.status,'Sem etapa')} · {shortText(l.source,'Origem não informada')}</small></span>{phone?<a className="n9-lead-message" href={phone} target="_blank" rel="noopener noreferrer" aria-label={'Conversar com '+name+' no WhatsApp'}><MessageCircle size={18}/></a>:<Link className="n9-row-arrow" href="/leads" aria-label={'Ver lead '+name}><ArrowUpRight size={16}/></Link>}</div>;
        })}</div>:<div className="n9-empty-panel"><ContactRound size={23}/><strong>Sem leads por enquanto</strong><span>Os novos contatos aparecerão aqui.</span></div>}
      </Panel>
    </div>
    <Panel title="Movimentações recentes" description="Últimos registros da empresa" className="n9-activity-panel" action={<Link className="n9-text-action" href="/reports">Relatórios <ArrowUpRight size={16}/></Link>}>
      {activity.length?<div className="n9-activity-grid">{activity.map(item=>{const Icon=item.icon;return <Link href={item.href} key={item.id} className="n9-activity"><span className="n9-activity-icon"><Icon size={18}/></span><span><small>{item.type}</small><strong>{item.name}</strong></span><time dateTime={item.date}>{formatDate(item.date)}</time></Link>})}</div>:<div className="n9-empty-panel">As atividades recentes aparecerão aqui.</div>}
    </Panel>
    <p className="n9-data-note">{hasPartial?'Atenção: alguns indicadores consideram até 250 registros recentes por módulo; os totais históricos podem ser maiores.':'Os indicadores utilizam os registros carregados da empresa.'} Contagens e receitas definitivas devem ser conferidas nos relatórios.</p>
  </div>;
}
