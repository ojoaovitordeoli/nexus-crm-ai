'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {Activity,ArrowRight,ArrowUpRight,CalendarDays,CheckCircle2,Clock3,ContactRound,ListTodo,MessageCircle,Plus,Radio,Signal,UsersRound,Wallet} from 'lucide-react';
const fmt=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
const cash=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(n)||0);
const who=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'Contato';
const date=v=>v?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'—';
const ts=v=>{const n=new Date(v).getTime();return Number.isFinite(n)?n:0};
export default function NexusCommandDeck({data={},counts={},loading=false,organizationName,firstName,openTasks=[],overdueTasks=[],lastSync,pipelineStages=[]}){
 const [period,setPeriod]=useState(30);
 const [view,setView]=useState('chart');
 const {leads,sales,appointments,activity,stages,trend,revenue}=useMemo(()=>{
  const now=Date.now(),begin=now-period*86400000;
  const rows=key=>Array.isArray(data[key])?data[key]:[];
  const allLeads=rows('leads'),allSales=rows('sales'),allAppts=rows('appointments');
  const leads=allLeads.filter(x=>ts(x.created_at)>=begin);
  const sales=allSales.filter(x=>ts(x.created_at)>=begin);
  const appointments=allAppts.filter(x=>ts(x.created_at)>=begin);
  const revenue=sales.reduce((v,x)=>v+(Number(x.value)||0),0);
  const trend=Array.from({length:8},(_,i)=>{
    const lo=begin+i*period*86400000/8,hi=begin+(i+1)*period*86400000/8;
    return {label:new Date(hi-1000).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}),
      value:allLeads.filter(x=>ts(x.created_at)>=lo&&ts(x.created_at)<hi).length};
  });
  const byStage=new Map();
  leads.forEach(l=>{
    const name=pipelineStages.find(s=>s.id===l.pipeline_stage_id)?.name||l.status||'Sem etapa';
    byStage.set(name,(byStage.get(name)||0)+1);
  });
  const stages=[...byStage.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
  const activity=[
    ...allLeads.map(x=>({id:'l'+x.id,title:'Lead · '+who(x.contact),desc:x.source||'Nova oportunidade',at:x.created_at,url:'/leads',icon:UsersRound})),
    ...rows('contacts').map(x=>({id:'c'+x.id,title:'Contato · '+who(x),desc:'Base de relacionamento',at:x.created_at,url:'/contacts',icon:ContactRound})),
    ...rows('tasks').map(x=>({id:'t'+x.id,title:x.title||'Tarefa',desc:'Tarefa cadastrada',at:x.created_at,url:'/tasks',icon:ListTodo})),
    ...allAppts.map(x=>({id:'a'+x.id,title:x.title||'Agendamento',desc:'Agenda interna',at:x.created_at,url:'/agenda',icon:CalendarDays})),
    ...allSales.map(x=>({id:'s'+x.id,title:'Venda registrada',desc:cash(x.value),at:x.created_at,url:'/reports',icon:Wallet}))
  ].filter(x=>ts(x.at)).sort((a,b)=>ts(b.at)-ts(a.at)).slice(0,5);
  return {leads,sales,appointments,activity,stages,trend,revenue};
 },[data,period,pipelineStages]);
 const peak=Math.max(1,...trend.map(d=>d.value));
 const points=trend.map((d,i)=>({x:18+i*79,y:195-(d.value/peak)*145,...d}));
 const line=points.map((d,i)=>(i?'L':'M')+d.x+' '+d.y).join(' ');
 const stagePeak=Math.max(1,...stages.map(s=>s[1]));
 return <div className="deck-root">
  <section className="deck-scene">
   <div className="deck-scene-grid" aria-hidden="true"/><div className="deck-scene-sun" aria-hidden="true"/>
   <header className="deck-scene-top"><span>N / OPERATIONS INTELLIGENCE</span><span className="deck-scene-live"><i/>{lastSync?'Atualizado '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Workspace ativo'}</span></header>
   <div className="deck-scene-copy"><span className="deck-kicker">BEM-VINDO AO SEU CENTRO DE CONTROLE</span><h1>O negócio acontece <em>aqui.</em></h1><p>O movimento da sua operação, as oportunidades e as próximas decisões — reunidos em um só espaço.</p>
     <div className="deck-scene-actions"><Link href="/leads" className="deck-cta">Explorar oportunidades <ArrowUpRight size={17}/></Link><Link href="/tasks?new=1" className="deck-cta-outline"><Plus size={16}/> Nova tarefa</Link></div>
   </div>
   <aside className="deck-scene-insight"><span>CONTRASTE / DADOS REAIS</span><strong>{fmt(counts.leads)}<small>leads</small></strong><div><span>Empresa</span><b>{organizationName||'Minha operação'}</b></div><div><span>Na sua lista</span><b>{fmt(openTasks.length)} tarefa(s)</b></div></aside>
   <div className="deck-scene-bottom"><span>WORKSPACE / {firstName||'OPERAÇÃO'}</span><span><Radio size={13}/> CONTROLE EM TEMPO REAL DOS REGISTROS</span></div>
  </section>

  <section className="deck-performance">
   <div className="deck-heading"><div><span>02 / INDICADORES</span><h2>O pulso da operação<span>.</span></h2></div><div className="deck-period" role="group" aria-label="Selecionar período">{[7,30,90].map(n=><button type="button" key={n} className={period===n?'active':''} onClick={()=>setPeriod(n)} aria-pressed={period===n}>{n} dias</button>)}</div></div>
   <div className="deck-kpis">
    {[
      {name:'Oportunidades',value:leads.length,detail:'Novos leads do período',icon:UsersRound,url:'/leads',n:'01'},
      {name:'Vendas',value:sales.length,detail:cash(revenue)+' registrados',icon:Wallet,url:'/reports',n:'02'},
      {name:'Tarefas abertas',value:openTasks.length,detail:overdueTasks.length+' com prazo vencido',icon:ListTodo,url:'/tasks',n:'03'},
      {name:'Agenda',value:appointments.length,detail:'Novos agendamentos do período',icon:CalendarDays,url:'/agenda',n:'04'}
    ].map(({name,value,detail,icon:Icon,url,n},i)=><Link key={n} href={url} className={'deck-kpi deck-kpi--'+i}>
      <span className="deck-kpi-title">{n} / {name}<ArrowUpRight size={18}/></span>
      <strong>{loading?'—':fmt(value)}</strong><small>{detail}</small>
      <span className="deck-kpi-foot"><Icon size={15}/> Abrir módulo <ArrowRight size={14}/></span>
    </Link>)}
   </div>
  </section>
  <section className="deck-analysis">
   <div className="deck-module deck-module--chart">
    <header className="deck-module-head"><div><span className="deck-kicker">03 / OBSERVATÓRIO</span><h2>Movimento <em>& direção.</em></h2><p>Entradas dos leads da empresa na amostra disponível.</p></div><Link href="/reports" aria-label="Abrir relatórios"><ArrowUpRight size={19}/></Link></header>
    <div className="deck-tabs" role="group" aria-label="Visualização do gráfico"><button type="button" className={view==='chart'?'active':''} onClick={()=>setView('chart')}>Volume</button><button type="button" className={view==='stages'?'active':''} onClick={()=>setView('stages')}>Etapas</button></div>
    {view==='chart'?<div className="deck-chart" key={period}>
      <span className="deck-chart-label"><Activity size={15}/> {fmt(leads.length)} entradas em {period} dias</span>
      <svg viewBox="0 0 620 230" role="img" aria-label={'Distribuição de leads: '+trend.map(x=>x.label+' '+x.value).join(', ')}>
       <defs><linearGradient id="deck-chart-fade" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#e3af71" stopOpacity=".3"/><stop offset="100%" stopColor="#e3af71" stopOpacity="0"/></linearGradient></defs>
       {[52,100,148,195].map(y=><line className="deck-gridline" key={y} x1="18" y1={y} x2="571" y2={y}/>)}
       <path className="deck-chart-area" d={line+' L 571 210 L 18 210 Z'} fill="url(#deck-chart-fade)"/>
       <path className="deck-chart-line" d={line} pathLength="100"/>
       {points.map((p,i)=><circle className="deck-chart-dot" key={i} cx={p.x} cy={p.y} r="4.3"><title>{p.label}: {p.value} lead(s)</title></circle>)}
      </svg>
      <div className="deck-chart-axis">{trend.map((d,i)=><span key={i}>{d.label}</span>)}</div>
    </div>:<div className="deck-stage-bars">{stages.length?stages.map(([label,value])=><div key={label}><span>{label}</span><i><b style={{width:(value/stagePeak*100)+'%'}}/></i><strong>{value}</strong></div>):<p>Sem movimentações por etapa neste período.</p>}</div>}
    <footer className="deck-module-foot"><span><Signal size={14}/> Dados carregados do Supabase</span><Link href="/leads">Abrir funil <ArrowRight size={15}/></Link></footer>
   </div>
   <aside className="deck-module deck-module--tasks">
    <header className="deck-module-head"><div><span className="deck-kicker">04 / EXECUÇÃO</span><h2>Próximos <em>passos.</em></h2><p>Atenção ao que precisa avançar.</p></div><Link href="/tasks"><ArrowUpRight size={19}/></Link></header>
    <div className="deck-tasklist">{openTasks.slice(0,5).map((t,i)=><Link href="/tasks" className="deck-task" key={t.id}><span>{String(i+1).padStart(2,'0')}</span><div><strong>{t.title||'Nova tarefa'}</strong><small>{t.due_date?'Até '+date(t.due_date):'Sem prazo definido'}</small></div><ArrowUpRight size={15}/></Link>)}{!openTasks.length&&<div className="deck-empty"><CheckCircle2 size={23}/><strong>Sem tarefas abertas.</strong><p>Novas tarefas aparecerão aqui.</p></div>}</div>
    <Link href="/tasks?new=1" className="deck-task-new"><Plus size={16}/> Criar tarefa <ArrowRight size={15}/></Link>
   </aside>
  </section>
