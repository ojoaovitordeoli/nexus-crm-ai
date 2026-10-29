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
