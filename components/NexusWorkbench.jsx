'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {
  ArrowDownRight,ArrowRight,ArrowUpRight,CalendarDays,Check,ChevronRight,
  CircleAlert,Clock3,ExternalLink,MessageCircle,MoreHorizontal,UsersRound
} from 'lucide-react';

const number=n=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(n)||0);
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(n)||0);
const fullName=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim()||'Contato sem nome';
const validDate=v=>v&&Number.isFinite(new Date(v).getTime());
const shortDate=v=>validDate(v)?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}):'Sem data';
const friendlyStatus=v=>{
  const map={new:'Novo',open:'Aberto',pending:'Pendente',qualified:'Qualificado',contacted:'Contatado',won:'Ganho',lost:'Perdido',converted:'Convertido',completed:'Concluído'};
  return map[String(v||'').toLowerCase()]||String(v||'Sem etapa').replace(/_/g,' ');
};
const whatsapp=v=>{
  const digits=String(v||'').replace(/\D/g,'');
  if(digits.length<10||digits.length>13)return null;
  return 'https://wa.me/'+(digits.length<=11?'55'+digits:digits);
};
function SectionHead({title,description,href,label='Ver todos'}) {
  return <div className="w10-section-head">
    <div className="w10-section-name"><div><h2>{title}</h2>{description&&<p>{description}</p>}</div></div>
    {href&&<Link className="w10-textlink" href={href}>{label}<ArrowUpRight size={16}/></Link>}
  </div>;
}
function SparkChart({series,period}) {
  const max=Math.max(1,...series.map(x=>x.count));
  const coords=series.map((v,i)=>({x:44+i*117,y:216-(v.count/max)*174,count:v.count,label:v.label}));
  const line=coords.map((v,i)=>(i===0?'M ':'L ')+v.x+' '+v.y).join(' ');
  const area=line+' L '+coords[coords.length-1].x+' 216 L '+coords[0].x+' 216 Z';
  return <div className="w10-chart-wrap">
    <svg viewBox="0 0 790 255" role="img" aria-label={'Quantidade de leads recebidos nos últimos '+period+' dias, agrupados em sete intervalos'} preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="w10-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#93e3db" stopOpacity=".28"/><stop offset="100%" stopColor="#93e3db" stopOpacity="0"/></linearGradient></defs>
      {[42,100,158,216].map((y,i)=><g key={y}><line x1="44" x2="746" y1={y} y2={y} className="w10-gridline"/>{(max>=4||i===0||i===3)&&<text x="6" y={y+4} className="w10-gridlabel">{Math.round(max*(3-i)/3)}</text>}</g>)}
      <path d={area} className="w10-chart-area"/>
      <path d={line} className="w10-chart-line"/>
      {coords.map((p,i)=><g key={i}><circle cx={p.x} cy={p.y} r="5" className="w10-chart-point" tabIndex="0"><title>{p.label+': '+p.count+' leads'}</title></circle></g>)}
      {coords.map((p,i)=><text key={'t'+i} x={p.x} y="242" textAnchor="middle" className="w10-tick">{p.label}</text>)}
    </svg>
  </div>;
}
export default function NexusWorkbench({data,counts,loading,organizationName,openTasks=[],overdueTasks=[],lastSync,pipelineStages=[]}) {
  const [period,setPeriod]=useState(30);
  const items=data||{};
  const leads=items.leads||[];
  const sales=items.sales||[];
  const tasks=items.tasks||[];
  const appointments=items.appointments||[];
  const now=Date.now();
  const since=now-period*86400000;
  const range=rows=>rows.filter(x=>validDate(x.created_at)&&new Date(x.created_at).getTime()>=since);
  const rangeLeads=range(leads);
  const rangeSales=range(sales);
  const rangeAppointments=range(appointments);
  const revenue=rangeSales.reduce((n,v)=>n+Number(v.value||0),0);
  const activeTasks=Array.isArray(openTasks)?openTasks:tasks.filter(x=>!['completed','cancelled','done'].includes(String(x.status||'').toLowerCase()));
  const overdue=Array.isArray(overdueTasks)?overdueTasks:[];
  const hasPartial=(counts?.leads||0)>leads.length||(counts?.sales||0)>sales.length||(counts?.tasks||0)>tasks.length;
  const historyLabel=lastSync&&validDate(lastSync)?'Atualizado às '+new Date(lastSync).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Aguardando atualização';

  const series=useMemo(()=>{
    const end=Date.now(),start=end-period*86400000,step=period*86400000/7;
    return Array.from({length:7},(_,i)=>{
      const from=start+i*step,to=start+(i+1)*step;
      const date=new Date(from).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'});
      return {label:date,count:leads.filter(v=>validDate(v.created_at)&&new Date(v.created_at).getTime()>=from&&new Date(v.created_at).getTime()<to).length};
    });
  },[leads,period]);

  const stages=useMemo(()=>{
    const map=new Map(pipelineStages.map(s=>[s.id,{id:s.id,name:s.name,color:s.color||'#7daeb6',count:0}]));
    for(const lead of leads){
      const stage=map.get(lead.pipeline_stage_id);
      if(stage){stage.count++;continue}
      const key='fallback-'+String(lead.status||'Sem etapa');
      if(!map.has(key))map.set(key,{id:key,name:friendlyStatus(lead.status),color:'#7a93a7',count:0});
      map.get(key).count++;
    }
    return [...map.values()].sort((a,b)=>b.count-a.count).slice(0,7);
  },[leads,pipelineStages]);

  const priority=useMemo(()=>[...activeTasks].sort((a,b)=>{
    const due=v=>validDate(v.due_date)?new Date(v.due_date).getTime():Infinity;
    return due(a)-due(b);
  }).slice(0,5),[activeTasks]);

  const latest=useMemo(()=>[...leads].sort((a,b)=>(new Date(b.created_at||0).getTime()||0)-(new Date(a.created_at||0).getTime()||0)).slice(0,6),[leads]);
  const activity=useMemo(()=>[
    ...leads.map(x=>({id:'l'+x.id,kind:'Lead recebido',subject:fullName(x.contact),created:x.created_at,href:'/leads'})),
    ...sales.map(x=>({id:'s'+x.id,kind:'Venda registrada',subject:money(x.value),created:x.created_at,href:'/sales'})),
    ...appointments.map(x=>({id:'a'+x.id,kind:'Agendamento',subject:x.title||'Agendamento',created:x.created_at,href:'/agenda'})),
    ...tasks.map(x=>({id:'t'+x.id,kind:'Tarefa criada',subject:x.title||'Tarefa',created:x.created_at,href:'/tasks'}))
  ].filter(x=>validDate(x.created)).sort((a,b)=>new Date(b.created)-new Date(a.created)).slice(0,5),[leads,sales,appointments,tasks]);

  return <div className="w10-workbench" aria-busy={loading}>
    <header className="w10-heading">
      <div className="w10-strapline"><span className="w10-strap-number">NEXUS CRM</span><span className="w10-strap-rule"/><span>{organizationName||'Empresa'}</span></div>
      <div className="w10-heading-main"><div><h1>Visão geral</h1><p>O desempenho da operação, sem sair do fluxo de trabalho.</p></div>
        <div className="w10-heading-tools"><span className="w10-synced"><span/>{historyLabel}</span><Link href="/leads" className="w10-action">Abrir funil <ArrowUpRight size={17}/></Link></div>
      </div>
    </header>

    <section className="w10-overview" aria-label="Resumo comercial">
      <div className="w10-overview-main">
        <div className="w10-overview-label">LEADS RECEBIDOS <span> / {period} DIAS</span></div>
        <div className="w10-overview-value">{loading?'—':number(rangeLeads.length)}<span className="w10-overview-unit">recebidos</span></div>
        <Link href="/leads" className="w10-overview-link">Explorar oportunidades <ArrowUpRight size={15}/></Link>
      </div>
      <div className="w10-overview-aside">
        <Link href="/sales" className="w10-overview-metric"><span>Receita registrada</span><strong>{loading?'—':money(revenue)}</strong><small>{rangeSales.length} {rangeSales.length===1?'venda':'vendas'} no período</small></Link>
        <Link href="/agenda" className="w10-overview-metric"><span>Agendamentos cadastrados</span><strong>{loading?'—':number(rangeAppointments.length)}</strong><small>Registros criados no período</small></Link>
        <Link href="/tasks" className={'w10-overview-metric'+(overdue.length?' w10-overview-metric--urgent':'')}><span>Tarefas atrasadas</span><strong>{loading?'—':number(overdue.length)}</strong><small>{activeTasks.length} tarefas em aberto</small></Link>
      </div>
    </section>

    <div className="w10-workrow">
      <section className="w10-figure">
        <div className="w10-figure-top">
          <div><span className="w10-eyebrow">ENTRADAS</span><h2>Fluxo de leads</h2><p>Entradas registradas nos últimos {period} dias</p></div>
          <div className="w10-pills" role="group" aria-label="Período de análise">{[7,30,90].map(x=><button type="button" key={x} aria-pressed={period===x} className={period===x?'is-active':''} onClick={()=>setPeriod(x)}>{x} dias</button>)}</div>
        </div>
        <div className="w10-figure-meta"><strong>{number(rangeLeads.length)}</strong><span>novos registros</span><span className="w10-figure-legend"><i/> Leads</span></div>
        <SparkChart series={series} period={period}/>
        <div className="w10-chartfoot"><span>Origem: leads cadastrados</span><Link href="/reports">Relatórios <ArrowRight size={15}/></Link></div>
      </section>
      <section className="w10-priority">
        <SectionHead title="Pendências" description="Próximas ações da equipe" href="/tasks" label="Ver tarefas"/>
        <div className="w10-priority-count"><strong>{number(activeTasks.length)}</strong><span>{activeTasks.length===1?'tarefa em aberto':'tarefas em aberto'}</span>{overdue.length>0&&<span className="w10-urgent"><CircleAlert size={13}/>{overdue.length} atrasadas</span>}</div>
        <div className="w10-task-list">
          {priority.length?priority.map((t,i)=><Link key={t.id||i} className="w10-task" href="/tasks">
            <span className="w10-task-mark"><Clock3 size={17}/></span>
            <span className="w10-task-copy"><strong>{t.title||'Tarefa sem título'}</strong><small>{t.due_date?'Prazo: '+shortDate(t.due_date):'Sem data definida'}</small></span>
            <ChevronRight size={15}/>
          </Link>):<div className="w10-no-tasks"><Check size={21}/><strong>Sem tarefas pendentes</strong><span>As próximas atividades aparecerão aqui.</span></div>}
        </div>
      </section>
    </div>

    <section className="w10-pipeline">
      <SectionHead title="Distribuição no funil" description="Posição dos leads nos registros carregados" href="/leads" label="Abrir quadro"/>
      <div className="w10-pipeline-tracks">
        {stages.length?stages.map((s,i)=><div className="w10-stage" key={s.id}>
          <div className="w10-stage-name"><span className="w10-stage-index">{String(i+1).padStart(2,'0')}</span><strong>{s.name}</strong><span>{number(s.count)}</span></div>
          <div className="w10-stage-bar"><span style={{width:(100*s.count/Math.max(1,leads.length))+'%',backgroundColor:s.color}}/></div>
        </div>):<div className="w10-empty">Nenhuma etapa disponível. Configure o funil em Leads.</div>}
      </div>
      <div className="w10-pipeline-foot"><span>{number(counts?.leads||0)} leads na empresa</span><span>Abra o funil para movimentar os atendimentos</span></div>
    </section>

    <div className="w10-bottom">
      <section className="w10-recent">
        <SectionHead title="Leads recentes" description="Últimos contatos recebidos" href="/leads" label="Todos os leads"/>
        <div className="w10-table-scroll">
          <table className="w10-table"><thead><tr><th>Contato</th><th>Etapa</th><th>Origem</th><th>Cadastro</th><th><span className="w10-visually-hidden">Ação</span></th></tr></thead>
          <tbody>{latest.map((l,i)=>{
            const name=fullName(l.contact),stage=pipelineStages.find(s=>s.id===l.pipeline_stage_id);
            const wa=whatsapp(l.contact?.whatsapp);
            return <tr key={l.id||i}><td><div className="w10-contact"><span className="w10-monogram">{name.split(/\s+/).slice(0,2).map(p=>p[0]||'').join('').toUpperCase()}</span><strong>{name}</strong></div></td><td><span className="w10-status"><i style={{backgroundColor:stage?.color||'#8ca5b8'}}/>{stage?.name||friendlyStatus(l.status)}</span></td><td>{l.source||'Não informada'}</td><td>{shortDate(l.created_at)}</td><td>{wa?<a className="w10-table-action" href={wa} target="_blank" rel="noopener noreferrer" aria-label={'Conversar com '+name} title="Abrir WhatsApp"><MessageCircle size={18}/></a>:<Link className="w10-table-action" href="/leads" aria-label={'Ver '+name}><ArrowUpRight size={18}/></Link>}</td></tr>;
          })}</tbody></table>
        </div>
        {!latest.length&&<div className="w10-empty">Ainda não há leads cadastrados.</div>}
      </section>
      <section className="w10-activity">
        <SectionHead title="Atividade" description="Últimos registros" href="/reports" label="Relatórios"/>
        <div className="w10-activity-list">{activity.length?activity.map((a,i)=><Link href={a.href} key={a.id||i} className="w10-activity-row">
          <span className="w10-timeline-dot"/><span className="w10-activity-copy"><small>{a.kind}</small><strong>{a.subject}</strong></span><time dateTime={a.created}>{shortDate(a.created)}</time>
        </Link>):<div className="w10-empty">Nenhuma movimentação recente.</div>}</div>
      </section>
    </div>

    <footer className="w10-footnote">
      {hasPartial?'Indicadores baseados em até 250 registros carregados por módulo. O histórico integral pode ser maior.':'Indicadores baseados nos registros carregados nesta empresa.'}
      {' '}Para números consolidados, consulte os relatórios.
    </footer>
  </div>;
}
