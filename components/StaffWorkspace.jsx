'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {
  Activity,ArrowRight,ArrowUpRight,Bell,BriefcaseBusiness,CalendarDays,
  Check,CheckCircle2,ChevronDown,ChevronRight,Clock3,ContactRound,Flame,
  LayoutDashboard,Layers3,ListTodo,LogOut,Menu,MessageCircle,Minus,
  Moon,Plus,RefreshCw,Search,ShieldCheck,Sun,TrendingUp,
  UserRound,UsersRound,X
} from 'lucide-react';
import {db} from '../lib/supabase';
import {PremiumDashboard,PremiumLeads,PremiumContacts,PremiumWhatsApp} from './PremiumOperation';

const MENU=[
  {path:'dashboard',label:'Visão geral',icon:LayoutDashboard},
  {path:'leads',label:'Leads',icon:UsersRound},
  {path:'contacts',label:'Contatos',icon:ContactRound},
  {path:'whatsapp',label:'WhatsApp',icon:MessageCircle},
  {path:'agenda',label:'Agenda',icon:CalendarDays},
  {path:'tasks',label:'Minhas tarefas',icon:ListTodo},
  {path:'minha-area',label:'Meu perfil',icon:UserRound}
];
const PAGES={dashboard:'Visão geral',leads:'Leads',contacts:'Contatos',whatsapp:'WhatsApp',agenda:'Agenda',tasks:'Minhas tarefas','minha-area':'Meu perfil'};
const ROLES={AGENCY_ADMIN:'Admin da agência',ORGANIZATION_ADMIN:'Admin da empresa',MANAGER:'Gerente',SDR:'SDR',SELLER:'Vendedor',VIEWER:'Visualizador'};
const number=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(n)||0);
const date=v=>v&&!isNaN(Date.parse(v))?new Date(v).toLocaleDateString('pt-BR'):'—';
const dayTime=v=>v&&!isNaN(Date.parse(v))?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const nameOf=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'Contato sem nome';
const normalizePhone=value=>String(value||'').replace(/\D/g,'');
const whatsApp=value=>{
  const phone=normalizePhone(value);
  if(!phone||phone.length<10||phone.length>13)return null;
  const full=phone.length<=11?'55'+phone:phone;
  return 'https://wa.me/'+full;
};
const formatStatus=s=>String(s||'Sem etapa').replace(/[_-]/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
const badgeType=s=>['completed','done','won','closed','paid'].includes(String(s||'').toLowerCase())?'success':
  ['pending','new','waiting','open','in_progress'].includes(String(s||'').toLowerCase())?'pending':
  ['lost','cancelled','canceled','overdue'].includes(String(s||'').toLowerCase())?'danger':'neutral';
function Chip({value}){return <span className={'staff-chip staff-chip--'+badgeType(value)}>{formatStatus(value)}</span>}
function Initials({name,variant=''}){return <span className={'staff-initials '+variant}>{String(name||'?').trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()).join('')}</span>}
function Empty({icon:Icon=Layers3,title,description}){return <div className="staff-empty"><span><Icon size={27}/></span><strong>{title}</strong><p>{description}</p></div>}
function IconButton({children,icon:Icon,onClick,disabled=false,title}){return <button type="button" className="staff-icon-button" onClick={onClick} disabled={disabled} aria-label={title||'Ação'} title={title}>{Icon?<Icon size={18}/>:children}</button>}
function MiniStat({label,value,description,icon:Icon,tone,index}){return <div className={'staff-stat staff-stat--'+tone} style={{animationDelay:(index*45)+'ms'}}><div className="staff-stat-head"><span>{label}</span><span className="staff-stat-icon"><Icon size={19}/></span></div><strong>{value}</strong><small>{description}</small></div>}

export default function StaffWorkspace({section,session,profile,organizations,members,organizationId,onOrganizationChange,onSignOut,dark,onToggleTheme}) {
  const [data,setData]=useState({leads:[],tasks:[],contacts:[],appointments:[],sales:[]});
  const [counts,setCounts]=useState({leads:0,contacts:0,appointments:0,sales:0,tasks:0});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const [taskTitle,setTaskTitle]=useState('');
  const [taskFilter,setTaskFilter]=useState('open');
  const [period,setPeriod]=useState(30);
  const [mobileOpen,setMobileOpen]=useState(false);
  const [lastSync,setLastSync]=useState(null);
  const currentOrganization=organizations.find(o=>o.id===organizationId);
  const activeMember=members.find(m=>m.organization_id===organizationId&&m.status==='active');
  const role=activeMember?.role||'';
  const readonly=role==='VIEWER';
  const validOrg=Boolean(currentOrganization&&currentOrganization.status==='active'&&activeMember&&session?.id&&profile?.status==='active');
  const roleLabel=ROLES[role]||'Colaborador';
  const page=PAGES[section]||'Visão geral';

  useEffect(()=>{setSearch('');setStatusFilter('all');setMobileOpen(false)},[section,organizationId]);
  const load=useCallback(async()=>{
    if(!db||!validOrg){
      setData({leads:[],tasks:[],contacts:[],appointments:[],sales:[]});
      setCounts({leads:0,contacts:0,appointments:0,sales:0,tasks:0});
      setLoading(false);return;
    }
    setLoading(true);setError('');
    try{
      const [leads,tasks,contacts,appointments,sales,leadCount,taskCount,contactCount,appointmentCount,saleCount]=await Promise.all([
        db.from('leads').select('id,source,status,temperature,created_at,contact:contacts(id,first_name,last_name,whatsapp)').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(250),
        db.from('tasks').select('id,title,status,priority,due_date,created_at,created_by').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(250),
        db.from('contacts').select('id,first_name,last_name,whatsapp,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(250),
        db.from('appointments').select('*').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(250),
        db.from('sales').select('id,value,created_at').eq('organization_id',organizationId).order('created_at',{ascending:false}).limit(250),
        db.from('leads').select('id',{head:true,count:'exact'}).eq('organization_id',organizationId),
        db.from('tasks').select('id',{head:true,count:'exact'}).eq('organization_id',organizationId),
        db.from('contacts').select('id',{head:true,count:'exact'}).eq('organization_id',organizationId),
        db.from('appointments').select('id',{head:true,count:'exact'}).eq('organization_id',organizationId),
        db.from('sales').select('id',{head:true,count:'exact'}).eq('organization_id',organizationId)
      ]);
      const results={leads,tasks,contacts,appointments,sales};
      const working={};
      const issues=[];
      Object.entries(results).forEach(([key,result])=>{
        if(result.error){issues.push(key+': '+result.error.message);working[key]=[]}
        else working[key]=result.data||[];
      });
      setData(working);
      setCounts({
        leads:leadCount.error?working.leads.length:(leadCount.count||0),
        tasks:taskCount.error?working.tasks.length:(taskCount.count||0),
        contacts:contactCount.error?working.contacts.length:(contactCount.count||0),
        appointments:appointmentCount.error?working.appointments.length:(appointmentCount.count||0),
        sales:saleCount.error?working.sales.length:(saleCount.count||0)
      });
      if(issues.length)setError('Alguns módulos ainda não carregaram: '+issues.join(' · ')+'. Verifique as tabelas e permissões da operação no Supabase.');
      setLastSync(new Date());
    }catch(e){setError('Não foi possível carregar esta operação: '+e.message)}
    finally{setLoading(false)}
  },[organizationId,validOrg]);
  useEffect(()=>{load()},[load]);

  const since=useMemo(()=>Date.now()-period*86400000,[period]);
  const recentLeads=useMemo(()=>data.leads.filter(x=>x.created_at&&new Date(x.created_at).getTime()>=since),[data.leads,since]);
  const recentAppointments=useMemo(()=>data.appointments.filter(x=>x.created_at&&new Date(x.created_at).getTime()>=since),[data.appointments,since]);
  const recentSales=useMemo(()=>data.sales.filter(x=>x.created_at&&new Date(x.created_at).getTime()>=since),[data.sales,since]);
  const openTasks=useMemo(()=>data.tasks.filter(t=>!['completed','done','cancelled','canceled'].includes(String(t.status||'').toLowerCase())),[data.tasks]);
  const overdueTasks=useMemo(()=>openTasks.filter(t=>t.due_date&&new Date(t.due_date).getTime()<Date.now()),[openTasks]);
  const statuses=useMemo(()=>[...new Set(data.leads.map(l=>l.status).filter(Boolean))],[data.leads]);
  const filteredLeads=data.leads.filter(l=>{
    const text=[nameOf(l.contact),l.contact?.whatsapp,l.source,l.status].join(' ').toLowerCase();
    return text.includes(search.toLowerCase())&&(statusFilter==='all'||l.status===statusFilter);
  });
  const filteredContacts=data.contacts.filter(c=>[nameOf(c),c.whatsapp].join(' ').toLowerCase().includes(search.toLowerCase()));
  const filteredTasks=data.tasks.filter(t=>{
    const done=['completed','done'].includes(String(t.status||'').toLowerCase());
    return t.title.toLowerCase().includes(search.toLowerCase())&&(taskFilter==='all'||(taskFilter==='done'?done:!done));
  });
  const trend=useMemo(()=>{
    const today=new Date();today.setHours(0,0,0,0);
    return Array.from({length:7},(_,i)=>{
      const start=new Date(today);start.setDate(today.getDate()-(6-i));
      const end=new Date(start);end.setDate(end.getDate()+1);
      const value=data.leads.filter(l=>{const v=new Date(l.created_at).getTime();return v>=start.getTime()&&v<end.getTime()}).length;
      return {day:start.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.',''),count:value};
    });
  },[data.leads]);
  const maxTrend=Math.max(...trend.map(x=>x.count),1);
  const leadGroups=useMemo(()=>{
    const grouped={};
    data.leads.forEach(l=>{const key=l.status||'Sem etapa';grouped[key]=(grouped[key]||0)+1});
    return Object.entries(grouped).sort((a,b)=>b[1]-a[1]).slice(0,6);
  },[data.leads]);

  async function createTask(e){
    e.preventDefault();if(!validOrg||readonly||!taskTitle.trim()||saving)return;
    setSaving(true);setError('');setNotice('');
    const {error:err}=await db.from('tasks').insert({organization_id:organizationId,title:taskTitle.trim(),created_by:session.id});
    if(err)setError('Não foi possível criar a tarefa: '+err.message);
    else{setTaskTitle('');setNotice('Tarefa cadastrada.');await load()}
    setSaving(false);
  }
  async function changeTask(t){
    if(!validOrg||readonly||saving)return;
    setSaving(true);setError('');setNotice('');
    const complete=!['completed','done'].includes(String(t.status||'').toLowerCase());
    const {error:err}=await db.from('tasks').update({status:complete?'completed':'pending',completed_at:complete?new Date().toISOString():null}).eq('id',t.id).eq('organization_id',organizationId);
    if(err)setError('Não foi possível atualizar a tarefa: '+err.message);
    else{setNotice(complete?'Tarefa concluída.':'Tarefa reaberta.');await load()}
    setSaving(false);
  }
  const assigned=organizationId&&validOrg;
  const displayName=(profile?.full_name||session?.email||'Colaborador').trim();
  const firstName=displayName.split(/\s+/)[0];
  const greetingHour=new Date().getHours();
  const greeting=greetingHour<12?'Bom dia':greetingHour<18?'Boa tarde':'Boa noite';

  const leadRows=(list,limit=false)=><div className="staff-tablewrap"><table className="staff-table">
    <thead><tr><th>Contato</th><th>Origem</th><th>Etapa</th><th>Data</th><th>Ação</th></tr></thead>
    <tbody>{(limit?list.slice(0,6):list).map(l=><tr key={l.id}>
      <td><div className="staff-person"><Initials name={nameOf(l.contact)}/><div><strong>{nameOf(l.contact)}</strong><small>{l.contact?.whatsapp||'Sem telefone'}</small></div></div></td>
      <td>{l.source||'Não informada'}</td><td><Chip value={l.status}/></td>
      <td><span className="staff-soft">{date(l.created_at)}</span></td>
      <td>{whatsApp(l.contact?.whatsapp)?<a className="staff-contact-link" target="_blank" rel="noopener noreferrer" href={whatsApp(l.contact.whatsapp)} title="Abrir conversa no WhatsApp"><MessageCircle size={16}/> Conversar <ArrowUpRight size={14}/></a>:<span className="staff-soft">Sem número</span>}</td>
    </tr>)}</tbody>
  </table>{!list.length&&<Empty icon={UsersRound} title="Nenhum lead encontrado" description="Os leads recebidos pela operação aparecerão aqui."/ >}</div>;

  if(section==='admin')return <main className="staff-denied"><ShieldCheck size={34}/><h1>Acesso restrito</h1><p>Este painel é exclusivo do Super Admin.</p><Link href="/dashboard">Voltar ao painel</Link></main>;

  return <div className="staff-shell">
    <aside className={'staff-sidebar '+(mobileOpen?'staff-sidebar--open':'')}>
      <div className="staff-logo"><div className="staff-logo-icon"><Layers3 size={23}/></div><div><strong>NEXUS <span>CRM</span></strong><small>WORKSPACE</small></div><button className="staff-hide-menu" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"><X size={18}/></button></div>
      <div className="staff-workspace-picker"><span className="staff-workspace-icon"><BriefcaseBusiness size={20}/></span><div><small>SEU ESPAÇO</small><strong>{currentOrganization?.name||'Sem empresa'}</strong></div>{organizations.length>1&&<ChevronDown size={15}/>}</div>
      {organizations.length>1&&<label className="staff-company-choice"><span>Alternar empresa</span><select value={organizationId} onChange={e=>onOrganizationChange(e.target.value)}>{organizations.filter(c=>c.status==='active').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <div className="staff-nav-title">MENU PRINCIPAL</div>
      <nav aria-label="Área de trabalho" className="staff-nav">
        {MENU.map(({path,label,icon:Icon})=><Link key={path} href={'/'+path} onClick={()=>setMobileOpen(false)} className={'staff-nav-item '+(section===path?'staff-nav-item--active':'')} aria-current={section===path?'page':undefined}><Icon size={19} strokeWidth={1.9}/><span>{label}</span>{section===path&&<span className="staff-nav-dot"/>}</Link>)}
      </nav>
      <div className="staff-sidebar-footer"><div className="staff-session"><Initials name={displayName}/><div><strong>{displayName}</strong><small>{roleLabel}</small></div></div><button type="button" className="staff-logout" onClick={onSignOut}><LogOut size={17}/> Sair da conta</button></div>
    </aside>
    {mobileOpen&&<button className="staff-mobile-overlay" onClick={()=>setMobileOpen(false)} aria-label="Fechar navegação"/>}
    <main className="staff-main">
      <header className="staff-topbar">
        <div className="staff-topbar-left"><IconButton icon={Menu} title="Abrir menu" onClick={()=>setMobileOpen(true)}/><div className="staff-breadcrumb"><span>Workspace</span><ChevronRight size={15}/><strong>{page}</strong></div></div>
        <div className="staff-topbar-right"><span className="staff-connected"><span/> Ambiente de trabalho</span><IconButton icon={RefreshCw} title="Atualizar dados" disabled={loading} onClick={load}/><IconButton icon={dark?Sun:Moon} title="Alternar tema" onClick={onToggleTheme}/><div className="staff-top-avatar"><Initials name={displayName}/></div></div>
      </header>
      <div className="staff-body">
        {!assigned?<div className="staff-no-access"><span><BriefcaseBusiness size={30}/></span><h2>Seu espaço de trabalho ainda não foi liberado.</h2><p>Peça ao responsável para vincular seu usuário a uma empresa ativa em Super Admin → Acessos.</p><button className="staff-btn staff-btn--outline" onClick={onSignOut}>Sair da conta</button></div>:<>
        {error&&<div className="staff-alert staff-alert--error" role="alert">{error}</div>}
        {notice&&!error&&<div className="staff-alert staff-alert--success" role="status"><CheckCircle2 size={16}/>{notice}</div>}

        {section==='dashboard'&&<PremiumDashboard
          data={data} counts={counts} loading={loading}
          organizationName={currentOrganization.name} firstName={firstName}
          openTasks={openTasks} overdueTasks={overdueTasks} lastSync={lastSync}
        />}
        {section==='leads'&&<PremiumLeads
          leads={data.leads} count={counts.leads} organizationId={organizationId}
          readonly={readonly} onReload={load}
        />}
        {section==='contacts'&&<PremiumContacts contacts={data.contacts} count={counts.contacts}/>}
        {section==='whatsapp'&&<PremiumWhatsApp
          organizationName={currentOrganization.name} contacts={data.contacts}
        />}

        {section==='tasks'&&<>
          <div className="staff-page-header"><div><span className="staff-kicker">ORGANIZAÇÃO / ROTINA</span><h1>Minhas tarefas</h1><p>Organize as atividades da sua empresa e mantenha tudo em dia.</p></div><span className="staff-page-counter">{openTasks.length} em aberto</span></div>
          <section className="staff-card staff-task-page">
            {!readonly&&<form className="staff-new-task" onSubmit={createTask}><span className="staff-new-task-icon"><ListTodo size={19}/></span><input placeholder="O que precisa ser feito?" required maxLength={200} value={taskTitle} onChange={e=>setTaskTitle(e.target.value)}/><button disabled={saving||!taskTitle.trim()} type="submit" className="staff-btn staff-btn--primary"><Plus size={18}/> Adicionar tarefa</button></form>}
            {readonly&&<div className="staff-readonly"><ShieldCheck size={18}/> Seu perfil é somente leitura. Você pode acompanhar tarefas, mas não editá-las.</div>}
            <div className="staff-data-controls staff-task-controls"><div className="staff-switch">{[['open','Em aberto'],['done','Concluídas'],['all','Todas']].map(([id,label])=><button key={id} onClick={()=>setTaskFilter(id)} className={taskFilter===id?'active':''}>{label}</button>)}</div><label className="staff-search"><Search size={17}/><input placeholder="Buscar tarefa" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
            <div className="staff-task-list">{filteredTasks.map(t=><div key={t.id} className="staff-task-row"><button type="button" disabled={readonly||saving} className={'staff-task-check '+(['completed','done'].includes(String(t.status||'').toLowerCase())?'staff-task-check--done':'')} onClick={()=>changeTask(t)} title="Alterar status da tarefa"><Check size={15}/></button><div className="staff-task-copy"><strong className={['completed','done'].includes(String(t.status||'').toLowerCase())?'staff-task-complete':''}>{t.title}</strong><small>{t.due_date?'Prazo: '+date(t.due_date):'Sem prazo definido'}{t.priority?' · Prioridade: '+formatStatus(t.priority):''}</small></div><Chip value={t.status}/></div>)}</div>
            {!filteredTasks.length&&<Empty icon={CheckCircle2} title="Nenhuma tarefa nesta lista" description="Altere o filtro ou cadastre uma nova tarefa."/>}
          </section>
        </>}

        {section==='agenda'&&<>
          <div className="staff-page-header"><div><span className="staff-kicker">COMPROMISSOS</span><h1>Agenda</h1><p>Consulte os agendamentos registrados na sua empresa.</p></div><span className="staff-page-counter">{number(counts.appointments)} agendamentos</span></div>
          <section className="staff-card staff-data-card"><div className="staff-card-heading staff-appointment-heading"><div><h3>Agendamentos cadastrados</h3><p>Os dados abaixo são carregados diretamente do banco.</p></div><CalendarDays size={21}/></div>
            <div className="staff-appointment-list">{data.appointments.map(a=>{
              const starts=a.scheduled_at||a.start_at||a.starts_at||a.appointment_at||a.appointment_date||a.date;
              const label=a.title||a.name||a.subject||'Agendamento';
              return <div className="staff-appointment-row" key={a.id}><span className="staff-appointment-icon"><CalendarDays size={21}/></span><div><strong>{label}</strong><small>{starts?'Data agendada: '+dayTime(starts):'Data e horário não disponíveis neste registro'}</small></div>{a.status&&<Chip value={a.status}/>}</div>
            })}</div>{!data.appointments.length&&<Empty icon={CalendarDays} title="Nenhum agendamento encontrado" description="Seus agendamentos aparecerão aqui quando forem cadastrados."/>}<div className="staff-table-footer">Até 250 registros recentes. A criação de agendamentos depende da integração do módulo de agenda.</div>
          </section>
        </>}

        {section==='minha-area'&&<>
          <div className="staff-page-header"><div><span className="staff-kicker">MINHA CONTA</span><h1>Meu espaço</h1><p>Seu perfil e as empresas que você pode acessar.</p></div></div>
          <div className="staff-profile-grid"><section className="staff-card staff-profile-card"><span className="staff-profile-avatar"><Initials name={displayName}/></span><h2>{displayName}</h2><p>{session.email}</p><span className="staff-profile-role"><ShieldCheck size={16}/>{roleLabel}</span><div className="staff-profile-info"><div><span>Conta</span><strong>Ativa</strong></div><div><span>Empresa selecionada</span><strong>{currentOrganization.name}</strong></div><div><span>Nível de acesso</span><strong>{roleLabel}</strong></div></div></section>
          <section className="staff-card staff-profile-card"><h3>Empresas vinculadas</h3><p>Você só acessa operações autorizadas.</p>{organizations.filter(x=>x.status==='active').map(o=><div key={o.id} className="staff-linked-org"><span className="staff-linked-icon"><BriefcaseBusiness size={20}/></span><span><strong>{o.name}</strong><small>{ROLES[members.find(m=>m.organization_id===o.id)?.role]||'Colaborador'}</small></span>{o.id===organizationId&&<CheckCircle2 size={18}/>}</div>)}</section></div>
        </>}
        </>}
      </div>
    </main>
  </div>;
}
