'use client';
import {useMemo,useState} from 'react';
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
const date=v=>v&&!isNaN(Date.parse(v))?new Date(v).toLocaleDateString('pt-BR'):'—';
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
function Drawer({data,type='lead',onClose,readonly,statuses,onStageChange,pending}){
  if(!data)return null;
  const person=type==='lead'?data.contact:data;
  const who=display(person);
  return <div className="nxp-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <aside className="nxp-drawer" role="dialog" aria-modal="true" aria-label={'Detalhes de '+who}>
      <div className="nxp-drawer-top"><span>VISÃO DO {type==='lead'?'LEAD':'CONTATO'}</span><button type="button" aria-label="Fechar detalhes" onClick={onClose}><X size={21}/></button></div>
      <div className="nxp-drawer-identity"><Avatar value={who} large/><div><h2>{who}</h2><p>{person?.whatsapp||'Telefone não informado'}</p></div></div>
      <div className="nxp-drawer-sep"/>
      <div className="nxp-drawer-block"><span className="nxp-kicker">AÇÃO RÁPIDA</span><WhatsLink phone={person?.whatsapp} className="nxp-button nxp-button--whatsapp">Abrir conversa</WhatsLink></div>
      {type==='lead'&&<>
        <div className="nxp-drawer-block"><span className="nxp-kicker">ETAPA DO FUNIL</span>
        <select className="nxp-select" disabled={readonly||pending||!statuses?.length} value={data.status||''} onChange={e=>onStageChange(data,e.target.value)}>
          {statuses?.map(x=><option key={x} value={x}>{label(x)}</option>)}
        </select>
        <small className="nxp-fieldhelp">{readonly?'Seu perfil é somente leitura.':'As alterações são salvas no Supabase.'}</small>
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
function Metric({label,value,icon:Icon,tone,footer}){return <article className={'nxp-metric nxp-metric--'+tone}><div className="nxp-metric-top"><span>{label}</span><span className="nxp-metric-icon"><Icon size={20}/></span></div><strong>{value}</strong><div className="nxp-metric-bottom"><span className="nxp-metric-pip"/>{footer}</div></article>}

export function PremiumDashboard({data,counts,loading,organizationName,firstName,openTasks=[],overdueTasks=[],lastSync}){
  const [period,setPeriod]=useState(30);
  const {currentLeads,currentSales,currentAppointments,trend,stages}=useMemo(()=>{
    const now=new Date();const cut=now.getTime()-period*86400000;
    const cLeads=data.leads.filter(x=>new Date(x.created_at).getTime()>=cut);
    const cSales=data.sales.filter(x=>new Date(x.created_at).getTime()>=cut);
    const cAppts=data.appointments.filter(x=>new Date(x.created_at).getTime()>=cut);
    const trend=Array.from({length:7},(_,i)=>{
      const day=new Date(now);day.setHours(0,0,0,0);day.setDate(day.getDate()-(6-i));
      const finish=day.getTime()+86400000;
      return {name:day.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),value:data.leads.filter(l=>{const t=new Date(l.created_at).getTime();return t>=day.getTime()&&t<finish}).length};
    });
    const groups=new Map();
    data.leads.forEach(l=>{const k=l.status||'Sem etapa';groups.set(k,(groups.get(k)||0)+1)});
    return {currentLeads:cLeads,currentSales:cSales,currentAppointments:cAppts,trend,stages:[...groups.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5)};
  },[data,period]);
  const recentIncome=currentSales.reduce((n,item)=>n+Number(item.value||0),0);
  const max=Math.max(1,...trend.map(d=>d.value));
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
      <Metric tone="blue" icon={UsersRound} label="Leads no período" value={loading?'—':fmt(currentLeads.length)} footer="Até 250 registros recentes"/>
      <Metric tone="green" icon={Wallet} label="Vendas registradas" value={loading?'—':fmt(currentSales.length)} footer={brl(recentIncome)+' em vendas do período'}/>
      <Metric tone="violet" icon={CalendarDays} label="Agendamentos" value={loading?'—':fmt(currentAppointments.length)} footer="Criados no período"/>
      <Metric tone="orange" icon={ListTodo} label="Tarefas abertas" value={loading?'—':fmt(openTasks.length)} footer={overdueTasks.length+' com prazo vencido'}/>
    </div>
    <div className="nxp-analytics-grid">
      <section className="nxp-surface nxp-graph-panel"><div className="nxp-panel-head"><div><span className="nxp-kicker">AQUISIÇÃO</span><h3>Movimento de leads</h3><p>Novos registros nos últimos sete dias</p></div><div className="nxp-circle-icon"><Activity size={21}/></div></div>
      <div className="nxp-graph"><div className="nxp-graph-grid">{[0,1,2,3].map(x=><span key={x}/>)}</div>{trend.map((d,i)=><div className="nxp-graph-cell" key={i}><span className="nxp-graph-value">{d.value||''}</span><div className="nxp-graph-bar-wrap"><div className={'nxp-graph-bar '+(i===6?'nxp-graph-bar--latest':'')} style={{height:Math.max(2,(d.value/max)*100)+'%'}}/></div><small>{d.name}</small></div>)}</div>
      <div className="nxp-panel-bottom"><span><i className="nxp-legend"/> Leads cadastrados</span><Link href="/leads">Ver oportunidades <ArrowRight size={15}/></Link></div>
      </section>
      <section className="nxp-surface nxp-funnel-panel"><div className="nxp-panel-head"><div><span className="nxp-kicker">DISTRIBUIÇÃO</span><h3>Seu funil</h3><p>Etapas utilizadas pelos leads</p></div><div className="nxp-circle-icon"><BarChart3 size={21}/></div></div>
      <div className="nxp-funnel-rows">{stages.map(([key,count],i)=><div className="nxp-funnel-row" key={key}><div><span>{label(key)}</span><strong>{fmt(count)}</strong></div><div className="nxp-track"><span style={{width:(100*count/Math.max(data.leads.length,1))+'%',background:['#5778f7','#7d8ff6','#9a81ea','#49c9aa','#edb569'][i]}}/></div></div>)}
      {!stages.length&&<Empty title="Sem movimentações" detail="Quando os leads forem cadastrados, as etapas aparecerão aqui."/>}</div>
      <div className="nxp-panel-bottom"><span>Total no banco: {fmt(counts.leads)}</span><Link href="/leads">Abrir funil <ArrowRight size={15}/></Link></div></section>
    </div>
    <div className="nxp-analytics-grid nxp-analytics-grid--bottom">
      <section className="nxp-surface"><div className="nxp-panel-head"><div><span className="nxp-kicker">PRIORIDADES</span><h3>Próximas tarefas</h3><p>O que ainda precisa ser feito</p></div><Link href="/tasks" className="nxp-icon-link">Ver todas <ArrowRight size={15}/></Link></div>
      <div className="nxp-compact-list">{openTasks.slice(0,5).map(t=><div key={t.id} className="nxp-task-item"><span className="nxp-task-square"/><div><strong>{t.title}</strong><small>{t.due_date?'Prazo: '+date(t.due_date):'Sem data de vencimento'}</small></div><Pill value={t.priority||t.status}/></div>)}{!openTasks.length&&<Empty icon={CircleCheck} title="Tudo em dia" detail="Você não tem tarefas em aberto agora."/>}</div></section>
      <section className="nxp-surface nxp-quick-panel"><div className="nxp-panel-head"><div><span className="nxp-kicker">CENTRAL DE TRABALHO</span><h3>Continue seu fluxo</h3><p>Acessos que simplificam a rotina</p></div><span className="nxp-circle-icon"><Zap size={20}/></span></div>
      {[['/leads',UsersRound,'Oportunidades','Consultar leads e etapas'],['/contacts',ContactRound,'Base de contatos','Pessoas e WhatsApp'],['/whatsapp',MessageCircle,'WhatsApp','Ver opções de conexão']].map(([href,Icon,title,desc])=><Link href={href} key={href} className="nxp-quick-link"><span><Icon size={20}/></span><div><strong>{title}</strong><small>{desc}</small></div><ArrowUpRight size={16}/></Link>)}</section>
    </div>
    <p className="nxp-data-disclaimer">Indicadores de período calculados sobre os últimos 250 registros carregados por módulo; o total de leads é consultado separadamente no banco.</p>
  </div>;
}

export function PremiumLeads({leads=[],count=0,organizationId,readonly=false,onReload}){
  const [mode,setMode]=useState('board');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [selected,setSelected]=useState(null);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [dragging,setDragging]=useState('');
  const statuses=useMemo(()=>[...new Set(leads.map(x=>x.status).filter(Boolean))],[leads]);
  const filtered=leads.filter(l=>
    (filter==='all'||String(l.status||'')===filter)&&
    keyword(display(l.contact),l.source,l.contact?.whatsapp,l.status).includes(query.toLocaleLowerCase('pt-BR')));
  const cols=statuses.length?statuses:['new'];
  const groups=cols.map(s=>({key:s,rows:filtered.filter(l=>String(l.status||'')===s)}));
  async function changeStage(item,next){
    if(!next||readonly||busy||item.status===next)return;
    setBusy(item.id);setError('');
    const {error:e}=await db.from('leads').update({status:next}).eq('id',item.id).eq('organization_id',organizationId);
    if(e)setError('Não foi possível atualizar a etapa: '+e.message);
    else{setSelected(v=>v?.id===item.id?{...v,status:next}:v);await onReload?.()}
    setBusy('');
  }
  const Card=({item})=><div className="nxp-lead-card" draggable={!readonly&&statuses.length>1} onDragStart={e=>{setDragging(item.id);e.dataTransfer.setData('text/plain',item.id)}} onDragEnd={()=>setDragging('')}>
    <button type="button" className="nxp-lead-card-main" onClick={()=>setSelected(item)} aria-label={'Abrir lead '+display(item.contact)}>
      <div className="nxp-lead-card-top"><Avatar value={display(item.contact)}/><span className="nxp-lead-date">{date(item.created_at)}</span></div>
      <strong>{display(item.contact)}</strong><small>{item.contact?.whatsapp||'Telefone não informado'}</small>
      <div className="nxp-lead-card-foot"><span>{item.source||'Origem não informada'}</span><ChevronRight size={16}/></div>
    </button>
    {wa(item.contact?.whatsapp)&&<WhatsLink phone={item.contact.whatsapp} className="nxp-lead-wa">Conversar</WhatsLink>}
  </div>;
  return <div className="nxp-premium">
    <PanelHeader eyebrow="CRM / PIPELINE" title="Oportunidades" detail="Organize suas conversas, acompanhe cada etapa e encontre o próximo negócio." right={<span className="nxp-total"><span/>{fmt(count)} leads cadastrados</span>}/>
    <div className="nxp-leads-summary"><div><span className="nxp-kicker">VISÃO DO FUNIL</span><strong>{fmt(count)}</strong><small>leads na empresa</small></div><div><span className="nxp-kicker">ETAPAS EM USO</span><strong>{statuses.length}</strong><small>etapas encontradas</small></div><div><span className="nxp-kicker">COM WHATSAPP</span><strong>{filtered.filter(x=>wa(x.contact?.whatsapp)).length}</strong><small>entre os registros exibidos</small></div><div className="nxp-leads-summary-decoration"><Layers3 size={82} strokeWidth={1}/></div></div>
    <section className="nxp-surface nxp-leads-workarea">
      <div className="nxp-filterbar"><label className="nxp-search"><Search size={18}/><input placeholder="Pesquisar por nome, telefone ou origem..." value={query} onChange={e=>setQuery(e.target.value)} aria-label="Pesquisar leads"/></label>
      <div className="nxp-filter-actions"><label className="nxp-filter-select"><Filter size={16}/><select value={filter} onChange={e=>setFilter(e.target.value)} aria-label="Filtrar etapa"><option value="all">Todas as etapas</option>{statuses.map(s=><option key={s} value={s}>{label(s)}</option>)}</select></label>
      <div className="nxp-mode-switch"><button type="button" className={mode==='board'?'active':''} onClick={()=>setMode('board')} title="Quadro Kanban" aria-label="Quadro Kanban"><Columns3 size={18}/></button><button type="button" className={mode==='list'?'active':''} onClick={()=>setMode('list')} title="Lista" aria-label="Lista"><LayoutList size={18}/></button></div></div></div>
      {error&&<div className="nxp-error" role="alert">{error}</div>}
      {mode==='board'?<div className="nxp-board" aria-label="Funil Kanban">
      {groups.map(({key,rows},idx)=><section key={key} className="nxp-board-column"
        onDragOver={e=>{if(!readonly&&statuses.length>1)e.preventDefault()}}
        onDrop={e=>{e.preventDefault();const lead=leads.find(l=>l.id===(e.dataTransfer.getData('text/plain')||dragging));if(lead)changeStage(lead,key);setDragging('')}}>
        <div className="nxp-column-title"><span className={'nxp-column-dot nxp-column-dot--'+(idx%5)}/><strong>{label(key)}</strong><span>{rows.length}</span></div>
        <div className="nxp-column-cards">{rows.map(item=><Card key={item.id} item={item}/>)}
          {!rows.length&&<div className="nxp-column-empty">{dragging?'Solte aqui para mover':'Sem leads nesta etapa'}</div>}</div>
      </section>)}
      {!statuses.length&&<Empty icon={UsersRound} title="Seu funil começa aqui" detail="Quando sua empresa receber leads, as etapas aparecerão automaticamente."/>}
      </div>:<div className="nxp-list-scroll"><table className="nxp-table"><thead><tr><th>Contato</th><th>Etapa</th><th>Origem</th><th>Cadastro</th><th>Atendimento</th></tr></thead><tbody>{filtered.map(l=><tr key={l.id}><td><button type="button" onClick={()=>setSelected(l)} className="nxp-person-btn"><Avatar value={display(l.contact)}/><div><strong>{display(l.contact)}</strong><small>{l.contact?.whatsapp||'Sem telefone'}</small></div></button></td><td><Pill value={l.status}/></td><td>{l.source||'—'}</td><td>{date(l.created_at)}</td><td><WhatsLink phone={l.contact?.whatsapp}>Conversar</WhatsLink></td></tr>)}</tbody></table>{!filtered.length&&<Empty icon={UsersRound} title="Nenhum lead encontrado" detail="Tente modificar a busca ou o filtro de etapa."/>}</div>}
      <div className="nxp-footnote">{filtered.length} leads exibidos · Até 250 registros recentes · {readonly?'Acesso somente leitura':'Arraste os cards entre etapas ou altere a etapa nos detalhes'}</div>
    </section>
    <Drawer data={selected} onClose={()=>setSelected(null)} readonly={readonly} statuses={statuses} onStageChange={changeStage} pending={Boolean(busy)}/>
  </div>;
}

export function PremiumContacts({contacts=[],count=0}){
  const [query,setQuery]=useState('');
  const [layout,setLayout]=useState('grid');
  const [selected,setSelected]=useState(null);
  const list=contacts.filter(c=>keyword(display(c),c.whatsapp).includes(query.toLocaleLowerCase('pt-BR')));
  const withPhone=contacts.filter(c=>wa(c.whatsapp)).length;
  return <div className="nxp-premium">
    <PanelHeader eyebrow="CRM / RELACIONAMENTO" title="Seus contatos" detail="Pessoas em um só lugar, prontas para uma conversa e um relacionamento melhor." right={<span className="nxp-total"><span/>{fmt(count)} na sua base</span>}/>
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
