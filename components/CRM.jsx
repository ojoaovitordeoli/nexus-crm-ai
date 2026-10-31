'use client';
import { useState,useEffect,useCallback,useRef } from 'react';
import { useRouter } from 'next/navigation';
import { db, ready, configStatus } from '../lib/supabase';
import AdminWorkspace from './AdminWorkspace';
import StaffWorkspace from './StaffWorkspace';
import Link from 'next/link';
import { Layers3, LayoutDashboard, BriefcaseBusiness, ContactRound, ListTodo, ShieldCheck, LogOut, Moon, Sun, ChevronRight } from 'lucide-react';
const title={dashboard:'Visão geral',admin:'Super Admin','minha-area':'Minha operação',leads:'Leads e contatos',tasks:'Tarefas'};
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(n)||0);
function Alert({children,error=false}){return <div className={'notice '+(error?'error':'')} role="alert">{children}</div>}
function HeaderLogo(){return <span className="brand"><span className="brandicon"><Layers3 size={20} strokeWidth={2}/></span>NEXUS <b>CRM</b></span>}
export default function CRM({section}){
 const router=useRouter();
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[isLoading,setIsLoading]=useState(true);
 const [dark,setDark]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [email,setEmail]=useState(''),[pass,setPass]=useState(''),[submitting,setSubmitting]=useState(false),[forgot,setForgot]=useState(false);
 const [authSwitching,setAuthSwitching]=useState(false);
 const authTimer=useRef(null);
 const emailInput=useRef(null);
 useEffect(()=>()=>{if(authTimer.current)clearTimeout(authTimer.current)},[]);
 const toggleRecovery=()=>{
   if(authSwitching||submitting)return;
   setError('');setNotice('');
   const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
   if(reduced){setForgot(v=>!v);emailInput.current?.focus();return;}
   setAuthSwitching(true);
   authTimer.current=setTimeout(()=>{
     setForgot(v=>!v);
     emailInput.current?.focus();
   },350);
 };
 const [orgs,setOrgs]=useState([]),[members,setMembers]=useState([]),[org,setOrg]=useState('');
 const [users,setUsers]=useState([]),[metrics,setMetrics]=useState(null),[leads,setLeads]=useState([]),[tasks,setTasks]=useState([]),[period,setPeriod]=useState(30),[loadingData,setLoadingData]=useState(false);
 const [orgName,setOrgName]=useState(''),[taskName,setTaskName]=useState(''),[query,setQuery]=useState('');
 const isAdmin=Boolean(profile?.is_super_admin);
 const isAuthScreen=section==='login'||section==='reset-password';
 useEffect(()=>{const saved=localStorage.getItem('nexus-theme');const darkByDefault=saved!=='light';setDark(darkByDefault);document.body.classList.toggle('dark',darkByDefault)},[]);
 function toggleTheme(){setDark(v=>{document.body.classList.toggle('dark',!v);localStorage.setItem('nexus-theme',!v?'dark':'light');return !v})}
 const initialize=useCallback(async()=>{
  if(!db){setIsLoading(false);return}
  try{
   const {data:{user},error:e}=await db.auth.getUser();
   if(e||!user){setSession(null);setProfile(null);return}
   setSession(user);
   const result=await db.from('profiles').select('id,full_name,is_super_admin,status').eq('id',user.id).maybeSingle();
   if(result.error)throw result.error;
   if(result.data?.status==='suspended'||result.data?.status==='inactive'){await db.auth.signOut();setError('Sua conta está suspensa ou inativa.');setSession(null);return}
   setProfile(result.data);
   if(section==='login')router.replace(result.data?.is_super_admin?'/admin':'/dashboard');
   const m=await db.from('organization_members').select('organization_id,role,status,organization:organizations(id,name,status)').eq('user_id',user.id).eq('status','active');
   if(m.error)throw m.error;
   setMembers(m.data||[]);
   let availableOrgs=[];
   if(result.data?.is_super_admin){
    const [o,p]=await Promise.all([db.from('organizations').select('id,name,status,plan').order('name').limit(300),db.from('profiles').select('id,full_name,status,is_super_admin').order('full_name').limit(300)]);
    if(o.error)throw o.error;if(p.error)throw p.error;availableOrgs=(o.data||[]).filter(x=>x.status!=='archived');setUsers(p.data||[]);
   }else{availableOrgs=(m.data||[]).map(x=>x.organization).filter(x=>x&&x.status==='active')}
   setOrgs(availableOrgs);
   const allowedOrgs=availableOrgs;
   setOrg(old=>{
     const chosen=old||localStorage.getItem('nexus-org')||'';
     return chosen&&allowedOrgs.some(x=>x.id===chosen&&x.status==='active')?chosen:(section==='admin'&&result.data?.is_super_admin?'':allowedOrgs.find(x=>x.status==='active')?.id||'');
   });
  }catch(ex){setError(ex.message||'Erro ao consultar o Supabase.')}finally{setIsLoading(false)}
 },[section,router]);
 useEffect(()=>{
  let alive=true;
  const timeout=window.setTimeout(()=>{
   if(!alive)return;
   setSession(null);setProfile(null);setIsLoading(false);setError('Não foi possível confirmar sua sessão. Verifique a conexão e entre novamente.');
  },8000);
  initialize().finally(()=>window.clearTimeout(timeout));
  if(!db)return()=>{alive=false;window.clearTimeout(timeout)};
  const {data:{subscription}}=db.auth.onAuthStateChange(()=>{setTimeout(()=>initialize(),0)});
  return()=>{alive=false;window.clearTimeout(timeout);subscription.unsubscribe()};
 },[initialize]);
 const fetchData=useCallback(async()=>{
  if(!db||!session||(!org&&!isAdmin))return;
  setLoadingData(true);setError('');
  const since=new Date(Date.now()-period*86400000).toISOString();
  const withOrg=(table,columns='id')=>{let q=db.from(table).select(columns);if(org)q=q.eq('organization_id',org);return q};
  try{
   if(org){
    const [l,a,s,t,lr,tr]=await Promise.all([
     withOrg('leads').gte('created_at',since).select('id',{count:'exact',head:true}),
     withOrg('appointments').gte('created_at',since).select('id',{count:'exact',head:true}),
     withOrg('sales','id,value,created_at').gte('created_at',since),
     withOrg('tasks').gte('created_at',since).select('id',{count:'exact',head:true}),
     withOrg('leads','id,source,status,temperature,created_at,contact:contacts(first_name,last_name,whatsapp)').order('created_at',{ascending:false}).limit(100),
     withOrg('tasks','id,title,status,priority,due_date,created_at').order('created_at',{ascending:false}).limit(100)
    ]);
    for(const item of [l,a,s,t,lr,tr])if(item.error)throw item.error;
    const revenue=(s.data||[]).reduce((sum,x)=>sum+Number(x.value||0),0);
    setMetrics({leads:l.count||0,appointments:a.count||0,sales:(s.data||[]).length,revenue,tasks:t.count||0});
    setLeads(lr.data||[]);setTasks(tr.data||[]);
   }else{
    setMetrics({organizations:orgs.length,users:users.length});setLeads([]);setTasks([]);
   }
  }catch(ex){setError(ex.message||'Não foi possível carregar os dados. Confira o Supabase e as permissões.')}finally{setLoadingData(false)}
 },[session,org,isAdmin,period,orgs.length,users.length]);
 useEffect(()=>{if(!isAuthScreen&&session&&!isLoading)fetchData()},[fetchData,isAuthScreen,session,isLoading]);
 async function signIn(e){e.preventDefault();setError('');setNotice('');if(!db)return;setSubmitting(true);const {error:e2}=await db.auth.signInWithPassword({email,password:pass});if(e2)setError(e2.message);setSubmitting(false)}
 async function recover(e){e.preventDefault();if(!db)return;setSubmitting(true);setError('');const {error:e2}=await db.auth.resetPasswordForEmail(email,{redirectTo:window.location.origin+'/reset-password'});if(e2)setError(e2.message);else setNotice('Se este e-mail estiver cadastrado, você receberá um link de recuperação. Verifique também o spam.');setSubmitting(false)}
 async function changePassword(e){e.preventDefault();setError('');setNotice('');const {error:e2}=await db.auth.updateUser({password:pass});if(e2)setError(e2.message);else{setNotice('Senha atualizada. Entre usando sua nova senha.');await db.auth.signOut();setTimeout(()=>router.push('/login'),400)}}
 async function signOut(){if(db)await db.auth.signOut();setSession(null);setProfile(null);router.replace('/login')}
 async function createOrg(e){e.preventDefault();if(!isAdmin||!orgName.trim())return;setError('');setNotice('');setSubmitting(true);const name=orgName.trim();const slug=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Math.floor(Date.now()/1000);const {error:e2}=await db.rpc('admin_create_organization',{p_name:name,p_slug:slug});if(e2)setError('Falha ao criar empresa: '+e2.message+'. Verifique se a migração de administração foi aplicada no Supabase.');else{setNotice('Empresa criada com funil padrão.');setOrgName('');await initialize()}setSubmitting(false)}
 async function createTask(e){e.preventDefault();if(!taskName.trim()||!org)return;setSubmitting(true);setError('');const {error:e2}=await db.from('tasks').insert({organization_id:org,title:taskName.trim(),created_by:session.id});if(e2)setError(e2.message);else{setTaskName('');await fetchData()}setSubmitting(false)}
 async function completeTask(item){const status=item.status==='completed'?'pending':'completed';const {error:e2}=await db.from('tasks').update({status,completed_at:status==='completed'?new Date().toISOString():null}).eq('id',item.id).eq('organization_id',org);if(e2)setError(e2.message);else await fetchData()}
 const selectOrg=v=>{setOrg(v);localStorage.setItem('nexus-org',v)};
 if(!ready)return <div className="authwrap"><div className="glass auth"><HeaderLogo/><h1>Configuração pendente</h1><p className="muted">O site está publicado. Para habilitar o login, confira as variáveis no ambiente da hospedagem.</p>{!configStatus.urlReady&&<Alert><strong>URL faltando ou inválida:</strong> NEXT_PUBLIC_SUPABASE_URL. Use o endereço completo https://SEU-PROJETO.supabase.co</Alert>}{!configStatus.keyReady&&<Alert><strong>Chave pública faltando ou com valor de exemplo:</strong> NEXT_PUBLIC_SUPABASE_ANON_KEY. Use a chave anon ou publishable do mesmo projeto.</Alert>}<p className="small muted">No Render, configure as variáveis de ambiente do serviço. Depois salve e faça novo deploy com build. Nunca insira service_role nem senhas no código público.</p></div></div>;
 if(isLoading)return <div className="authwrap"><div className="glass auth"><HeaderLogo/><p className="muted">Verificando sua sessão e conexão...</p></div></div>;
 if(isAuthScreen){
  return <div className="authwrap authwrap--v4"><div className={'glass auth auth--v4 '+(authSwitching?'auth--switching ':'')+(forgot?'auth--recover':'')}>
   <div className="auth-v4-aura" aria-hidden="true"/>
   <div className="auth-v4-top"><HeaderLogo/><span>ACESSO SEGURO</span></div>
   <div className="auth-v4-blade" aria-hidden="true" onAnimationEnd={()=>setAuthSwitching(false)}/>
   <div className="auth-v4-content">
   <div className="eyebrow" style={{marginTop:32}}>ÁREA DE TRABALHO</div><h1>{section==='reset-password'?'Criar nova senha':forgot?'Recuperar acesso':'Bem-vindo de volta'}</h1><p className="muted">{section==='reset-password'?'Escolha uma nova senha para a sua conta.':forgot?'Enviaremos as instruções de recuperação por e-mail.':'Entre para administrar e acompanhar suas operações.'}</p>
   <form onSubmit={section==='reset-password'?changePassword:forgot?recover:signIn}>
   {section!=='reset-password'&&<label className="field">E-mail<input ref={emailInput} value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="seu@email.com" autoComplete="email" required/></label>}
   {(!forgot||section==='reset-password')&&<label className="field">{section==='reset-password'?'Nova senha':'Senha'}<input value={pass} onChange={e=>setPass(e.target.value)} type="password" minLength={6} placeholder="Sua senha" autoComplete={section==='reset-password'?'new-password':'current-password'} required/></label>}
   {notice&&<div role="status" className="notice success">{notice}</div>}{error&&<Alert error>{error}</Alert>}
   <button disabled={submitting} type="submit" className="btn primary">{submitting?'Processando...':section==='reset-password'?'Salvar nova senha':forgot?'Enviar recuperação':'Entrar'}</button>
   </form>{section==='login'&&<p style={{textAlign:'center',marginTop:20}}><button className="linkbtn" type="button" onClick={toggleRecovery}>{forgot?'Voltar ao login':'Esqueci minha senha'}</button></p>}
   <p className="small muted" style={{textAlign:'center',marginTop:28}}>NEXUS CRM · Acesso seguro</p>
   </div>
   <aside className="auth-v4-cover" aria-label="Apresentação do NEXUS">
     <div className="auth-v4-cover-orbit" aria-hidden="true"><span/><span/><span/></div>
     <div className="auth-v4-cover-inner">
       <span className="auth-v4-cover-kicker">NEXUS / GESTÃO COMERCIAL</span>
       <h2>{forgot?'Seu próximo passo começa aqui.':section==='reset-password'?'Segurança para continuar.':'O trabalho, em ordem.'}</h2>
       <p>Leads, tarefas e resultados no mesmo lugar. Simples de acompanhar.</p>
       <span className="auth-v4-cover-foot"><span/> Plataforma multiempresa · Acesso protegido</span>
     </div>
   </aside>
  </div></div>;
 }
 if(!session)return <div className="authwrap"><div className="glass auth"><HeaderLogo/><h1>Sessão encerrada</h1><p className="muted">Entre com seu e-mail e senha para acessar o CRM.</p><a className="btn primary" href="/login">Ir para login</a></div></div>;
 if(!isAdmin||section!=='admin')return <StaffWorkspace section={section} session={session} profile={profile} organizations={orgs} members={members} organizationId={org} onOrganizationChange={selectOrg} onSignOut={signOut} dark={dark} onToggleTheme={toggleTheme} isSuperAdmin={isAdmin}/>;
 const nav=[['dashboard',LayoutDashboard,'Visão geral'],['minha-area',BriefcaseBusiness,'Minha operação'],['leads',ContactRound,'Leads'],['tasks',ListTodo,'Tarefas'],...(isAdmin?[['admin',ShieldCheck,'Super Admin']]:[])];
 const items=[{label:isAdmin&&!org?'Empresas':'Leads',v:metrics?.organizations??metrics?.leads??0},{label:isAdmin&&!org?'Usuários':'Agendamentos',v:metrics?.users??metrics?.appointments??0},{label:'Vendas',v:metrics?.sales??0},{label:'Faturamento',v:money(metrics?.revenue??0)}];
 return <div className="shell">
  <aside className="sidebar"><div className="sidebrand"><HeaderLogo/></div><div className="eyebrow" style={{paddingLeft:13}}>NAVEGAÇÃO</div><nav className="nav" aria-label="Navegação principal">{nav.map(([path,Icon,label])=><Link href={'/'+path} key={path} className={section===path?'active':''}><Icon size={19} strokeWidth={1.9}/>{label}</Link>)}</nav><div className="sidefoot"><strong>{profile?.full_name||session.email}</strong><p className="muted">{isAdmin?'Proprietário da plataforma':'Membro da operação'}</p><button className="btn btnsmall subtle" type="button" onClick={signOut}><LogOut size={15}/> Sair da conta</button></div></aside>
  <main className="main"><header className="top"><div className="top-leading"><span>Workspace</span><ChevronRight size={14}/><strong>{title[section]||'NEXUS CRM'}</strong></div><div className="topactions"><button type="button" onClick={toggleTheme} className="btn btnsmall subtle" aria-label="Alternar tema">{dark?<><Sun size={16}/> Claro</>:<><Moon size={16}/> Escuro</>}</button><span className="top-user-avatar" title={profile?.full_name||session.email}>{(profile?.full_name||session.email||'N').split(/\s+/).map(p=>p[0]).slice(0,2).join('').toUpperCase()}</span></div></header>
  <div className={'heading '+(section==='admin'?'heading--admin':'')}><div><div className="eyebrow">{isAdmin?'PLATAFORMA NEXUS':'PAINEL DE TRABALHO'}</div><h1>{title[section]||'NEXUS CRM'}</h1><p className="muted">Olá, {(profile?.full_name||session.email||'').split(' ')[0]}. Dados reais da sua operação.</p></div><div className="filter"><label className="field">Empresa<select className="textbox" aria-label="Selecionar empresa" value={org} onChange={e=>selectOrg(e.target.value)}><option value="">{isAdmin?'Visão global':'Selecione'}</option>{orgs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div></div>
  {error&&<div style={{marginBottom:17}}><Alert error>{error}</Alert></div>}{notice&&<div role="status" className="notice success" style={{marginBottom:17}}>{notice}</div>}
  {!isAdmin&&!org&&<Alert>Sua conta ainda não está vinculada a uma empresa. Solicite acesso ao administrador.</Alert>}
  {section==='admin'&&<AdminWorkspace isAdmin={isAdmin} onRefresh={initialize}/>}
  {section==='dashboard'&&<div className="stack"><div className="filter">{[7,30,90].map(x=><button key={x} className={'btn btnsmall '+(period===x?'current':'subtle')} onClick={()=>setPeriod(x)}>{x} dias</button>)}<button className="btn btnsmall subtle" onClick={fetchData}>Atualizar</button></div><div className="grid">{items.map((x,i)=><div key={x.label} className="glass metric" style={{animationDelay:(i*50)+'ms'}}><span className="muted small">{x.label}</span><div className="number">{loadingData?'…':x.v}</div><span className="sectiontip">Período selecionado</span></div>)}</div><div className="twocol"><div className="glass panel"><h2>Atividade do funil</h2>{org?<><div className="barline"><span>Leads</span><div className="bar"><div style={{width:'100%'}}/></div><b>{metrics?.leads||0}</b></div><div className="barline"><span>Vendas</span><div className="bar"><div style={{width:((metrics?.sales||0)/Math.max(1,metrics?.leads||0)*100)+'%'}}/></div><b>{metrics?.sales||0}</b></div><div className="barline"><span>Agenda</span><div className="bar"><div style={{width:((metrics?.appointments||0)/Math.max(1,metrics?.leads||0)*100)+'%'}}/></div><b>{metrics?.appointments||0}</b></div></>:<div className="empty">Selecione uma empresa para ver o funil.</div>}</div><div className="glass panel"><h2>Próximas ações</h2><p className="muted">Acompanhe leads, tarefas e clientes sem sair da operação.</p><div className="stack"><a className="btn" href="/leads">Ver leads →</a><a className="btn" href="/tasks">Ver tarefas →</a>{isAdmin&&<a className="btn primary" href="/admin">Abrir Super Admin →</a>}</div></div></div></div>}
  {section==='minha-area'&&<div className="twocol"><div className="glass panel"><h2>Meu perfil</h2><p><strong>Nome:</strong> {profile?.full_name||'Não informado'}</p><p><strong>E-mail:</strong> {session.email}</p><p><strong>Permissão:</strong> {isAdmin?'Super Admin':'Usuário'}</p><p className="muted small">As permissões são validadas no Supabase e não apenas pela interface.</p></div><div className="glass panel"><h2>Empresas vinculadas</h2>{members.length?members.map(x=><p key={x.organization_id}>{x.organization?.name||x.organization_id} <span className="pill">{x.role}</span></p>):<div className="empty">Ainda não há vínculo com empresa.</div>}</div></div>}
  {section==='leads'&&<div className="glass panel"><div className="heading"><h2>Últimos leads</h2><input className="textbox" style={{maxWidth:280}} placeholder="Buscar lead..." aria-label="Buscar lead" value={query} onChange={e=>setQuery(e.target.value)}/></div>{!org?<div className="empty">Selecione uma empresa para consultar os leads.</div>:<div className="tablewrap"><table className="tbl"><thead><tr><th>Contato</th><th>Origem</th><th>Temperatura</th><th>Status</th><th>Data</th></tr></thead><tbody>{leads.filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase())).map(x=><tr key={x.id}><td>{[x.contact?.first_name,x.contact?.last_name].filter(Boolean).join(' ')||'Contato não vinculado'}</td><td>{x.source||'—'}</td><td><span className="pill">{x.temperature||'—'}</span></td><td>{x.status||'—'}</td><td>{new Date(x.created_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table>{!leads.length&&<div className="empty">Nenhum lead cadastrado.</div>}</div>}</div>}
  {section==='tasks'&&<div className="glass panel"><h2>Gerenciar tarefas</h2>{!org?<div className="empty">Selecione uma empresa para gerenciar tarefas.</div>:<><form onSubmit={createTask} className="inlineform"><input className="textbox" placeholder="Nova tarefa" value={taskName} onChange={e=>setTaskName(e.target.value)} required/><button disabled={submitting} className="btn primary">Adicionar tarefa</button></form><div className="divider"/><div className="tablewrap"><table className="tbl"><thead><tr><th>Tarefa</th><th>Prioridade</th><th>Status</th><th>Ação</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{t.title}</td><td>{t.priority}</td><td><span className="pill">{t.status}</span></td><td><button className="btn btnsmall subtle" onClick={()=>completeTask(t)}>{t.status==='completed'?'Reabrir':'Concluir'}</button></td></tr>)}</tbody></table>{!tasks.length&&<div className="empty">Nenhuma tarefa cadastrada.</div>}</div></>}</div>}
  </main></div>;
}
