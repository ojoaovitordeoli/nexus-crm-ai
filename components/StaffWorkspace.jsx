'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {
  Activity,ArrowRight,ArrowUpRight,Bell,BriefcaseBusiness,CalendarDays,Compass,
  Check,CheckCircle2,ChevronDown,ChevronRight,Clock3,ContactRound,Flame,
  LayoutDashboard,Layers3,ListTodo,LogOut,Menu,MessageCircle,Minus,Workflow,Sparkles,
  Moon,Plus,Play,RefreshCw,Search,ShieldCheck,Sun,TrendingUp,
  ReceiptText,UserRound,UsersRound,X,Zap
} from 'lucide-react';
import {db} from '../lib/supabase';
import {dueDayKey,dueDate,contactSearchTerm} from '../lib/shell-rules.mjs';
import {PremiumLeads,PremiumContacts,PremiumWhatsApp} from './PremiumOperation';
import NexusExecutiveHome from './NexusExecutiveHome';
import {PremiumReports,PremiumSettings} from './PremiumReporting';
import MotionCalendar from './MotionCalendar';
import NexusCommandMenu from './NexusCommandMenu';
import NexusAutomations from './NexusAutomations';
import NexusWhatsAppInbox from './NexusWhatsAppInbox';
import NexusAIInsights from './NexusAIInsights';
import PremiumSales from './PremiumSales';

const MENU=[
  {path:'dashboard',label:'Visão geral',icon:LayoutDashboard},
  {path:'leads',label:'Leads',icon:UsersRound},
  {path:'sales',label:'Vendas',icon:ReceiptText},
  {path:'contacts',label:'Contatos',icon:ContactRound},
  {path:'whatsapp',label:'WhatsApp',icon:MessageCircle},
  {path:'automations',label:'Automações',icon:Workflow},

  {path:'agenda',label:'Agenda',icon:CalendarDays},
  {path:'tasks',label:'Minhas tarefas',icon:ListTodo},
  {path:'reports',label:'Relatórios',icon:Activity},
  {path:'settings',label:'Configurações',icon:ShieldCheck},
  {path:'minha-area',label:'Meu perfil',icon:UserRound}
]; 
const NAV_GROUPS=[
  {title:'Comercial',paths:['dashboard','leads','sales','contacts']},
  {title:'Atendimento',paths:['whatsapp','agenda','tasks']},
  {title:'Gestão',paths:['reports','automations','settings','minha-area']}
];
const PAGES={dashboard:'Visão geral',leads:'Leads',sales:'Vendas',contacts:'Contatos',whatsapp:'WhatsApp',automations:'Automações',insights:'Copiloto IA',agenda:'Agenda',tasks:'Minhas tarefas',reports:'Relatórios',settings:'Configurações','minha-area':'Meu perfil'};
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
const localDayKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const dueKey=t=>dueDayKey(t?.due_date);
const APPT_TYPES={meeting:'Reunião',call:'Ligação',followup:'Retorno',visit:'Visita',consultation:'Consulta',exam:'Exame'};
const STATUS_PT={pending:'Pendente',in_progress:'Em andamento',completed:'Concluída',done:'Concluída',cancelled:'Cancelado',canceled:'Cancelado',scheduled:'Agendado',confirmed:'Confirmado',no_show:'Não compareceu',low:'Baixa',medium:'Normal',high:'Alta',urgent:'Urgente',new:'Novo',open:'Em aberto',waiting:'Aguardando',overdue:'Vencida'};
const formatStatus=s=>STATUS_PT[String(s||'').toLowerCase()]||String(s||'Sem etapa').replace(/[_-]/g,' ').replace(/\b\w/g,l=>l.toUpperCase());
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
  const [pipeline,setPipeline]=useState(null);
  const [pipelines,setPipelines]=useState([]);
  const [allStages,setAllStages]=useState([]);
  const [appointmentFilter,setAppointmentFilter]=useState('upcoming');
  const [taskFilter,setTaskFilter]=useState('open');
  const [taskFormOpen,setTaskFormOpen]=useState(false);
  const [appointmentFormOpen,setAppointmentFormOpen]=useState(false);
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
  const rippleOnPointerDown=useCallback((event)=>{
    if(event.button!==0||window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
    const control=event.target?.closest?.('.staff-nav-item,.n9-kpi,.n9-primary-button,.n9-period button,.w10-pills button,.v11-date-pills button,.nxp-button,.staff-command-trigger,.staff-icon-button,.nxp-lead-card-main');
    if(!control||!event.currentTarget.contains(control)||control.disabled)return;
    const bounds=control.getBoundingClientRect();
    if(!bounds.width||!bounds.height)return;
    const ripple=document.createElement('span');
    ripple.className='n9-pointer-ripple';
    ripple.setAttribute('aria-hidden','true');
    ripple.style.left=(event.clientX-bounds.left)+'px';
    ripple.style.top=(event.clientY-bounds.top)+'px';
    ripple.style.setProperty('--n9-ripple-scale',String(Math.ceil(Math.max(bounds.width,bounds.height)/10)*3));
    ripple.addEventListener('animationend',()=>ripple.remove(),{once:true});
    control.appendChild(ripple);
  },[]);
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
  // Espelha a regra do servidor (lib/operation-rules.mjs); a API continua sendo a barreira real.
  const canManagePipeline=['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER'].includes(role);
  const validOrg=Boolean(currentOrganization&&currentOrganization.status==='active'&&(isSuperAdmin||activeMember)&&session?.id&&profile?.status==='active');
  const roleLabel=ROLES[role]||'Colaborador';
  const page=PAGES[section]||'Visão geral';
  const orgName=currentOrganization?.name||'Sem empresa';
  // A lista nativa herdava o texto branco do menu escuro (ilegível no tema claro): cores explícitas por tema.
  const companySelectStyle=dark?{colorScheme:'dark',backgroundColor:'#17171c',color:'#f4f4f6'}:{colorScheme:'light',backgroundColor:'#ffffff',color:'#15151a'};

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    const initial=['leads','contacts','tasks'].includes(section)?(params.get('q')||''):'';
    setSearch(initial);setStatusFilter('all');setMobileOpen(false);
    setSearchOpen(false);setNotificationsOpen(false);
    if(section==='tasks'&&params.has('new')){
      setTaskFormOpen(true);
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
    if(!response.ok){
      const failure=new Error(result?.error||'Falha de comunicação com o servidor.');
      if(Array.isArray(result?.missing))failure.missing=result.missing;
      throw failure;
    }
    return result;
  },[organizationId]);
  const load=useCallback(async(options)=>{
    const silent=options?.silent===true;
    if(!validOrg){
      setData({leads:[],tasks:[],contacts:[],appointments:[],sales:[]});
      setCounts({leads:0,contacts:0,appointments:0,sales:0,tasks:0});
      setStages([]);setPipeline(null);setPipelines([]);setAllStages([]);setLoading(false);return;
    }
    if(!silent){setLoading(true);setError('')}
    try{
      const result=await operation();
      setData(result.data||{leads:[],tasks:[],contacts:[],appointments:[],sales:[]});
      setCounts(result.counts||{leads:0,contacts:0,appointments:0,sales:0,tasks:0});
      setStages(result.stages||[]);
      setPipeline(result.pipeline||null);
      setPipelines(result.pipelines||(result.pipeline?[result.pipeline]:[]));
      setAllStages(result.all_stages||result.stages||[]);
      if(result.warnings?.length)setError('Algumas informações não puderam ser carregadas: '+result.warnings.join(' · '));
      setLastSync(new Date());
    }catch(e){if(!silent)setError('Não foi possível carregar a empresa: '+e.message)}
    finally{if(!silent)setLoading(false)}
  },[validOrg,operation]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>{
    if(!validOrg||!db||!organizationId)return;
    let refreshTimer=null;
    const refresh=()=>{
      if(refreshTimer)clearTimeout(refreshTimer);
      refreshTimer=setTimeout(()=>load({silent:true}),250);
    };
    const channel=db.channel('nexus-live-'+organizationId)
      .on('postgres_changes',{event:'*',schema:'public',table:'leads',filter:'organization_id=eq.'+organizationId},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'sales',filter:'organization_id=eq.'+organizationId},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'appointments',filter:'organization_id=eq.'+organizationId},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'tasks',filter:'organization_id=eq.'+organizationId},refresh)
      .on('postgres_changes',{event:'*',schema:'public',table:'contacts',filter:'organization_id=eq.'+organizationId},refresh)
      .subscribe();
    const onFocus=()=>refresh();
    const onVisibility=()=>{if(document.visibilityState==='visible')refresh()};
    const interval=window.setInterval(refresh,30000);
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisibility);
    return()=>{
      if(refreshTimer)clearTimeout(refreshTimer);
      window.clearInterval(interval);
      window.removeEventListener('focus',onFocus);
      document.removeEventListener('visibilitychange',onVisibility);
      db.removeChannel(channel);
    };
  },[validOrg,organizationId,load]);

  // Visão geral mostra UM funil por vez (o padrão, ou o escolhido no seletor), nunca etapas de funis misturadas.
  const [dashPipelineId,setDashPipelineId]=useState('');
  const dashPipeline=useMemo(()=>pipelines.find(p=>p.id===dashPipelineId)||pipeline||pipelines.find(p=>p.is_default)||pipelines[0]||null,[pipelines,dashPipelineId,pipeline]);
  const dashboardStages=useMemo(()=>dashPipeline&&allStages.some(s=>s.pipeline_id)
    ?allStages.filter(s=>s.pipeline_id===dashPipeline.id)
    :(allStages.length?allStages:stages),[dashPipeline,allStages,stages]);
  const since=useMemo(()=>Date.now()-period*86400000,[period]);
  const recentLeads=useMemo(()=>data.leads.filter(x=>x.created_at&&new Date(x.created_at).getTime()>=since),[data.leads,since]);
  const recentAppointments=useMemo(()=>data.appointments.filter(x=>x.created_at&&new Date(x.created_at).getTime()>=since),[data.appointments,since]);
  const recentSales=useMemo(()=>data.sales.filter(x=>x.created_at&&new Date(x.created_at).getTime()>=since),[data.sales,since]);
  const openTasks=useMemo(()=>data.tasks.filter(t=>!['completed','done','cancelled','canceled'].includes(String(t.status||'').toLowerCase())),[data.tasks]);
  // Vencida = prazo (dia local) anterior a hoje; a tarefa de hoje não conta como vencida.
  const overdueTasks=useMemo(()=>{const todayKey=localDayKey(new Date());return openTasks.filter(t=>{const k=dueKey(t);return k&&k<todayKey})},[openTasks]);
  const statuses=useMemo(()=>[...new Set(data.leads.map(l=>l.status).filter(Boolean))],[data.leads]);
  const filteredLeads=data.leads.filter(l=>{
    const text=[nameOf(l.contact),l.contact?.whatsapp,l.source,l.status].join(' ').toLowerCase();
    return text.includes(search.toLowerCase())&&(statusFilter==='all'||l.status===statusFilter);
  });
  const filteredContacts=data.contacts.filter(c=>[nameOf(c),c.whatsapp].join(' ').toLowerCase().includes(search.toLowerCase()));
  const filteredTasks=data.tasks.filter(t=>{
    const status=String(t.status||'').toLowerCase();
    const done=['completed','done'].includes(status);
    const cancelled=['cancelled','canceled'].includes(status);
    const matches=String(t.title||'').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'));
    // "Em aberto" segue a mesma regra do contador (openTasks): canceladas não são pendências.
    return matches&&(taskFilter==='all'||(taskFilter==='done'?done:!done&&!cancelled));
  });
  const lateTaskCount=useMemo(()=>{const todayKey=localDayKey(new Date());return openTasks.filter(t=>{const k=dueKey(t);return k&&k<todayKey}).length},[openTasks]);
  const taskGroups=useMemo(()=>{
    const todayKey=localDayKey(new Date());const keyOf=dueKey;
    const groups={late:[],today:[],next:[],none:[],done:[]};
    filteredTasks.forEach(t=>{
      if(['completed','done','cancelled','canceled'].includes(String(t.status||'').toLowerCase()))return groups.done.push(t);
      const k=keyOf(t);
      if(!k)groups.none.push(t);else if(k<todayKey)groups.late.push(t);else if(k===todayKey)groups.today.push(t);else groups.next.push(t);
    });
    const byDue=(a,b)=>keyOf(a).localeCompare(keyOf(b));
    groups.late.sort(byDue);groups.next.sort(byDue);
    return [['late','Vencidas',groups.late],['today','Hoje',groups.today],['next','Próximas',groups.next],['none','Sem prazo',groups.none],['done',taskFilter==='done'?'Concluídas':'Concluídas e canceladas',groups.done]].filter(g=>g[2].length);
  },[filteredTasks,taskFilter]);
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
    if(!validOrg||readonly||saving)return;
    setError('');setNotice('');
    if(appointmentTitle.trim().length<2){setError('Informe o título do compromisso (mínimo de 2 caracteres).');return}
    const startDate=new Date(appointmentStart);
    if(!appointmentStart||Number.isNaN(startDate.getTime())){setError('Informe data e horário válidos para o compromisso.');return}
    setSaving(true);
    try{
      const start=startDate.toISOString();
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
      .slice(0,4).map(l=>({key:'lead-'+l.id,label:nameOf(l.contact),detail:'Lead · '+(l.source||'Sem origem'),path:'leads',query:contactSearchTerm(l.contact)}));
    const contactMatches=data.contacts.filter(c=>
      [nameOf(c),c.whatsapp].join(' ').toLocaleLowerCase('pt-BR').includes(q))
      .slice(0,4).map(c=>({key:'contact-'+c.id,label:nameOf(c),detail:'Contato · '+(c.whatsapp||'Sem telefone'),path:'contacts',query:contactSearchTerm(c)}));
    const taskMatches=data.tasks.filter(t=>t.title?.toLocaleLowerCase('pt-BR').includes(q))
      .slice(0,4).map(t=>({key:'task-'+t.id,label:t.title,detail:'Tarefa',path:'tasks',query:t.title}));
    return [...leadMatches,...contactMatches,...taskMatches].slice(0,9);
  },[globalSearch,data.leads,data.contacts,data.tasks]);
  const alerts=useMemo(()=>{
    const upcoming=data.appointments.filter(a=>a.start_at&&
      new Date(a.start_at).getTime()>Date.now()&&new Date(a.start_at).getTime()<Date.now()+86400000&&
      !['completed','cancelled','canceled','no_show'].includes(String(a.status||'').toLowerCase()));
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

  // Abre uma seção com filtro. Na mesma seção o Next não remonta a página, então o filtro
  // precisa ser aplicado aqui (antes, escolher um resultado da busca na própria tela não fazia nada).
  const openSection=(path,query,mode)=>{
    const target='/'+path+(query?'?q='+encodeURIComponent(query):mode==='new'?'?new=1':'');
    setSearchOpen(false);setNotificationsOpen(false);setMobileOpen(false);
    if(path!==section){router.push(target);return}
    window.history.pushState(null,'',target);
    if(query){
      setSearch(query);
      if(path==='contacts')window.dispatchEvent(new CustomEvent('nexus:contact-filter',{detail:{query}}));
      if(path==='leads')setMotionReplay(v=>v+1); // remonta a lista de leads, que lê ?q= ao montar
    }
    if(mode==='new'&&path==='contacts')window.dispatchEvent(new Event('nexus:new-contact'));
    if(mode==='new'&&path==='tasks'){setTaskFormOpen(true);setTimeout(()=>document.querySelector('input[aria-label="Título da tarefa"]')?.focus(),60)}
  };
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

  return <div className="staff-shell" onPointerDown={rippleOnPointerDown}>
    <NexusCommandMenu open={commandOpen} onOpenChange={setCommandOpen}
      dark={dark} onTheme={onToggleTheme}
      isSuperAdmin={isSuperAdmin}
      leads={data.leads} contacts={data.contacts} tasks={data.tasks}
      readonly={readonly}
      onNavigate={openSection}
      onRefresh={()=>{load()}}
      onReplay={()=>{if(section==='dashboard')setMotionReplay(v=>v+1);else router.push('/dashboard')}}
    />
    <aside className={'staff-sidebar '+(mobileOpen?'staff-sidebar--open':'')}>
      <div className="staff-logo"><div className="staff-logo-icon"><Layers3 size={18}/></div><div><strong>NEXUS <span>CRM</span></strong></div><button className="staff-hide-menu" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"><X size={18}/></button></div>
      <div className="staff-workspace-picker"><span className="staff-workspace-icon"><BriefcaseBusiness size={20}/></span><div><small>Empresa atual</small><strong>{currentOrganization?.name||'Sem empresa'}</strong></div>{organizations.length>1&&<ChevronDown size={15}/>}
        {organizations.length>1&&<select className="staff-company-select" aria-label="Alternar empresa" value={organizationId} onChange={e=>onOrganizationChange(e.target.value)} style={companySelectStyle}>{organizations.filter(c=>c.status==='active').map(c=><option key={c.id} value={c.id} style={companySelectStyle}>{c.name}</option>)}</select>}</div>
      <nav aria-label="Área de trabalho" className="staff-nav">
        {NAV_GROUPS.map(group=><div key={group.title} className="staff-nav-group"><div className="staff-nav-title">{group.title}</div>{MENU.filter(item=>group.paths.includes(item.path)).map(({path,label,icon:Icon})=><Link key={path} href={'/'+path} onClick={e=>navigate(e,path)} className={'staff-nav-item '+(section===path?'staff-nav-item--active':'')} aria-current={section===path?'page':undefined}><Icon size={18} strokeWidth={1.7}/><span>{label}</span>{section===path&&<span className="staff-nav-dot"/>}</Link>)}</div>)}
        {isSuperAdmin&&<Link href="/admin" className="staff-nav-item staff-super-admin-link"><ShieldCheck size={19}/><span>Painel Super Admin</span><ArrowUpRight size={15}/></Link>}
      </nav>
      <div className="staff-sidebar-footer"><div className="staff-session"><Initials name={displayName}/><div><strong>{displayName}</strong><small>{roleLabel}</small></div></div><button type="button" className="staff-logout" onClick={onSignOut}><LogOut size={17}/> Sair da conta</button></div>
    </aside>
    {mobileOpen&&<button className="staff-mobile-overlay" onClick={()=>setMobileOpen(false)} aria-label="Fechar navegação"/>}
    <main className="staff-main">
      <header className="staff-topbar">
        <div className="staff-topbar-left">
          <IconButton icon={Menu} title="Abrir menu" onClick={()=>setMobileOpen(true)}/>
          <div className="staff-breadcrumb"><span>{orgName}</span><ChevronRight size={15}/><strong>{page}</strong></div>
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
              {globalResults.map(item=><Link href={'/'+item.path+(item.query?'?q='+encodeURIComponent(item.query):'')} key={item.key} onClick={e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();setGlobalSearch('');openSection(item.path,item.query)}}>
                <span><strong>{item.label}</strong><small>{item.detail}</small></span><ChevronRight size={15}/>
              </Link>)}
              {!globalResults.length&&<p>Nenhum resultado entre os registros carregados.</p>}
              <button type="button" onClick={()=>setSearchOpen(false)}>Fechar busca</button>
            </div>}
          </div>
          <span className="staff-connected"><span/> Empresa selecionada</span>
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
          
          <IconButton icon={RefreshCw} title="Atualizar dados" disabled={loading} onClick={()=>load()}/>
          <IconButton icon={dark?Sun:Moon} title="Alternar tema" onClick={onToggleTheme}/>
          <div className="staff-top-avatar" title={displayName}><Initials name={displayName}/></div>
        </div>
      </header>
      <div className="staff-body">
        <div key={section+'-'+organizationId+'-'+motionReplay} onPointerMove={spotlight} className={'staff-motion-scene staff-motion-scene--'+section+(navigationOut?' staff-motion-scene--leaving':'')}>
        {!assigned?<div className="staff-no-access"><span><BriefcaseBusiness size={30}/></span><h2>Seu espaço de trabalho ainda não foi liberado.</h2><p>{isSuperAdmin?'Selecione uma empresa ativa no painel Super Admin para acompanhar a operação.':'Peça ao responsável para vincular seu usuário a uma empresa ativa em Super Admin → Acessos.'}</p>{isSuperAdmin&&<Link className="staff-btn staff-btn--primary" href="/admin">Selecionar empresa <ArrowRight size={16}/></Link>}<button className="staff-btn staff-btn--outline" onClick={onSignOut}>Sair da conta</button></div>:<>
        {error&&<div className="staff-alert staff-alert--error" role="alert">{error}</div>}
        {notice&&!error&&<div className="staff-v4-toast" role="status"><CheckCircle2 size={18}/><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={17}/></button></div>}

        {section==='dashboard'&&<NexusExecutiveHome
          data={data} counts={counts} loading={loading}
          organizationName={orgName} firstName={firstName}
          openTasks={openTasks} overdueTasks={overdueTasks} lastSync={lastSync} pipelineStages={dashboardStages} pipelines={pipelines} activePipelineId={dashPipeline?.id||''} onPipelineChange={setDashPipelineId}
          onOperation={operation} onReload={load} readonly={readonly}
        />}
        {section==='leads'&&<PremiumLeads
          leads={data.leads} count={counts.leads} organizationId={organizationId} organizationName={orgName}
          readonly={readonly} canManagePipeline={canManagePipeline} stages={stages} pipeline={pipeline} pipelines={pipelines} allStages={allStages} contacts={data.contacts} onOperation={operation} onReload={load}
        />}
        {section==='sales'&&<PremiumSales sales={data.sales} count={counts.sales} readonly={readonly} onOperation={operation} onReload={load}/>}
        {section==='contacts'&&<PremiumContacts contacts={data.contacts} count={counts.contacts} readonly={readonly} onOperation={operation} onReload={load}/>}
        {section==='whatsapp'&&<NexusWhatsAppInbox
          organizationId={organizationId} contacts={data.contacts} isSuperAdmin={isSuperAdmin}
        />}
        {section==='automations'&&<NexusAutomations
          organizationId={organizationId} stages={stages} readonly={readonly}
        />}
        {section==='insights'&&<NexusAIInsights organizationId={organizationId}/>}

        {section==='reports'&&<PremiumReports data={data} counts={counts} orgName={orgName} readonly={readonly}/>}
        {section==='settings'&&<PremiumSettings profile={profile} session={session} role={roleLabel} organization={currentOrganization} onTheme={onToggleTheme} dark={dark}/>}
        {section==='tasks'&&<div className="fx-page fx-tasks">
          <header className="fx-pagehead">
            <div className="fx-pagehead-title"><h1>Minhas tarefas</h1><span className="fx-count">{openTasks.length} em aberto</span>{lateTaskCount>0&&<span className="fx-count fx-count--alert">{lateTaskCount} {lateTaskCount===1?'vencida':'vencidas'}</span>}</div>
            {!readonly&&<div className="fx-actions"><button type="button" className="fx-btn fx-btn--primary" aria-expanded={taskFormOpen} onClick={()=>setTaskFormOpen(v=>!v)}>{taskFormOpen?<><X size={16}/> Fechar</>:<><Plus size={16}/> Adicionar tarefa</>}</button></div>}
          </header>
          {!readonly&&taskFormOpen&&<form className="fx-panel" onSubmit={createTask} aria-label="Nova tarefa">
            <label className="fx-panel-grow">Tarefa<input placeholder="O que precisa ser feito?" aria-label="Título da tarefa" required minLength={2} maxLength={190} value={taskTitle} onChange={e=>setTaskTitle(e.target.value)}/></label>
            <label>Prioridade<select value={taskPriority} onChange={e=>setTaskPriority(e.target.value)} aria-label="Prioridade">
              <option value="low">Baixa</option><option value="medium">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option>
            </select></label>
            <label>Prazo<input type="date" value={taskDueDate} onChange={e=>setTaskDueDate(e.target.value)} aria-label="Prazo da tarefa"/></label>
            <button disabled={saving||taskTitle.trim().length<2} type="submit" className="fx-btn fx-btn--primary">{saving?'Salvando...':'Salvar tarefa'}</button>
          </form>}
          {readonly&&<div className="fx-alert fx-alert--info"><ShieldCheck size={16}/> Seu perfil é somente leitura. Você pode acompanhar tarefas, mas não editá-las.</div>}
          <section className="fx-box">
            <div className="fx-boxhead"><div className="fx-tabs" role="group" aria-label="Filtrar tarefas">{[['open','Em aberto'],['done','Concluídas'],['all','Todas']].map(([id,label])=><button type="button" key={id} aria-pressed={taskFilter===id} onClick={()=>setTaskFilter(id)} className={taskFilter===id?'active':''}>{label}</button>)}</div><label className="fx-search fx-search--end"><Search size={15}/><input placeholder="Buscar tarefa" aria-label="Buscar tarefa" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
            {taskGroups.map(([id,label,items])=><div key={id} className={'fx-group fx-group--'+id}>
              <div className="fx-subhead"><h3>{label}</h3><span className="fx-groupcount">{items.length}</span></div>
              {items.map(t=>{const done=['completed','done'].includes(String(t.status||'').toLowerCase());return <div key={t.id} className={'fx-row fx-taskline'+(id==='late'?' is-late':'')}>
                <button type="button" disabled={readonly||saving} className={'fx-check'+(done?' is-done':'')} onClick={()=>changeTask(t)} title={done?'Reabrir tarefa':'Concluir tarefa'} aria-label={(done?'Reabrir ':'Concluir ')+(t.title||'tarefa')}><Check size={14}/></button>
                <div><strong className={done?'fx-done':''}>{t.title||'Tarefa sem título'}</strong>{t.priority&&['high','urgent'].includes(String(t.priority).toLowerCase())&&<small className="fx-prio">Prioridade {String(t.priority).toLowerCase()==='urgent'?'urgente':'alta'}</small>}</div>
                <span className={id==='late'?'fx-late':'fx-due'}>{dueKey(t)?(id==='today'?'Hoje':dueDate(t.due_date).toLocaleDateString('pt-BR')):'Sem prazo'}</span>
              </div>})}
            </div>)}
            {!filteredTasks.length&&<div className="fx-empty"><strong>{search?'Nenhuma tarefa encontrada':taskFilter==='done'?'Nenhuma tarefa concluída':'Nada pendente'}</strong><p>{search?'Ajuste a busca ou o filtro.':taskFilter==='open'&&!readonly?'Use “Adicionar tarefa” para registrar a próxima atividade.':'Altere o filtro para ver outras tarefas.'}</p></div>}
          </section>
        </div>}

        {section==='agenda'&&(()=>{
          const now=new Date();const pad=v=>String(v).padStart(2,'0');
          const keyOf=v=>{const d=new Date(v);return [d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-')};
          const todayKey=keyOf(now);
          const todays=data.appointments.filter(a=>a.start_at&&keyOf(a.start_at)===todayKey).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at));
          const upcoming=data.appointments.filter(a=>appointmentFilter==='all'||(a.start_at&&new Date(a.start_at).getTime()>=Date.now()&&keyOf(a.start_at)!==todayKey&&!['cancelled','completed'].includes(a.status))).sort((a,b)=>new Date(a.start_at||0)-new Date(b.start_at||0));
          const hour=v=>v&&!isNaN(Date.parse(v))?new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'—';
          const row=(a,showDay)=><div className="fx-row fx-apptrow" key={a.id}>
            <span className="fx-appt-when">{showDay&&<small>{a.start_at?new Date(a.start_at).toLocaleDateString('pt-BR',{weekday:'short',day:'2-digit',month:'short'}).replace(/\./g,''):'Sem data'}</small>}<strong>{hour(a.start_at)}</strong></span>
            <div><strong>{a.title||'Agendamento'}</strong><small>{[APPT_TYPES[a.type]||'',a.location||''].filter(Boolean).join(' · ')||'Sem local informado'}</small></div>
            {readonly?<Chip value={a.status}/>:<select className="fx-select" aria-label={'Status de '+(a.title||'agendamento')} value={a.status||'scheduled'} disabled={saving} onChange={e=>updateAppointment(a,e.target.value)}>
              <option value="scheduled">Agendado</option><option value="confirmed">Confirmado</option><option value="completed">Concluído</option><option value="cancelled">Cancelado</option><option value="no_show">Não compareceu</option>
            </select>}
          </div>;
          return <div className="fx-page fx-agenda">
          <header className="fx-pagehead">
            <div className="fx-pagehead-title"><h1>Agenda</h1><span className="fx-count">{number(counts.appointments)} {counts.appointments===1?'agendamento':'agendamentos'}</span></div>
            {!readonly&&<div className="fx-actions"><button type="button" className="fx-btn fx-btn--primary" aria-expanded={appointmentFormOpen} onClick={()=>setAppointmentFormOpen(v=>!v)}>{appointmentFormOpen?<><X size={16}/> Fechar</>:<><Plus size={16}/> Novo compromisso</>}</button></div>}
          </header>
          {!readonly&&appointmentFormOpen&&<form className="fx-panel" id="staff-agenda-form" onSubmit={createAppointment} aria-label="Novo compromisso">
            <label className="fx-panel-grow">Título<input required minLength={2} maxLength={190} placeholder="Ex.: Reunião com cliente" value={appointmentTitle} onChange={e=>setAppointmentTitle(e.target.value)} autoFocus/></label>
            <label>Data e horário<input required type="datetime-local" value={appointmentStart} onChange={e=>setAppointmentStart(e.target.value)}/></label>
            <label>Tipo<select value={appointmentType} onChange={e=>setAppointmentType(e.target.value)}>
              <option value="meeting">Reunião</option><option value="call">Ligação</option><option value="followup">Retorno</option><option value="visit">Visita</option><option value="consultation">Consulta</option><option value="exam">Exame</option>
            </select></label>
            <label>Local (opcional)<input maxLength={220} placeholder="Online ou endereço" value={appointmentLocation} onChange={e=>setAppointmentLocation(e.target.value)}/></label>
            <button className="fx-btn fx-btn--primary" disabled={saving||!appointmentTitle.trim()||!appointmentStart} type="submit">{saving?'Salvando...':'Salvar compromisso'}</button>
          </form>}
          <div className="fx-agenda-grid">
            <div className="fx-agenda-main">
              <section className="fx-box">
                <div className="fx-boxhead"><h2>Hoje</h2><span className="fx-boxmeta">{now.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</span><span className="fx-groupcount">{todays.length}</span></div>
                {todays.length?todays.map(a=>row(a,false)):<p className="fx-empty-small">Nenhum compromisso hoje.</p>}
              </section>
              <section className="fx-box">
                <div className="fx-boxhead"><h2>{appointmentFilter==='all'?'Todos os compromissos':'Próximos'}</h2><span className="fx-groupcount">{upcoming.length}</span><div className="fx-tabs fx-tabs--end" role="group" aria-label="Filtrar compromissos">{[['upcoming','Próximos'],['all','Todos']].map(([id,v])=><button type="button" aria-pressed={appointmentFilter===id} className={appointmentFilter===id?'active':''} key={id} onClick={()=>setAppointmentFilter(id)}>{v}</button>)}</div></div>
                {upcoming.map(a=>row(a,true))}
                {!upcoming.length&&<p className="fx-empty-small">{appointmentFilter==='all'?'Nenhum compromisso registrado.':'Nenhum compromisso a partir de amanhã. Escolha “Todos” para ver o histórico.'}</p>}
                <div className="fx-boxfoot">Agenda interna do NEXUS CRM. Sincronização externa depende de uma integração autorizada.</div>
              </section>
            </div>
            <MotionCalendar appointments={data.appointments} readonly={readonly} onPick={day=>{
              setAppointmentStart(day+'T09:00');setAppointmentFormOpen(true);
              setTimeout(()=>document.getElementById('staff-agenda-form')?.scrollIntoView({behavior:'smooth',block:'center'}),60);
            }}/>
          </div>
        </div>})()}

        {section==='minha-area'&&<>
          <div className="staff-page-header"><div><span className="staff-kicker">MINHA CONTA</span><h1>Meu espaço</h1><p>Seu perfil e as empresas que você pode acessar.</p></div></div>
          <div className="staff-profile-grid"><section className="staff-card staff-profile-card"><span className="staff-profile-avatar"><Initials name={displayName}/></span><h2>{displayName}</h2><p>{session.email}</p><span className="staff-profile-role"><ShieldCheck size={16}/>{roleLabel}</span><div className="staff-profile-info"><div><span>Conta</span><strong>Ativa</strong></div><div><span>Empresa selecionada</span><strong>{orgName}</strong></div><div><span>Nível de acesso</span><strong>{roleLabel}</strong></div></div></section>
          <section className="staff-card staff-profile-card"><h3>Empresas vinculadas</h3><p>Você só acessa operações autorizadas.</p>{organizations.filter(x=>x.status==='active').map(o=><div key={o.id} className="staff-linked-org"><span className="staff-linked-icon"><BriefcaseBusiness size={20}/></span><span><strong>{o.name}</strong><small>{ROLES[members.find(m=>m.organization_id===o.id)?.role]||'Colaborador'}</small></span>{o.id===organizationId&&<CheckCircle2 size={18}/>}</div>)}</section></div>
        </>}
        </>}
        </div>
      </div>
    </main>
  </div>;
}
