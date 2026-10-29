'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {
  Activity,ArrowRight,ArrowUpRight,Bell,BriefcaseBusiness,CalendarDays,Compass,
  Check,CheckCircle2,ChevronDown,ChevronRight,Clock3,ContactRound,Flame,
  LayoutDashboard,Layers3,ListTodo,LogOut,Menu,MessageCircle,Minus,Workflow,Sparkles,
  Moon,Plus,Play,RefreshCw,Search,ShieldCheck,Sun,TrendingUp,
  UserRound,UsersRound,X,Zap
} from 'lucide-react';
import {db} from '../lib/supabase';
import {PremiumDashboard,PremiumLeads,PremiumContacts,PremiumWhatsApp} from './PremiumOperation';
import {PremiumReports,PremiumSettings} from './PremiumReporting';
import MotionCalendar from './MotionCalendar';
import NexusCommandMenu from './NexusCommandMenu';
import NexusAutomations from './NexusAutomations';
import NexusWhatsAppInbox from './NexusWhatsAppInbox';
import NexusAIInsights from './NexusAIInsights';
import NexusPersonalChat from './NexusPersonalChat';
import NexusDirectWhatsApp from './NexusDirectWhatsApp';
import NexusMetaAds from './NexusMetaAds';

const MENU=[
  {path:'dashboard',label:'Visão geral',icon:LayoutDashboard},
  {path:'leads',label:'Leads',icon:UsersRound},
  {path:'contacts',label:'Contatos',icon:ContactRound},
  {path:'whatsapp',label:'WhatsApp',icon:MessageCircle},
  {path:'ads',label:'Meta Ads',icon:TrendingUp},
  {path:'automations',label:'Automações',icon:Workflow},
  {path:'insights',label:'Copiloto IA',icon:Sparkles},
  {path:'agenda',label:'Agenda',icon:CalendarDays},
  {path:'tasks',label:'Minhas tarefas',icon:ListTodo},
  {path:'reports',label:'Relatórios',icon:Activity},
  {path:'settings',label:'Configurações',icon:ShieldCheck},
  {path:'minha-area',label:'Meu perfil',icon:UserRound}
];
const PAGES={dashboard:'Visão geral',leads:'Leads',contacts:'Contatos',whatsapp:'WhatsApp direto','whatsapp-oficial':'WhatsApp oficial',ads:'Meta Ads',automations:'Automações',insights:'Meu copiloto', 'insights-analise':'Análises IA',agenda:'Agenda',tasks:'Minhas tarefas',reports:'Relatórios',settings:'Configurações','minha-area':'Meu perfil'};
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

export default function StaffWorkspace({section,session,profile,organizations,members,organizationId,onOrganizationChange,onSignOut,dark,onToggleTheme,isSuperAdmin=false}) {
  const [data,setData]=useState({leads:[],tasks:[],contacts:[],appointments:[],sales:[]});
  const [counts,setCounts]=useState({leads:0,contacts:0,appointments:0,sales:0,tasks:0});
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [search,setSearch]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const [taskTitle,setTaskTitle]=useState('');
  const [taskPriority,setTaskPriority]=useState('medium');
  const [taskDueDate,setTaskDueDate]=useState('');
  const [appointmentTitle,setAppointmentTitle]=useState('');
  const [appointmentStart,setAppointmentStart]=useState('');
  const [appointmentType,setAppointmentType]=useState('meeting');
  const [appointmentLocation,setAppointmentLocation]=useState('');
  const [stages,setStages]=useState([]);
  const [appointmentFilter,setAppointmentFilter]=useState('upcoming');
  const [taskFilter,setTaskFilter]=useState('open');
  const [period,setPeriod]=useState(30);
  const [mobileOpen,setMobileOpen]=useState(false);
  const router=useRouter();
  const navTimer=useRef(null);
  const [navigationOut,setNavigationOut]=useState(false);
  const [motionReplay,setMotionReplay]=useState(0);
  const [commandOpen,setCommandOpen]=useState(false);
  const [tourLoading,setTourLoading]=useState(false);
  const spotlight=(event)=>{
    const surface=event.target?.closest?.('.nxp-metric,.nxp-surface,.nxp-contact-card,.nxp-lead-card');
    if(!surface)return;
    const bounds=surface.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    surface.style.setProperty('--pointer-x',((event.clientX-bounds.left)/bounds.width*100)+'%');
    surface.style.setProperty('--pointer-y',((event.clientY-bounds.top)/bounds.height*100)+'%');
  };
  const [lastSync,setLastSync]=useState(null);
  const [globalSearch,setGlobalSearch]=useState('');
  const [searchOpen,setSearchOpen]=useState(false);
  const [notificationsOpen,setNotificationsOpen]=useState(false);
  useEffect(()=>()=>{if(navTimer.current)clearTimeout(navTimer.current)},[]);
  useEffect(()=>{setNavigationOut(false)},[section]);
  const navigate=(event,path)=>{
    if(path===section||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey){
      setMobileOpen(false);return;
    }
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches){setMobileOpen(false);return;}
    event.preventDefault();
    setMobileOpen(false);
    setNavigationOut(true);
    if(navTimer.current)clearTimeout(navTimer.current);
    navTimer.current=setTimeout(()=>router.push('/'+path),165);
  };
  const startTour=async()=>{
    if(tourLoading)return;
    setTourLoading(true);
    try{
      const {driver}=await import('driver.js');
      const candidates=[
        {selector:'.staff-logo',title:'Bem-vindo ao NEXUS',detail:'Seu espaço para organizar leads, contatos, tarefas e resultados.'},
        {selector:'.staff-workspace-picker',title:'Sua empresa',detail:'Os dados são separados por empresa. Se você tiver mais de uma, selecione o espaço correto.'},
        {selector:'.staff-nav',title:'Menu de trabalho',detail:'Acesse o funil, a agenda, seus contatos, relatórios e configurações.'},
        {selector:'.staff-command-trigger',title:'Comandos rápidos',detail:'Use Ctrl + K (ou ⌘ + K no Mac) para navegar, pesquisar e executar ações.'},
        {selector:'.staff-global-search',title:'Busca da operação',detail:'Localize leads, contatos e tarefas carregados para a empresa selecionada.'},
        {selector:'.nxp-metrics',title:'Indicadores reais',detail:'Acompanhe os números do Supabase e escolha o período da análise.'},
        {selector:'.nxp-graph-panel',title:'Gráficos animados',detail:'Visualize a evolução dos leads, com informações de cada ponto do gráfico.'},
        {selector:'.staff-notification-control',title:'Notificações',detail:'Veja tarefas vencidas e compromissos próximos quando houver pendências.'}
      ];
      const steps=candidates.filter(item=>{
        const el=document.querySelector(item.selector);
        if(!el)return false;
        const r=el.getBoundingClientRect();
        return r.width>0&&r.height>0&&r.right>0&&r.left<window.innerWidth;
      }).map(item=>({
        element:item.selector,
        popover:{title:item.title,description:item.detail,side:'bottom',align:'start'}
      }));
      if(!steps.length){setNotice('Nenhuma área disponível para o tour nesta tela.');return}
      driver({
        showProgress:true,
        allowClose:true,
        overlayOpacity:.67,
        stagePadding:9,
        stageRadius:16,
        popoverClass:'nexus-tour-popover',
        nextBtnText:'Próximo',
        prevBtnText:'Voltar',
        doneBtnText:'Concluir',
        progressText:'{{current}} de {{total}}',
        steps
      }).drive();
    }catch(e){setError('Não foi possível abrir o tour: '+e.message)}
    finally{setTourLoading(false)}
  };
  const currentOrganization=organizations.find(o=>o.id===organizationId);
  const activeMember=members.find(m=>m.organization_id===organizationId&&m.status==='active');
  const role=isSuperAdmin?'AGENCY_ADMIN':(activeMember?.role||'');
  const readonly=role==='VIEWER';
  const validOrg=Boolean(currentOrganization&&currentOrganization.status==='active'&&(isSuperAdmin||activeMember)&&session?.id&&profile?.status==='active');
  const roleLabel=ROLES[role]||'Colaborador';
  const page=PAGES[section]||'Visão geral';

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const initial=['leads','contacts','tasks'].includes(section)?(params.get('q')||''):'';
    setSearch(initial);setStatusFilter('all');setMobileOpen(false);
    setSearchOpen(false);setNotificationsOpen(false);
    if(section==='tasks'&&params.has('new')){
      const timeout=setTimeout(()=>{
        document.querySelector('input[aria-label="Título da tarefa"]')?.focus();
      },200);
      return ()=>clearTimeout(timeout);
    }
  },[section,organizationId]);
  useEffect(()=>{
    const onEscape=e=>{
      if(e.key==='Escape'){
        setMobileOpen(false);setSearchOpen(false);setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown',onEscape);
    return ()=>window.removeEventListener('keydown',onEscape);
  },[]);
  useEffect(()=>{
    if(!notice)return;
    const timeout=setTimeout(()=>setNotice(''),5400);
    return ()=>clearTimeout(timeout);
  },[notice]);
  const operation=useCallback(async(payload=null)=>{
    if(!db)throw new Error('Conexão com Supabase indisponível.');
    const {data:{session:authSession},error:sessionError}=await db.auth.getSession();
    if(sessionError||!authSession?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
    const method=payload?'POST':'GET';
    const response=await fetch(payload?'/api/operation':'/api/operation?org_id='+encodeURIComponent(organizationId),{
      method,
      headers:{Authorization:'Bearer '+authSession.access_token,...(payload?{'Content-Type':'application/json'}:{})},
      ...(payload?{body:JSON.stringify({org_id:organizationId,...payload})}:{})
    });
    const result=await response.json().catch(()=>null);
    if(!response.ok)throw new Error(result?.error||'Falha de comunicação com o servidor.');
    return result;
  },[organizationId]);
  const load=useCallback(async()=>{
    if(!validOrg){
      setData({leads:[],tasks:[],contacts:[],appointments:[],sales:[]});
      setCounts({leads:0,contacts:0,appointments:0,sales:0,tasks:0});
      setStages([]);setLoading(false);return;
    }
    setLoading(true);setError('');
    try{
      const result=await operation();
      setData(result.data||{leads:[],tasks:[],contacts:[],appointments:[],sales:[]});
      setCounts(result.counts||{leads:0,contacts:0,appointments:0,sales:0,tasks:0});
      setStages(result.stages||[]);
      if(result.warnings?.length)setError('Algumas informações não puderam ser carregadas: '+result.warnings.join(' · '));
      setLastSync(new Date());
    }catch(e){setError('Não foi possível carregar a empresa: '+e.message)}
    finally{setLoading(false)}
  },[validOrg,operation]);
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
    e.preventDefault();
    if(!validOrg||readonly||!taskTitle.trim()||saving)return;
    setSaving(true);setError('');setNotice('');
    try{
      const res=await operation({action:'task_create',title:taskTitle.trim(),priority:taskPriority,due_date:taskDueDate||null});
      setTaskTitle('');setTaskDueDate('');setTaskPriority('medium');
      await load();setNotice(res.message||'Tarefa criada.');
    }catch(e){setError('Não foi possível criar a tarefa: '+e.message)}
    finally{setSaving(false)}
  }
  async function changeTask(t){
    if(!validOrg||readonly||saving)return;
    setSaving(true);setError('');setNotice('');
    const complete=!['completed','done'].includes(String(t.status||'').toLowerCase());
    try{
      const res=await operation({action:'task_status',id:t.id,status:complete?'completed':'pending'});
      await load();setNotice(res.message||'Tarefa atualizada.');
    }catch(e){setError('Não foi possível atualizar a tarefa: '+e.message)}
    finally{setSaving(false)}
  }
  async function createAppointment(e){
    e.preventDefault();
    if(!validOrg||readonly||saving||!appointmentStart||!appointmentTitle.trim())return;
    setSaving(true);setError('');setNotice('');
    try{
      const start=new Date(appointmentStart).toISOString();
      const res=await operation({action:'appointment_create',title:appointmentTitle.trim(),start_at:start,type:appointmentType,location:appointmentLocation.trim()});
      setAppointmentTitle('');setAppointmentStart('');setAppointmentLocation('');
      await load();setNotice(res.message||'Agendamento criado.');
    }catch(e){setError('Falha ao agendar: '+e.message)}
    finally{setSaving(false)}
  }
  async function updateAppointment(a,next){
    if(!validOrg||readonly||saving)return;
    setSaving(true);setError('');setNotice('');
    try{
      const res=await operation({action:'appointment_status',id:a.id,status:next});
      await load();setNotice(res.message||'Agendamento atualizado.');
    }catch(e){setError('Falha ao atualizar agendamento: '+e.message)}
    finally{setSaving(false)}
  }
  const globalResults=useMemo(()=>{
    const q=globalSearch.trim().toLocaleLowerCase('pt-BR');
    if(q.length<2)return [];
    const leadMatches=data.leads.filter(l=>
      [nameOf(l.contact),l.contact?.whatsapp,l.source,l.status].join(' ').toLocaleLowerCase('pt-BR').includes(q))
      .slice(0,4).map(l=>({key:'lead-'+l.id,label:nameOf(l.contact),detail:'Lead · '+(l.source||'Sem origem'),href:'/leads?q='+encodeURIComponent(nameOf(l.contact))}));
    const contactMatches=data.contacts.filter(c=>
      [nameOf(c),c.whatsapp].join(' ').toLocaleLowerCase('pt-BR').includes(q))
      .slice(0,4).map(c=>({key:'contact-'+c.id,label:nameOf(c),detail:'Contato · '+(c.whatsapp||'Sem telefone'),href:'/contacts?q='+encodeURIComponent(nameOf(c))}));
    const taskMatches=data.tasks.filter(t=>t.title?.toLocaleLowerCase('pt-BR').includes(q))
      .slice(0,4).map(t=>({key:'task-'+t.id,label:t.title,detail:'Tarefa',href:'/tasks?q='+encodeURIComponent(t.title)}));
    return [...leadMatches,...contactMatches,...taskMatches].slice(0,9);
  },[globalSearch,data.leads,data.contacts,data.tasks]);
  const alerts=useMemo(()=>{
    const upcoming=data.appointments.filter(a=>a.start_at&&
      new Date(a.start_at).getTime()>Date.now()&&new Date(a.start_at).getTime()<Date.now()+86400000&&
      !['completed','cancelled'].includes(a.status));
    return [
      ...(overdueTasks.length?[{key:'tasks',text:overdueTasks.length+' tarefa(s) com prazo vencido',href:'/tasks'}]:[]),
      ...(upcoming.length?[{key:'agenda',text:upcoming.length+' compromisso(s) nas próximas 24 horas',href:'/agenda'}]:[])
    ];
  },[data.appointments,overdueTasks]);
  // Query-string filters are handled together with route changes above.
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
    <NexusCommandMenu open={commandOpen} onOpenChange={setCommandOpen}
      dark={dark} onTheme={onToggleTheme}
      isSuperAdmin={isSuperAdmin}
      leads={data.leads} contacts={data.contacts} tasks={data.tasks}
      onNavigate={(path,query,mode)=>{
        const target='/'+path+(query?'?q='+encodeURIComponent(query):mode==='new'?'?new=1':'');
        if(path===section){
          if(query){
            setSearch(query);
            if(path==='contacts')window.dispatchEvent(new CustomEvent('nexus:contact-filter',{detail:{query}}));
          }
          if(mode==='new'&&path==='contacts')window.dispatchEvent(new Event('nexus:new-contact'));
          if(mode==='new'&&path==='tasks')document.querySelector('input[aria-label="Título da tarefa"]')?.focus();
        }
        router.push(target);
      }}
      onRefresh={()=>{load()}}
      onReplay={()=>{if(section==='dashboard')setMotionReplay(v=>v+1);else router.push('/dashboard')}}
    />
    <aside className={'staff-sidebar '+(mobileOpen?'staff-sidebar--open':'')}>
      <div className="staff-logo"><div className="staff-logo-icon"><Layers3 size={23}/></div><div><strong>NEXUS <span>CRM</span></strong><small>WORKSPACE</small></div><button className="staff-hide-menu" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"><X size={18}/></button></div>
      <div className="staff-workspace-picker"><span className="staff-workspace-icon"><BriefcaseBusiness size={20}/></span><div><small>SEU ESPAÇO</small><strong>{currentOrganization?.name||'Sem empresa'}</strong></div>{organizations.length>1&&<ChevronDown size={15}/>}</div>
      {organizations.length>1&&<label className="staff-company-choice"><span>Alternar empresa</span><select value={organizationId} onChange={e=>onOrganizationChange(e.target.value)}>{organizations.filter(c=>c.status==='active').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      <div className="staff-nav-title">MENU PRINCIPAL</div>
      <nav aria-label="Área de trabalho" className="staff-nav">
        {MENU.map(({path,label,icon:Icon})=><Link key={path} href={'/'+path} onClick={e=>navigate(e,path)} className={'staff-nav-item '+(section===path?'staff-nav-item--active':'')} aria-current={section===path?'page':undefined}><Icon size={19} strokeWidth={1.9}/><span>{label}</span>{section===path&&<span className="staff-nav-dot"/>}</Link>)}
        {isSuperAdmin&&<Link href="/admin" className="staff-nav-item staff-super-admin-link"><ShieldCheck size={19}/><span>Painel Super Admin</span><ArrowUpRight size={15}/></Link>}
      </nav>
      <div className="staff-sidebar-footer"><div className="staff-session"><Initials name={displayName}/><div><strong>{displayName}</strong><small>{roleLabel}</small></div></div><button type="button" className="staff-logout" onClick={onSignOut}><LogOut size={17}/> Sair da conta</button></div>
    </aside>
    {mobileOpen&&<button className="staff-mobile-overlay" onClick={()=>setMobileOpen(false)} aria-label="Fechar navegação"/>}
    <main className="staff-main">
      <header className="staff-topbar">
        <div className="staff-topbar-left">
          <IconButton icon={Menu} title="Abrir menu" onClick={()=>setMobileOpen(true)}/>
          <div className="staff-breadcrumb"><span>NEXUS / Workspace</span><ChevronRight size={15}/><strong>{page}</strong></div>
        </div>
        <div className="staff-topbar-right">
          <button type="button" className="staff-tour-button" onClick={startTour} disabled={tourLoading}
            title="Conhecer a plataforma em um tour interativo" aria-label="Iniciar tour do CRM">
            <Compass size={16}/><span>Tour</span>
          </button>
          <button type="button" className="staff-command-trigger" onClick={()=>setCommandOpen(true)}
            aria-label="Abrir paleta de comandos Ctrl K" title="Comandos rápidos (Ctrl + K)">
            <Zap size={16}/><span>Comandos</span><kbd>Ctrl K</kbd>
          </button>
          <div className="staff-global-search">
            <Search size={16}/>
            <input type="search" aria-label="Busca geral de leads, contatos e tarefas" placeholder="Buscar em sua operação..."
              value={globalSearch} onFocus={()=>setSearchOpen(true)}
              onChange={e=>{setGlobalSearch(e.target.value);setSearchOpen(true)}}/>
            <span className="staff-search-hint">Busca rápida</span>
            {searchOpen&&globalSearch.trim().length>=2&&<div className="staff-search-results" role="region" aria-label="Resultados da busca">
              <div className="staff-popover-title">RESULTADOS DA EMPRESA</div>
              {globalResults.map(item=><Link href={item.href} key={item.key} onClick={()=>{setSearchOpen(false);setGlobalSearch('')}}>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span><ChevronRight size={15}/>
              </Link>)}
              {!globalResults.length&&<p>Nenhum resultado entre os registros carregados.</p>}
              <button type="button" onClick={()=>setSearchOpen(false)}>Fechar busca</button>
            </div>}
          </div>
          <span className="staff-connected"><span/> Operação ativa</span>
          <div className="staff-notification-control">
            <button type="button" className="staff-icon-button" onClick={()=>{setNotificationsOpen(v=>!v);setSearchOpen(false)}} aria-label="Abrir notificações" aria-expanded={notificationsOpen}>
              <Bell size={18}/>
              {alerts.length>0&&<span className="staff-notification-indicator">{alerts.length}</span>}
            </button>
            {notificationsOpen&&<div className="staff-notification-panel">
              <div className="staff-popover-title">NOTIFICAÇÕES DA OPERAÇÃO</div>
              {alerts.length?alerts.map(item=><Link key={item.key} href={item.href} onClick={()=>setNotificationsOpen(false)}>
                <Bell size={16}/><span>{item.text}</span><ArrowRight size={15}/>
              </Link>):<p>Sem pendências urgentes nos registros carregados.</p>}
              <button type="button" onClick={()=>setNotificationsOpen(false)}>Fechar notificações</button>
            </div>}
          </div>
          {section==='dashboard'&&<button type="button" className="staff-replay-button" onClick={()=>setMotionReplay(v=>v+1)} title="Reproduzir as animações do dashboard"><Play size={15} fill="currentColor"/> <span>Rever efeitos</span></button>}
          <IconButton icon={RefreshCw} title="Atualizar dados" disabled={loading} onClick={load}/>
          <IconButton icon={dark?Sun:Moon} title="Alternar tema" onClick={onToggleTheme}/>
          <div className="staff-top-avatar" title={displayName}><Initials name={displayName}/></div>
        </div>
      </header>
      <div className="staff-body">
        <div key={section+'-'+organizationId+'-'+motionReplay} onPointerMove={spotlight} className={'staff-motion-scene staff-motion-scene--'+section+(navigationOut?' staff-motion-scene--leaving':'')}>
        {!assigned?<div className="staff-no-access"><span><BriefcaseBusiness size={30}/></span><h2>Seu espaço de trabalho ainda não foi liberado.</h2><p>{isSuperAdmin?'Selecione uma empresa ativa no painel Super Admin para acompanhar a operação.':'Peça ao responsável para vincular seu usuário a uma empresa ativa em Super Admin → Acessos.'}</p>{isSuperAdmin&&<Link className="staff-btn staff-btn--primary" href="/admin">Selecionar empresa <ArrowRight size={16}/></Link>}<button className="staff-btn staff-btn--outline" onClick={onSignOut}>Sair da conta</button></div>:<>
        {error&&<div className="staff-alert staff-alert--error" role="alert">{error}</div>}
        {notice&&!error&&<div className="staff-v4-toast" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={17}/></button></div>}

        {section==='dashboard'&&<PremiumDashboard
          data={data} counts={counts} loading={loading}
          organizationName={currentOrganization.name} firstName={firstName}
          openTasks={openTasks} overdueTasks={overdueTasks} lastSync={lastSync} pipelineStages={stages}
        />}
        {section==='leads'&&<PremiumLeads
          leads={data.leads} count={counts.leads} organizationId={organizationId}
          readonly={readonly} stages={stages} onOperation={operation} onReload={load}
        />}
        {section==='contacts'&&<PremiumContacts contacts={data.contacts} count={counts.contacts} readonly={readonly} onOperation={operation} onReload={load}/>}
        {section==='whatsapp'&&<NexusDirectWhatsApp organizationId={organizationId}/>}
        {section==='whatsapp-oficial'&&<NexusWhatsAppInbox
          organizationId={organizationId} contacts={data.contacts} isSuperAdmin={isSuperAdmin}
        />}
        {section==='ads'&&<NexusMetaAds organizationId={organizationId}/>}
        {section==='automations'&&<NexusAutomations
          organizationId={organizationId} stages={stages} readonly={readonly}
        />}
        {section==='insights'&&<NexusPersonalChat organizationId={organizationId}/>}
        {section==='insights-analise'&&<NexusAIInsights organizationId={organizationId}/>}

        {section==='reports'&&<PremiumReports data={data} counts={counts} orgName={currentOrganization.name} readonly={readonly}/>}
        {section==='settings'&&<PremiumSettings profile={profile} session={session} role={roleLabel} organization={currentOrganization} onTheme={onToggleTheme} dark={dark}/>}
        {section==='tasks'&&<>
          <div className="staff-page-header"><div><span className="staff-kicker">ORGANIZAÇÃO / ROTINA</span><h1>Minhas tarefas</h1><p>Organize as atividades da sua empresa e mantenha tudo em dia.</p></div><span className="staff-page-counter">{openTasks.length} em aberto</span></div>
          <section className="staff-card staff-task-page">
            {!readonly&&<form className="staff-new-task" onSubmit={createTask}>
              <span className="staff-new-task-icon"><ListTodo size={19}/></span>
              <input placeholder="O que precisa ser feito?" aria-label="Título da tarefa" required minLength={2} maxLength={190} value={taskTitle} onChange={e=>setTaskTitle(e.target.value)}/>
              <select className="staff-quick-field" value={taskPriority} onChange={e=>setTaskPriority(e.target.value)} aria-label="Prioridade">
                <option value="low">Baixa</option><option value="medium">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
              </select>
              <input className="staff-date-input" type="date" value={taskDueDate} onChange={e=>setTaskDueDate(e.target.value)} aria-label="Prazo da tarefa"/>
              <button disabled={saving||taskTitle.trim().length<2} type="submit" className="staff-btn staff-btn--primary">
                <Plus size={18}/>{saving?'Salvando...':'Adicionar tarefa'}
              </button>
            </form>}
            {readonly&&<div className="staff-readonly"><ShieldCheck size={18}/> Seu perfil é somente leitura. Você pode acompanhar tarefas, mas não editá-las.</div>}
            <div className="staff-data-controls staff-task-controls"><div className="staff-switch">{[['open','Em aberto'],['done','Concluídas'],['all','Todas']].map(([id,label])=><button key={id} onClick={()=>setTaskFilter(id)} className={taskFilter===id?'active':''}>{label}</button>)}</div><label className="staff-search"><Search size={17}/><input placeholder="Buscar tarefa" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
            <div className="staff-task-list">{filteredTasks.map(t=><div key={t.id} className="staff-task-row"><button type="button" disabled={readonly||saving} className={'staff-task-check '+(['completed','done'].includes(String(t.status||'').toLowerCase())?'staff-task-check--done':'')} onClick={()=>changeTask(t)} title="Alterar status da tarefa"><Check size={15}/></button><div className="staff-task-copy"><strong className={['completed','done'].includes(String(t.status||'').toLowerCase())?'staff-task-complete':''}>{t.title}</strong><small>{t.due_date?'Prazo: '+date(t.due_date):'Sem prazo definido'}{t.priority?' · Prioridade: '+formatStatus(t.priority):''}</small></div><Chip value={t.status}/></div>)}</div>
            {!filteredTasks.length&&<Empty icon={CheckCircle2} title="Nenhuma tarefa nesta lista" description="Altere o filtro ou cadastre uma nova tarefa."/>}
          </section>
        </>}

        {section==='agenda'&&<>
          <div className="staff-page-header"><div><span className="staff-kicker">COMPROMISSOS</span><h1>Agenda da operação</h1><p>Crie compromissos reais e acompanhe os agendamentos da empresa.</p></div><span className="staff-page-counter">{number(counts.appointments)} agendamentos</span></div>
          <MotionCalendar appointments={data.appointments} readonly={readonly} onPick={day=>{
            setAppointmentStart(day+'T09:00');
            document.getElementById('staff-agenda-form')?.scrollIntoView({behavior:'smooth',block:'center'});
          }}/>
          {!readonly&&<section className="staff-card staff-agenda-create" id="staff-agenda-form">
            <div className="staff-card-heading"><div><h3>Novo agendamento</h3><p>Registre um compromisso no calendário da empresa.</p></div><CalendarDays size={20}/></div>
            <form className="staff-agenda-form" onSubmit={createAppointment}>
              <label>Título<input required minLength={2} maxLength={190} placeholder="Ex.: Reunião com cliente" value={appointmentTitle} onChange={e=>setAppointmentTitle(e.target.value)}/></label>
              <label>Data e horário<input required type="datetime-local" value={appointmentStart} onChange={e=>setAppointmentStart(e.target.value)}/></label>
              <label>Tipo<select value={appointmentType} onChange={e=>setAppointmentType(e.target.value)}>
                <option value="meeting">Reunião</option><option value="call">Ligação</option><option value="followup">Retorno</option><option value="visit">Visita</option><option value="consultation">Consulta</option><option value="exam">Exame</option>
              </select></label>
              <label>Local (opcional)<input maxLength={220} placeholder="Online ou endereço" value={appointmentLocation} onChange={e=>setAppointmentLocation(e.target.value)}/></label>
              <button className="staff-btn staff-btn--primary" disabled={saving||!appointmentTitle.trim()||!appointmentStart} type="submit"><Plus size={17}/>{saving?'Salvando...':'Agendar compromisso'}</button>
            </form>
          </section>}
          <section className="staff-card staff-data-card">
            <div className="staff-card-heading staff-appointment-heading"><div><h3>Agendamentos da empresa</h3><p>Os registros são salvos no Supabase, não no Google Calendar.</p></div>
              <div className="staff-switch">{[['upcoming','Próximos'],['all','Todos']].map(([id,v])=><button type="button" className={appointmentFilter===id?'active':''} key={id} onClick={()=>setAppointmentFilter(id)}>{v}</button>)}</div>
            </div>
            <div className="staff-appointment-list">{data.appointments.filter(a=>appointmentFilter==='all'||(a.start_at&&new Date(a.start_at).getTime()>=Date.now()&&!['cancelled','completed'].includes(a.status))).map(a=><div className="staff-appointment-row" key={a.id}>
              <span className="staff-appointment-icon"><CalendarDays size={21}/></span><div><strong>{a.title||'Agendamento'}</strong><small>{dayTime(a.start_at)}{a.location?' · '+a.location:''}</small></div>
              <Chip value={a.status}/>
              {!readonly&&<select className="staff-appt-status" aria-label={'Status de '+a.title} value={a.status||'scheduled'} disabled={saving} onChange={e=>updateAppointment(a,e.target.value)}>
                <option value="scheduled">Agendado</option><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option><option value="no_show">Não compareceu</option>
              </select>}
            </div>)}</div>
            {!data.appointments.filter(a=>appointmentFilter==='all'||(a.start_at&&new Date(a.start_at).getTime()>=Date.now()&&!['cancelled','completed'].includes(a.status))).length&&<Empty icon={CalendarDays} title="Nenhum agendamento neste filtro" description="Crie um agendamento ou escolha a opção Todos."/>}
            <div className="staff-table-footer">Agenda interna do NEXUS CRM. Sincronização externa depende de uma integração autorizada.</div>
          </section>
        </>}

        {section==='minha-area'&&<>
          <div className="staff-page-header"><div><span className="staff-kicker">MINHA CONTA</span><h1>Meu espaço</h1><p>Seu perfil e as empresas que você pode acessar.</p></div></div>
          <div className="staff-profile-grid"><section className="staff-card staff-profile-card"><span className="staff-profile-avatar"><Initials name={displayName}/></span><h2>{displayName}</h2><p>{session.email}</p><span className="staff-profile-role"><ShieldCheck size={16}/>{roleLabel}</span><div className="staff-profile-info"><div><span>Conta</span><strong>Ativa</strong></div><div><span>Empresa selecionada</span><strong>{currentOrganization.name}</strong></div><div><span>Nível de acesso</span><strong>{roleLabel}</strong></div></div></section>
          <section className="staff-card staff-profile-card"><h3>Empresas vinculadas</h3><p>Você só acessa operações autorizadas.</p>{organizations.filter(x=>x.status==='active').map(o=><div key={o.id} className="staff-linked-org"><span className="staff-linked-icon"><BriefcaseBusiness size={20}/></span><span><strong>{o.name}</strong><small>{ROLES[members.find(m=>m.organization_id===o.id)?.role]||'Colaborador'}</small></span>{o.id===organizationId&&<CheckCircle2 size={18}/>}</div>)}</section></div>
        </>}
        </>}
        </div>
      </div>
    </main>
  </div>;
}
