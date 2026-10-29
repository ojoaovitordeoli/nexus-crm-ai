'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {
  Activity,ArrowDownRight,ArrowRight,ArrowUpRight,BarChart3,Briefcase,
  CalendarDays,Check,CheckCheck,ChevronDown,ChevronRight,CircleCheck,
  Clock3,Columns3,ContactRound,Copy,ExternalLink,Filter,LayoutList,
  Layers3,ListTodo,MessageCircle,MoreHorizontal,MoveRight,Plus,
  Search,ShieldCheck,Signal,SlidersHorizontal,Sparkles,TrendingUp,
  UserRound,UsersRound,Wallet,X,Zap
} from 'lucide-react';
import {db} from '../lib/supabase';

const fmt=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(n)||0);
const date=v=>{
  if(!v)return '—';
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(v))){
    const [year,month,day]=String(v).split('-');
    return day+'/'+month+'/'+year;
  }
  return !isNaN(Date.parse(v))?new Date(v).toLocaleDateString('pt-BR'):'—';
};
const display=(c)=>[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'Contato sem nome';
const label=v=>String(v||'Sem etapa').replace(/[_-]/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase());
const letters=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('');
const wa=v=>{
  const phone=String(v||'').replace(/\D/g,'');
  if(phone.length<10||phone.length>13)return null;
  return 'https://wa.me/'+(phone.length<=11?'55'+phone:phone);
};
const keyword=(...items)=>items.map(s=>String(s||'')).join(' ').toLocaleLowerCase('pt-BR');
const statusColor=s=>{
  const v=String(s||'').toLowerCase();
  if(['won','completed','closed','sold','converted','fechado'].includes(v))return 'good';
  if(['lost','cancelled','perdido','cancelado'].includes(v))return 'bad';
  if(['new','novo','pending','aberto'].includes(v))return 'new';
  return 'neutral';
};
function Pill({value}){return <span className={'nxp-pill nxp-pill--'+statusColor(value)}><i/>{label(value)}</span>}
function Avatar({value,large=false}){return <span className={'nxp-avatar'+(large?' nxp-avatar--lg':'')}>{letters(value)}</span>}
function Empty({title,detail,icon:Icon=Layers3}){return <div className="nxp-empty"><span><Icon size={25}/></span><strong>{title}</strong><p>{detail}</p></div>}
function WhatsLink({phone,children,className='nxp-linkaction'}){
  const url=wa(phone);
  return url?<a href={url} target="_blank" rel="noopener noreferrer" className={className}><MessageCircle size={16}/>{children||'WhatsApp'}<ArrowUpRight size={14}/></a>:<span className="nxp-quiet">Sem número</span>;
}
function Drawer({data,type='lead',onClose,readonly,stages=[],onStageChange,pending}){
  const ref=useRef(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  const opened=Boolean(data);
  useEffect(()=>{
    if(!opened)return;
    const previous=document.activeElement;
    const root=ref.current;
    root?.focus();
    const keyDown=e=>{
      if(e.key==='Escape'){e.preventDefault();closeRef.current();return}
      if(e.key!=='Tab'||!root)return;
      const elements=[...root.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])')];
      if(!elements.length){e.preventDefault();return}
      const first=elements[0],last=elements[elements.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    };
    document.addEventListener('keydown',keyDown);
    return ()=>{document.removeEventListener('keydown',keyDown);previous?.focus?.()};
  },[opened]);
  if(!data)return null;
  const person=type==='lead'?data.contact:data;
  const who=display(person);
  return <div className="nxp-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <aside ref={ref} tabIndex={-1} className="nxp-drawer" role="dialog" aria-modal="true" aria-label={'Detalhes de '+who}>
      <div className="nxp-drawer-top"><span>VISÃO DO {type==='lead'?'LEAD':'CONTATO'}</span><button type="button" aria-label="Fechar detalhes" onClick={onClose}><X size={21}/></button></div>
      <div className="nxp-drawer-identity"><Avatar value={who} large/><div><h2>{who}</h2><p>{person?.whatsapp||'Telefone não informado'}</p></div></div>
      <div className="nxp-drawer-sep"/>
      <div className="nxp-drawer-block"><span className="nxp-kicker">AÇÃO RÁPIDA</span><WhatsLink phone={person?.whatsapp} className="nxp-button nxp-button--whatsapp">Abrir conversa</WhatsLink></div>
      {type==='lead'&&<>
        <div className="nxp-drawer-block"><span className="nxp-kicker">ETAPA DO FUNIL</span>
        <select className="nxp-select" disabled={readonly||pending||!stages?.length} value={data.pipeline_stage_id||''} onChange={e=>onStageChange(data,e.target.value)}>
          {!data.pipeline_stage_id&&<option value="">Sem etapa definida</option>}{stages.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        <small className="nxp-fieldhelp">{readonly?'Seu perfil é somente leitura.':!stages.length?'Nenhuma etapa de funil cadastrada.':'As alterações são salvas no Supabase.'}</small>
        </div>
        <div className="nxp-info-line"><span>Origem</span><strong>{data.source||'Não informada'}</strong></div>
        <div className="nxp-info-line"><span>Temperatura</span><strong>{label(data.temperature||'Não definida')}</strong></div>
      </>}
      <div className="nxp-info-line"><span>Data de cadastro</span><strong>{date(data.created_at)}</strong></div>
      <div className="nxp-drawer-sep"/>
      <div className="nxp-drawer-notice"><ShieldCheck size={18}/><p>Dados exclusivos da sua empresa. Histórico de mensagens, notas e etiquetas poderão ser adicionados quando a integração de atendimento estiver pronta.</p></div>
    </aside>
  </div>;
}
function PanelHeader({eyebrow,title,detail,right}){return <div className="nxp-page-head"><div><span className="nxp-kicker">{eyebrow}</span><h1>{title}</h1><p>{detail}</p></div>{right}</div>}
function Metric({label,value,icon:Icon,tone,footer}){
  const [shown,setShown]=useState(0);
  useEffect(()=>{
    if(typeof value!=='number')return;
    const noMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if(noMotion){setShown(value);return}
    const started=performance.now();let frame;
    const tick=now=>{
      const p=Math.min(1,(now-started)/800);
      setShown(Math.round(value*(1-Math.pow(1-p,3))));
      if(p<1)frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(frame);
  },[value]);
  return <article className={'nxp-metric nxp-metric--'+tone}><div className="nxp-metric-top"><span>{label}</span><span className="nxp-metric-icon"><Icon size={20}/></span></div><strong>{typeof value==='number'?fmt(shown):value}</strong><div className="nxp-metric-bottom"><span className="nxp-metric-pip"/>{footer}</div></article>;
}

export function PremiumDashboard({data,counts,loading,organizationName,firstName,openTasks=[],overdueTasks=[],lastSync,pipelineStages=[]}){
  const [period,setPeriod]=useState(30);
  const [hoverPoint,setHoverPoint]=useState(null);
  const {currentLeads,currentSales,currentAppointments,trend,stages}=useMemo(()=>{
    const now=new Date();const cut=now.getTime()-period*86400000;
    const cLeads=data.leads.filter(x=>new Date(x.created_at).getTime()>=cut);
    const cSales=data.sales.filter(x=>new Date(x.created_at).getTime()>=cut);
    const cAppts=data.appointments.filter(x=>new Date(x.created_at).getTime()>=cut);
    const trend=Array.from({length:7},(_,i)=>{
      const bucketMs=period*86400000/7;
      const start=now.getTime()-(7-i)*bucketMs;
      const finish=now.getTime()-(6-i)*bucketMs;
      const marker=new Date(finish);
      return {name:period===7?marker.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''):marker.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}),
        value:data.leads.filter(l=>{const t=new Date(l.created_at).getTime();return t>=start&&t<finish}).length};
    });
    const groups=new Map();
    cLeads.forEach(l=>{
      const currentStage=pipelineStages.find(s=>s.id===l.pipeline_stage_id);
      const k=currentStage?.name||(pipelineStages.length?'Sem etapa':l.status||'Sem etapa');
      groups.set(k,(groups.get(k)||0)+1);
    });
    return {currentLeads:cLeads,currentSales:cSales,currentAppointments:cAppts,trend,stages:[...groups.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)};
  },[data,period,pipelineStages]);
  const activity=useMemo(()=>{
    const events=[
      ...data.leads.map(x=>({id:'lead-'+x.id,kind:'lead',title:'Novo lead: '+display(x.contact),subtitle:x.source||'Entrada de oportunidade',at:x.created_at,href:'/leads'})),
      ...data.contacts.map(x=>({id:'contact-'+x.id,kind:'contact',title:'Contato: '+display(x),subtitle:x.whatsapp||'Contato cadastrado',at:x.created_at,href:'/contacts'})),
      ...data.tasks.map(x=>({id:'task-'+x.id,kind:'task',title:x.title,subtitle:'Tarefa registrada',at:x.created_at,href:'/tasks'})),
      ...data.appointments.map(x=>({id:'appointment-'+x.id,kind:'appointment',title:x.title||'Agendamento',subtitle:'Compromisso adicionado',at:x.created_at,href:'/agenda'})),
      ...data.sales.map(x=>({id:'sale-'+x.id,kind:'sale',title:'Venda registrada',subtitle:brl(Number(x.value)||0),at:x.created_at,href:'/reports'}))
    ].filter(x=>x.at&&Number.isFinite(new Date(x.at).getTime()));
    return events.sort((a,b)=>new Date(b.at)-new Date(a.at)).slice(0,7);
  },[data]);
  const recentIncome=currentSales.reduce((n,item)=>n+Number(item.value||0),0);
  const max=Math.max(1,...trend.map(d=>d.value));
  const chartPoints=trend.map((d,i)=>[16+i*(268/6),105-(d.value/max)*90]);
  const chartLine=chartPoints.map(([x,y],i)=>(i===0?'M':'L')+x+' '+y).join(' ');
  const chartArea=chartLine+' L 284 110 L 16 110 Z';
  const colors=['#5778f7','#39c6ad','#9981ed','#f1ba66','#8090ad'];
  let cursor=0;
  const segments=stages.map(([name,count],i)=>{
    const offset=cursor,percent=100*count/Math.max(currentLeads.length,1);
    cursor+=percent;
    return {name,count,color:colors[i],percent,offset};
  });
  const hour=new Date().getHours();
  const greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
  return <div className="nxp-premium">
    <section className="nxp-presentation">
      <div className="nxp-presentation-copy"><div className="nxp-overline"><span/> NEXUS / INTELLIGENCE WORKSPACE</div>
      <h1>{greeting}, <em>{firstName}.</em></h1><p>Uma visão clara do que está acontecendo na sua operação. Transforme dados em decisões e oportunidades em resultados.</p>
      <div className="nxp-presentation-actions"><Link href="/leads" className="nxp-white-button">Explorar meu funil <ArrowUpRight size={17}/></Link><span className="nxp-live-text"><Signal size={14}/> Dados do Supabase</span></div></div>
      <div className="nxp-orbits" aria-hidden="true"><span className="nxp-orbit nxp-orbit--one"/><span className="nxp-orbit nxp-orbit--two"/><span className="nxp-orbit nxp-orbit--three"/><span className="nxp-orbit-logo"><Layers3 size={51} strokeWidth={1.45}/></span><span className="nxp-orbit-glow"/></div>
      <div className="nxp-presentation-foot"><span><Briefcase size={14}/>{organizationName}</span><span><Clock3 size={14}/>{lastSync?'Atualizado às '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Preparando indicadores'}</span></div>
    </section>
    <div className="nxp-section-title"><div><span className="nxp-kicker">PERFORMANCE</span><h2>Visão da operação</h2><p>Indicadores dos registros disponíveis para a empresa.</p></div><div className="nxp-switch">{[7,30,90].map(d=><button type="button" className={d===period?'active':''} onClick={()=>setPeriod(d)} key={d}>{d} dias</button>)}</div></div>
    <div className="nxp-metrics">
      <Metric tone="blue" icon={UsersRound} label="Leads no período" value={loading?'—':currentLeads.length} footer="Até 250 registros recentes"/>
      <Metric tone="green" icon={Wallet} label="Vendas registradas" value={loading?'—':currentSales.length} footer={brl(recentIncome)+' em vendas do período'}/>
      <Metric tone="violet" icon={CalendarDays} label="Agendamentos" value={loading?'—':currentAppointments.length} footer="Criados no período"/>
      <Metric tone="orange" icon={ListTodo} label="Tarefas abertas" value={loading?'—':openTasks.length} footer={overdueTasks.length+' com prazo vencido'}/>
    </div>
    <div className="nxp-analytics-grid">
      <section className="nxp-surface nxp-graph-panel"><div className="nxp-panel-head"><div><span className="nxp-kicker">AQUISIÇÃO</span><h3>Movimento de leads</h3><p>Distribuição nos últimos {period} dias</p></div><div className="nxp-circle-icon"><Activity size={21}/></div></div>
      <div key={"trend-"+period} className="nxp-graph-line">
        <svg className="nxp-graph-svg" viewBox="0 0 300 125" role="img" aria-label="Gráfico de leads por dia nos últimos sete dias">
          <defs><linearGradient id="nxp-area-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#5c83f8" stopOpacity=".32"/><stop offset="100%" stopColor="#5c83f8" stopOpacity=".025"/></linearGradient></defs>
          {[20,48,76,104].map(y=><line key={y} x1="14" y1={y} x2="287" y2={y} className="nxp-graph-line-grid"/>)}
          <path d={chartArea} className="nxp-graph-line-area"/>
          <path d={chartLine} className="nxp-graph-line-path" pathLength="100"/>
          {chartPoints.map(([x,y],i)=><circle key={i} cx={x} cy={y} r="3.8" className="nxp-graph-line-dot"
            onMouseEnter={()=>setHoverPoint(i)} onMouseLeave={()=>setHoverPoint(null)}
            ><title>{trend[i].name}: {trend[i].value} leads</title></circle>)}
        </svg>
        <div className="nxp-graph-line-labels">{trend.map((d,i)=><span key={i}>{d.name}</span>)}</div>
        {hoverPoint!==null&&<div className="nxp-chart-tooltip">{trend[hoverPoint].name}: {trend[hoverPoint].value} leads</div>}
      </div>
      <div className="nxp-panel-bottom"><span><i className="nxp-legend"/> Leads cadastrados</span><Link href="/leads">Ver oportunidades <ArrowRight size={15}/></Link></div>
      </section>
      <section className="nxp-surface nxp-funnel-panel"><div className="nxp-panel-head"><div><span className="nxp-kicker">DISTRIBUIÇÃO</span><h3>Seu funil</h3><p>Etapas utilizadas pelos leads</p></div><div className="nxp-circle-icon"><BarChart3 size={21}/></div></div>
      <div className="nxp-donut-layout">
        <div key={"donut-"+period} className="nxp-donut nxp-donut--svg">
          <svg viewBox="0 0 160 160" className="nxp-donut-svg" role="img" aria-label="Distribuição de leads por etapa">
            <circle cx="80" cy="80" r="63" pathLength="100" className="nxp-donut-base"/>
            {segments.map((segment,i)=><circle key={segment.name} cx="80" cy="80" r="63" pathLength="100"
              className="nxp-donut-segment" stroke={segment.color} strokeDashoffset={-segment.offset}
              style={{'--segment-dash':segment.percent+' 100',animationDelay:(i*130+570)+'ms'}}>
              <title>{label(segment.name)}: {segment.count} leads</title>
            </circle>)}
          </svg>
          <span className="nxp-donut-inner"><strong>{fmt(currentLeads.length)}</strong><small>leads</small></span>
        </div>
        <div className="nxp-donut-legend">{stages.map(([name,count],i)=><div key={name} title={label(name)+' — '+count+' leads'}>
          <span><i style={{background:colors[i]}}/>{label(name)}</span><strong>{fmt(count)}</strong>
        </div>)}{!stages.length&&<div className="nxp-quiet">Sem dados de distribuição.</div>}</div>
      </div>
      <div className="nxp-panel-bottom"><span>{fmt(currentLeads.length)} no período · {fmt(counts.leads)} no banco</span><Link href="/leads">Abrir funil <ArrowRight size={15}/></Link></div></section>
    </div>
    <div className="nxp-analytics-grid nxp-analytics-grid--bottom">
      <section className="nxp-surface"><div className="nxp-panel-head"><div><span className="nxp-kicker">PRIORIDADES</span><h3>Próximas tarefas</h3><p>O que ainda precisa ser feito</p></div><Link href="/tasks" className="nxp-icon-link">Ver todas <ArrowRight size={15}/></Link></div>
      <div className="nxp-compact-list">{openTasks.slice(0,5).map(t=><div key={t.id} className="nxp-task-item"><span className="nxp-task-square"/><div><strong>{t.title}</strong><small>{t.due_date?'Prazo: '+date(t.due_date):'Sem data de vencimento'}</small></div><Pill value={t.priority||t.status}/></div>)}{!openTasks.length&&<Empty icon={CircleCheck} title="Tudo em dia" detail="Você não tem tarefas em aberto agora."/>}</div></section>
      <section className="nxp-surface nxp-quick-panel"><div className="nxp-panel-head"><div><span className="nxp-kicker">CENTRAL DE TRABALHO</span><h3>Continue seu fluxo</h3><p>Acessos que simplificam a rotina</p></div><span className="nxp-circle-icon"><Zap size={20}/></span></div>
      {[['/leads',UsersRound,'Oportunidades','Consultar leads e etapas'],['/contacts',ContactRound,'Base de contatos','Pessoas e WhatsApp'],['/whatsapp',MessageCircle,'WhatsApp','Ver opções de conexão']].map(([href,Icon,title,desc])=><Link href={href} key={href} className="nxp-quick-link"><span><Icon size={20}/></span><div><strong>{title}</strong><small>{desc}</small></div><ArrowUpRight size={16}/></Link>)}</section>
    </div>
    <section className="nxp-surface nxp-timeline-panel">
      <div className="nxp-panel-head"><div><span className="nxp-kicker">ATIVIDADE / TEMPO REAL DOS REGISTROS</span><h3>Movimentações recentes</h3><p>Histórico das últimas ações registradas na empresa</p></div><div className="nxp-circle-icon"><Activity size={20}/></div></div>
      <div className="nxp-timeline">
        {activity.map((item,i)=>{
          const Icon=item.kind==='lead'?UsersRound:item.kind==='contact'?ContactRound:item.kind==='task'?ListTodo:item.kind==='appointment'?CalendarDays:Wallet;
          return <Link href={item.href} key={item.id} className={'nxp-timeline-row nxp-timeline-row--'+item.kind} style={{'--entry-delay':(i*65+150)+'ms'}}>
            <span className="nxp-timeline-marker"><Icon size={16}/></span>
            <span className="nxp-timeline-copy"><strong>{item.title}</strong><small>{item.subtitle}</small></span>
            <time dateTime={item.at}>{new Date(item.at).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'})}</time><ArrowUpRight size={16}/>
          </Link>;
        })}
        {!activity.length&&<Empty icon={Activity} title="A atividade começa com seus dados" detail="Quando leads, tarefas ou agendamentos forem registrados, cada movimentação aparecerá aqui."/>}
      </div>
      <div className="nxp-panel-bottom"><span><i className="nxp-legend"/> Dados reais da empresa</span><Link href="/reports">Abrir relatórios <ArrowRight size={15}/></Link></div>
    </section>
    <p className="nxp-data-disclaimer">Indicadores de período calculados sobre os últimos 250 registros carregados por módulo; o total de leads é consultado separadamente no banco.</p>
  </div>;
}

export function PremiumLeads({leads=[],count=0,organizationId,readonly=false,stages=[],onOperation,onReload}){
  const [mode,setMode]=useState('board');
  const [query,setQuery]=useState('');
  useEffect(()=>{
    const q=new URLSearchParams(window.location.search).get('q');
    if(q)setQuery(q);
  },[]);
  const [filter,setFilter]=useState('all');
  const [selected,setSelected]=useState(null);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [dragging,setDragging]=useState('');
  const hasStages=stages.length>0;
  const fallback=useMemo(()=>[...new Set(leads.map(l=>l.status).filter(Boolean))],[leads]);
  const cols=hasStages?stages.map(x=>({id:x.id,name:x.name})):fallback.map(x=>({id:x,name:label(x)}));
  const stageLabel=l=>hasStages?(stages.find(s=>s.id===l.pipeline_stage_id)?.name||'Sem etapa'):label(l.status);
  const filtered=leads.filter(l=>
    (filter==='all'||(hasStages?l.pipeline_stage_id===filter:l.status===filter))&&
    keyword(display(l.contact),l.source,l.contact?.whatsapp,stageLabel(l)).includes(query.toLocaleLowerCase('pt-BR')));
  const groups=cols.map(c=>({key:c.id,title:c.name,rows:filtered.filter(l=>(hasStages?l.pipeline_stage_id:l.status)===c.id)}));
  async function changeStage(item,next){
    if(!next||readonly||busy||!hasStages||item.pipeline_stage_id===next)return;
    setBusy(item.id);setError('');
    try{
      await onOperation({action:'lead_stage',id:item.id,stage_id:next});
      setSelected(v=>v?.id===item.id?{...v,pipeline_stage_id:next}:v);
      await onReload?.();
    }catch(e){setError('Não foi possível mover o lead: '+e.message)}
    finally{setBusy('')}
  }
  const Card=({item})=><div className="nxp-lead-card" draggable={!readonly&&hasStages&&stages.length>1} onDragStart={e=>{setDragging(item.id);e.dataTransfer.setData('text/plain',item.id)}} onDragEnd={()=>setDragging('')}>
    <button type="button" className="nxp-lead-card-main" onClick={()=>setSelected(item)} aria-label={'Abrir lead '+display(item.contact)}>
      <div className="nxp-lead-card-top"><Avatar value={display(item.contact)}/><span className="nxp-lead-date">{date(item.created_at)}</span></div>
      <strong>{display(item.contact)}</strong><small>{item.contact?.whatsapp||'Telefone não informado'}</small>
      <div className="nxp-lead-card-foot"><span>{item.source||'Origem não informada'}</span><ChevronRight size={16}/></div>
    </button>
    {wa(item.contact?.whatsapp)&&<WhatsLink phone={item.contact.whatsapp} className="nxp-lead-wa">Conversar</WhatsLink>}
  </div>;
  return <div className="nxp-premium">
    <PanelHeader eyebrow="CRM / PIPELINE" title="Oportunidades" detail="Organize suas conversas, acompanhe cada etapa e encontre o próximo negócio." right={<span className="nxp-total"><span/>{fmt(count)} leads cadastrados</span>}/>
    <div className="nxp-leads-summary"><div><span className="nxp-kicker">VISÃO DO FUNIL</span><strong>{fmt(count)}</strong><small>leads na empresa</small></div><div><span className="nxp-kicker">ETAPAS EM USO</span><strong>{cols.length}</strong><small>etapas encontradas</small></div><div><span className="nxp-kicker">COM WHATSAPP</span><strong>{filtered.filter(x=>wa(x.contact?.whatsapp)).length}</strong><small>entre os registros exibidos</small></div><div className="nxp-leads-summary-decoration"><Layers3 size={82} strokeWidth={1}/></div></div>
    <section className="nxp-surface nxp-leads-workarea">
      <div className="nxp-filterbar"><label className="nxp-search"><Search size={18}/><input placeholder="Pesquisar por nome, telefone ou origem..." value={query} onChange={e=>setQuery(e.target.value)} aria-label="Pesquisar leads"/></label>
      <div className="nxp-filter-actions"><label className="nxp-filter-select"><Filter size={16}/><select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filtrar etapa"><option value="all">Todas as etapas</option>{cols.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
      <div className="nxp-mode-switch"><button type="button" className={mode==='board'?'active':''} onClick={()=>setMode('board')} title="Quadro Kanban" aria-label="Quadro Kanban"><Columns3 size={18}/></button><button type="button" className={mode==='list'?'active':''} onClick={()=>setMode('list')} title="Lista" aria-label="Lista"><LayoutList size={18}/></button></div></div></div>
      {error&&<div className="nxp-error" role="alert">{error}</div>}
      {mode==='board'?<div className="nxp-board" aria-label="Funil Kanban">
      {groups.map(({key,title,rows},idx)=><section key={key} className="nxp-board-column"
        onDragOver={e=>{if(!readonly&&hasStages&&stages.length>1)e.preventDefault()}}
        onDrop={e=>{e.preventDefault();const lead=leads.find(l=>l.id===(e.dataTransfer.getData('text/plain')||dragging));if(lead)changeStage(lead,key);setDragging('')}}>
        <div className="nxp-column-title"><span className={'nxp-column-dot nxp-column-dot--'+(idx%5)}/><strong>{title}</strong><span>{rows.length}</span></div>
        <div className="nxp-column-cards">{rows.map(item=><Card key={item.id} item={item}/>)}
          {!rows.length&&<div className="nxp-column-empty">{dragging?'Solte aqui para mover':'Sem leads nesta etapa'}</div>}</div>
      </section>)}
      {!cols.length&&<Empty icon={UsersRound} title="Seu funil começa aqui" detail="Quando sua empresa receber leads, as etapas aparecerão automaticamente."/>}
      </div>:<div className="nxp-list-scroll"><table className="nxp-table"><thead><tr><th>Contato</th><th>Etapa</th><th>Origem</th><th>Cadastro</th><th>Atendimento</th></tr></thead><tbody>{filtered.map(l=><tr key={l.id}><td><button type="button" onClick={()=>setSelected(l)} className="nxp-person-btn"><Avatar value={display(l.contact)}/><div><strong>{display(l.contact)}</strong><small>{l.contact?.whatsapp||'Sem telefone'}</small></div></button></td><td><Pill value={stageLabel(l)}/></td><td>{l.source||'—'}</td><td>{date(l.created_at)}</td><td><WhatsLink phone={l.contact?.whatsapp}>Conversar</WhatsLink></td></tr>)}</tbody></table>{!filtered.length&&<Empty icon={UsersRound} title="Nenhum lead encontrado" detail="Tente modificar a busca ou o filtro de etapa."/>}</div>}
      <div className="nxp-footnote">{filtered.length} leads exibidos · Até 250 registros recentes · {readonly?'Acesso somente leitura':hasStages?'Arraste os cards entre etapas ou altere a etapa nos detalhes':'Cadastre as etapas do funil para habilitar movimentações'}</div>
    </section>
    <Drawer data={selected} onClose={()=>setSelected(null)} readonly={readonly} stages={stages} onStageChange={changeStage} pending={Boolean(busy)}/>
  </div>;
}

export function PremiumContacts({contacts=[],count=0,readonly=false,onOperation,onReload}){
  const [query,setQuery]=useState('');
  useEffect(()=>{
    const q=new URLSearchParams(window.location.search).get('q');
    if(q)setQuery(q);
  },[]);
  const [showCreate,setShowCreate]=useState(false);
  const [newName,setNewName]=useState('');
  const [newPhone,setNewPhone]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  async function createContact(e){
    e.preventDefault();
    if(readonly||saving||newName.trim().length<2)return;
    setSaving(true);setError('');setSuccess('');
    try{
      const res=await onOperation({action:'contact_create',first_name:newName.trim(),whatsapp:newPhone.trim()});
      setNewName('');setNewPhone('');setShowCreate(false);
      await onReload?.();
      setSuccess(res.message||'Contato cadastrado.');
    }catch(e){setError('Não foi possível cadastrar o contato: '+e.message)}
    finally{setSaving(false)}
  }
  const [layout,setLayout]=useState('grid');
  const [selected,setSelected]=useState(null);
  const list=contacts.filter(c=>keyword(display(c),c.whatsapp).includes(query.toLocaleLowerCase('pt-BR')));
  const withPhone=contacts.filter(c=>wa(c.whatsapp)).length;
  return <div className="nxp-premium">
    <PanelHeader eyebrow="CRM / RELACIONAMENTO" title="Seus contatos" detail="Pessoas em um só lugar, prontas para uma conversa e um relacionamento melhor." right={<div className="nxp-contact-toolbar"><span className="nxp-total"><span/>{fmt(count)} na sua base</span>{!readonly&&<button className="nxp-button nxp-button--primary" type="button" onClick={()=>setShowCreate(v=>!v)}><Plus size={16}/>{showCreate?'Fechar':'Novo contato'}</button>}</div>}/>

    {error&&<div className="nxp-error" role="alert">{error}</div>}
    {success&&<div className="nxp-success" role="status"><CircleCheck size={16}/>{success}</div>}
    {showCreate&&<form className="nxp-create-contact" onSubmit={createContact}>
      <label>Nome<input type="text" placeholder="Nome do contato" minLength={2} maxLength={130} required value={newName} onChange={e=>setNewName(e.target.value)}/></label>
      <label>WhatsApp com DDD<input type="tel" placeholder="(48) 99999-9999" value={newPhone} onChange={e=>setNewPhone(e.target.value)}/></label>
      <button type="submit" className="nxp-button nxp-button--primary" disabled={saving||newName.trim().length<2}>{saving?'Salvando...':'Salvar contato'}</button>
    </form>}
    <div className="nxp-contact-banner"><div><div className="nxp-overline"><span/> BASE DE RELACIONAMENTO</div><h2>Conexões que geram oportunidades.</h2><p>Encontre seus contatos e continue o atendimento no WhatsApp com um clique.</p></div><div className="nxp-contact-banner-metric"><UsersRound size={22}/><strong>{fmt(withPhone)}</strong><span>com WhatsApp, na amostra</span></div></div>
    <section className="nxp-surface nxp-leads-workarea">
      <div className="nxp-filterbar"><label className="nxp-search"><Search size={18}/><input placeholder="Buscar nome ou número de WhatsApp..." aria-label="Pesquisar contatos" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="nxp-mode-switch"><button type="button" className={layout==='grid'?'active':''} title="Cards" aria-label="Cards" onClick={()=>setLayout('grid')}><Columns3 size={18}/></button><button type="button" className={layout==='list'?'active':''} title="Lista" aria-label="Lista" onClick={()=>setLayout('list')}><LayoutList size={18}/></button></div></div>
      {layout==='grid'?<div className="nxp-contact-grid">{list.map(c=><article className="nxp-contact-card" key={c.id}>
        <button type="button" className="nxp-contact-card-person" onClick={()=>setSelected(c)}><Avatar value={display(c)} large/><h3>{display(c)}</h3><p>{c.whatsapp||'Telefone não informado'}</p></button>
        <div className="nxp-contact-card-line"><Clock3 size={14}/> Desde {date(c.created_at)}</div>
        <div className="nxp-contact-card-actions"><button type="button" onClick={()=>setSelected(c)}><UserRound size={15}/> Detalhes</button><WhatsLink phone={c.whatsapp}>Conversar</WhatsLink></div>
      </article>)}</div>:<div className="nxp-list-scroll"><table className="nxp-table"><thead><tr><th>Contato</th><th>WhatsApp</th><th>Cadastrado</th><th>Ações</th></tr></thead><tbody>{list.map(c=><tr key={c.id}><td><button type="button" className="nxp-person-btn" onClick={()=>setSelected(c)}><Avatar value={display(c)}/><strong>{display(c)}</strong></button></td><td>{c.whatsapp||'—'}</td><td>{date(c.created_at)}</td><td><WhatsLink phone={c.whatsapp}>Conversar</WhatsLink></td></tr>)}</tbody></table></div>}
      {!list.length&&<Empty icon={ContactRound} title="Nenhum contato encontrado" detail="Os contatos cadastrados na empresa aparecerão aqui."/>}<div className="nxp-footnote">{list.length} contatos exibidos · Até 250 registros recentes por empresa</div>
    </section>
    <Drawer type="contact" data={selected} onClose={()=>setSelected(null)}/>
  </div>;
}

export function PremiumWhatsApp({organizationName,contacts=[]}){
  const [expanded,setExpanded]=useState(false);
  const contactable=contacts.filter(c=>wa(c.whatsapp)).slice(0,5);
  return <div className="nxp-premium">
    <PanelHeader eyebrow="INTEGRAÇÕES / MENSAGENS" title="Central de WhatsApp" detail="Um espaço para centralizar atendimento e conectar suas conversas à operação." right={<span className="nxp-integration-pill"><span/> Integração pendente</span>}/>
    <div className="nxp-wa-shell">
      <div className="nxp-wa-hero"><span className="nxp-wa-hero-icon"><MessageCircle size={34}/></span><span className="nxp-kicker">ATENDIMENTO / CANAL</span><h2>Seu WhatsApp, conectado à sua operação.</h2><p>O NEXUS já permite abrir conversas de contatos cadastrados. Para receber e responder mensagens dentro do CRM, ainda precisamos configurar a integração oficial WhatsApp Business Platform e um webhook seguro por empresa.</p>
      <div className="nxp-wa-actions"><button type="button" onClick={()=>setExpanded(v=>!v)} className="nxp-button nxp-button--primary">{expanded?'Ocultar requisitos':'Ver como conectar'} <ArrowRight size={16}/></button><a href="https://developers.facebook.com/docs/whatsapp/cloud-api/" target="_blank" rel="noopener noreferrer" className="nxp-button nxp-button--ghost">Documentação oficial <ExternalLink size={15}/></a></div></div>
      <div className="nxp-wa-display" aria-hidden="true"><div className="nxp-wa-device"><div className="nxp-wa-device-top"><MessageCircle size={17}/> NEXUS INBOX <span>•••</span></div><div className="nxp-wa-placeholder"><span/><span/><span/></div><div className="nxp-wa-placeholder nxp-wa-placeholder--right"><span/><span/></div><div className="nxp-wa-device-bottom"><MessageCircle size={20}/> Conexão ainda não ativada</div></div></div>
    </div>
    {expanded&&<section className="nxp-surface nxp-integration-guide"><span className="nxp-kicker">CONEXÃO SEGURA</span><h3>O que falta para ativar a caixa de entrada</h3><div className="nxp-integration-steps">{[['01','Conta e número WhatsApp Business','Uma conta de negócios e um número elegível na Meta.'],['02','Credenciais protegidas por empresa','Identificadores, token seguro e permissões armazenados somente no servidor.'],['03','Webhook + isolamento dos dados','Receber mensagens, associar contatos e aplicar permissões da empresa.'],['04','Caixa de entrada e automações','Listar conversas reais, responder mensagens e integrar os fluxos do N8N.']].map(([n,title,desc])=><div key={n}><span>{n}</span><div><strong>{title}</strong><p>{desc}</p></div></div>)}</div><p className="nxp-security-tip"><ShieldCheck size={18}/> Não informe tokens, senhas ou chaves secretas no chat ou no GitHub. A conexão será configurada por um fluxo seguro quando a API estiver implementada.</p></section>}
    <section className="nxp-surface nxp-available-contacts"><div className="nxp-panel-head"><div><span className="nxp-kicker">ENQUANTO ISSO</span><h3>Acessar contatos no WhatsApp</h3><p>Abrir conversas externas; mensagens ainda não são sincronizadas com o CRM.</p></div><Link href="/contacts" className="nxp-icon-link">Ver contatos <ArrowRight size={15}/></Link></div>
    <div className="nxp-compact-list">{contactable.map(c=><div key={c.id} className="nxp-contactable"><Avatar value={display(c)}/><div><strong>{display(c)}</strong><small>{c.whatsapp}</small></div><WhatsLink phone={c.whatsapp}>Abrir WhatsApp</WhatsLink></div>)}{!contactable.length&&<Empty icon={ContactRound} title="Sem contatos com telefone" detail="Cadastre ou importe contatos para começar a conversar."/>}</div></section>
  </div>;
}
