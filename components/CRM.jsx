'use client';
import { useState,useEffect,useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db, ready, configStatus } from '../lib/supabase';
const title={dashboard:'Visão geral',admin:'Super Admin','minha-area':'Minha operação',leads:'Leads e contatos',tasks:'Tarefas'};
const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(n)||0);
function Alert({children,error=false}){return <div className={'notice '+(error?'error':'')} role="alert">{children}</div>}
function HeaderLogo(){return <span className="brand"><span className="brandicon">✦</span>NEXUS <b>CRM</b></span>}
export default function CRM({section}){
 const router=useRouter();
 const [session,setSession]=useState(null),[profile,setProfile]=useState(null),[isLoading,setIsLoading]=useState(true);
 const [dark,setDark]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [email,setEmail]=useState(''),[pass,setPass]=useState(''),[submitting,setSubmitting]=useState(false),[forgot,setForgot]=useState(false);
 const [orgs,setOrgs]=useState([]),[members,setMembers]=useState([]),[org,setOrg]=useState('');
 const [users,setUsers]=useState([]),[metrics,setMetrics]=useState(null),[leads,setLeads]=useState([]),[tasks,setTasks]=useState([]),[period,setPeriod]=useState(30),[loadingData,setLoadingData]=useState(false);
 const [orgName,setOrgName]=useState(''),[taskName,setTaskName]=useState(''),[query,setQuery]=useState('');
 const isAdmin=Boolean(profile?.is_super_admin);
 const isAuthScreen=section==='login'||section==='reset-password';
 useEffect(()=>{const t=localStorage.getItem('nexus-theme')==='dark';setDark(t);document.body.classList.toggle('dark',t)},[]);
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
   if(result.data?.is_super_admin){
    const [o,p]=await Promise.all([db.from('organizations').select('id,name,status,plan').order('name').limit(300),db.from('profiles').select('id,full_name,status,is_super_admin').order('full_name').limit(300)]);
    if(o.error)throw o.error;if(p.error)throw p.error;setOrgs(o.data||[]);setUsers(p.data||[]);
   }else{setOrgs((m.data||[]).map(x=>x.organization).filter(Boolean))}
   setOrg(old=>old||localStorage.getItem('nexus-org')||m.data?.[0]?.organization_id||'');
  }catch(ex){setError(ex.message||'Erro ao consultar o Supabase.')}finally{setIsLoading(false)}
 },[section,router]);
 useEffect(()=>{initialize();if(!db)return;const {data:{subscription}}=db.auth.onAuthStateChange(()=>{setTimeout(()=>initialize(),0)});return()=>subscription.unsubscribe()},[initialize]);
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
 if(!ready)return <div className="authwrap"><div className="glass auth"><HeaderLogo/><h1>Configuração pendente</h1><p className="muted">O site está publicado. Para habilitar o login, confira as configurações abaixo no Netlify.</p>{!configStatus.urlReady&&<Alert><strong>URL faltando ou inválida:</strong> NEXT_PUBLIC_SUPABASE_URL. Use o endereço completo https://SEU-PROJETO.supabase.co</Alert>}{!configStatus.keyReady&&<Alert><strong>Chave pública faltando ou com valor de exemplo:</strong> NEXT_PUBLIC_SUPABASE_ANON_KEY. Use a chave anon ou publishable do mesmo projeto.</Alert>}<p className="small muted">No Netlify, selecione escopo Builds e contexto Production. Depois salve e faça novo deploy com build. Nunca insira service_role nem senhas no código público.</p></div></div>;
 if(isLoading)return <div className="authwrap"><div className="glass auth"><HeaderLogo/><p className="muted">Verificando sua sessão e conexão...</p></div></div>;
 if(isAuthScreen){
  return <div className="authwrap"><div className="glass auth"><HeaderLogo/><div className="eyebrow" style={{marginTop:32}}>ACESSO À PLATAFORMA</div><h1>{section==='reset-password'?'Criar nova senha':forgot?'Recuperar acesso':'Bem-vindo de volta'}</h1><p className="muted">{section==='reset-password'?'Escolha uma nova senha para a sua conta.':forgot?'Enviaremos as instruções de recuperação por e-mail.':'Entre para administrar e acompanhar suas operações.'}</p>
   <form onSubmit={section==='reset-password'?changePassword:forgot?recover:signIn}>
   {section!=='reset-password'&&<label className="field">E-mail<input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="seu@email.com" autoComplete="email" required/></label>}
   {(!forgot||section==='reset-password')&&<label className="field">{section==='reset-password'?'Nova senha':'Senha'}<input value={pass} onChange={e=>setPass(e.target.value)} type="password" minLength={6} placeholder="Sua senha" autoComplete={section==='reset-password'?'new-password':'current-password'} required/></label>}
   {notice&&<div role="status" className="notice success">{notice}</div>}{error&&<Alert error>{error}</Alert>}
   <button disabled={submitting} type="submit" className="btn primary">{submitting?'Processando...':section==='reset-password'?'Salvar nova senha':forgot?'Enviar recuperação':'Entrar'}</button>
   </form>{section==='login'&&<p style={{textAlign:'center',marginTop:20}}><button className="linkbtn" type="button" onClick={()=>{setForgot(!forgot);setError('');setNotice('')}}>{forgot?'Voltar ao login':'Esqueci minha senha'}</button></p>}
   <p className="small muted" style={{textAlign:'center',marginTop:28}}>NEXUS CRM AI · Acesso protegido pelo Supabase</p>
  </div></div>;
 }
 if(!session)return <div className="authwrap"><div className="glass auth"><HeaderLogo/><h1>Sessão encerrada</h1><p className="muted">Entre com seu e-mail e senha para acessar o CRM.</p><a className="btn primary" href="/login">Ir para login</a></div></div>;
 const nav=[['dashboard','▣','Visão geral'],['minha-area','◈','Minha operação'],['leads','◎','Leads'],['tasks','☑','Tarefas'],...(isAdmin?[['admin','⚙','Super Admin']]:[])];
 const items=[{label:isAdmin&&!org?'Empresas':'Leads',v:metrics?.organizations??metrics?.leads??0},{label:isAdmin&&!org?'Usuários':'Agendamentos',v:metrics?.users??metrics?.appointments??0},{label:'Vendas',v:metrics?.sales??0},{label:'Faturamento',v:money(metrics?.revenue??0)}];
 return <div className="shell">
  <aside className="sidebar"><div className="sidebrand"><HeaderLogo/></div><div className="eyebrow" style={{paddingLeft:13}}>ESPAÇO DE TRABALHO</div><nav className="nav" aria-label="Navegação principal">{nav.map(([path,ico,label])=><a href={'/'+path} key={path} className={section===path?'active':''}><span aria-hidden="true">{ico}</span>{label}</a>)}</nav><div className="sidefoot"><strong>{profile?.full_name||session.email}</strong><p className="muted">{isAdmin?'Super administrador':'Usuário da operação'}</p><button className="btn btnsmall subtle" type="button" onClick={signOut}>Sair da conta</button></div></aside>
  <main className="main"><header className="top"><div className="mobilebar"><HeaderLogo/></div><div className="eyebrow">NEXUS / {isAdmin?'CONTROLE GLOBAL':'OPERAÇÃO'}</div><div className="topactions"><button type="button" onClick={toggleTheme} className="btn btnsmall subtle" aria-label="Alternar tema">{dark?'☀ Claro':'☾ Escuro'}</button><button className="btn btnsmall subtle" type="button" onClick={signOut}>Sair</button></div></header>
  <div className="heading"><div><div className="eyebrow">{isAdmin?'PLATAFORMA NEXUS':'PAINEL DE TRABALHO'}</div><h1>{title[section]||'NEXUS CRM'}</h1><p className="muted">Olá, {(profile?.full_name||session.email||'').split(' ')[0]}. Dados reais da sua operação.</p></div><div className="filter"><label className="field">Empresa<select className="textbox" aria-label="Selecionar empresa" value={org} onChange={e=>selectOrg(e.target.value)}><option value="">{isAdmin?'Visão global':'Selecione'}</option>{orgs.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label></div></div>
  {error&&<div style={{marginBottom:17}}><Alert error>{error}</Alert></div>}{notice&&<div role="status" className="notice success" style={{marginBottom:17}}>{notice}</div>}
  {!isAdmin&&!org&&<Alert>Sua conta ainda não está vinculada a uma empresa. Solicite acesso ao administrador.</Alert>}
  {section==='admin'&&(isAdmin?<div className="stack"><div className="grid"><div className="glass metric"><div className="muted">Empresas cadastradas</div><div className="number">{orgs.length}</div></div><div className="glass metric"><div className="muted">Usuários cadastrados</div><div className="number">{users.length}</div></div></div><div className="twocol"><div className="glass panel"><h2>Empresas</h2><div className="tablewrap"><table className="tbl"><thead><tr><th>Empresa</th><th>Plano</th><th>Status</th></tr></thead><tbody>{orgs.map(x=><tr key={x.id}><td>{x.name}</td><td>{x.plan}</td><td><span className="pill">{x.status}</span></td></tr>)}</tbody></table></div>{!orgs.length&&<div className="empty">Nenhuma empresa encontrada.</div>}</div><div className="glass panel"><h2>Nova empresa</h2><p className="muted small">Cria empresa e o funil padrão, se a migração administrativa estiver aplicada.</p><form className="stack" onSubmit={createOrg}><label className="field">Nome da empresa<input value={orgName} onChange={e=>setOrgName(e.target.value)} required placeholder="Ex.: Ótica Exemplo"/></label><button disabled={submitting} className="btn primary">Cadastrar empresa</button></form></div></div><div className="glass panel"><h2>Usuários</h2><div className="tablewrap"><table className="tbl"><thead><tr><th>Nome</th><th>Perfil</th><th>Status</th></tr></thead><tbody>{users.map(x=><tr key={x.id}><td>{x.full_name}</td><td>{x.is_super_admin?'Super Admin':'Operação'}</td><td><span className="pill">{x.status}</span></td></tr>)}</tbody></table></div>{!users.length&&<div className="empty">Nenhum usuário encontrado.</div>}<p className="sectiontip">Convites e criação de usuários ficam bloqueados até a validação da API administrativa, para proteger o acesso.</p></div></div>:<Alert error>Esta área é exclusiva do Super Admin. Seu usuário não tem permissão para acessá-la.</Alert>)}
  {section==='dashboard'&&<div className="stack"><div className="filter">{[7,30,90].map(x=><button key={x} className={'btn btnsmall '+(period===x?'current':'subtle')} onClick={()=>setPeriod(x)}>{x} dias</button>)}<button className="btn btnsmall subtle" onClick={fetchData}>Atualizar</button></div><div className="grid">{items.map((x,i)=><div key={x.label} className="glass metric" style={{animationDelay:(i*50)+'ms'}}><span className="muted small">{x.label}</span><div className="number">{loadingData?'…':x.v}</div><span className="sectiontip">Período selecionado</span></div>)}</div><div className="twocol"><div className="glass panel"><h2>Atividade do funil</h2>{org?<><div className="barline"><span>Leads</span><div className="bar"><div style={{width:'100%'}}/></div><b>{metrics?.leads||0}</b></div><div className="barline"><span>Vendas</span><div className="bar"><div style={{width:((metrics?.sales||0)/Math.max(1,metrics?.leads||0)*100)+'%'}}/></div><b>{metrics?.sales||0}</b></div><div className="barline"><span>Agenda</span><div className="bar"><div style={{width:((metrics?.appointments||0)/Math.max(1,metrics?.leads||0)*100)+'%'}}/></div><b>{metrics?.appointments||0}</b></div></>:<div className="empty">Selecione uma empresa para ver o funil.</div>}</div><div className="glass panel"><h2>Próximas ações</h2><p className="muted">Acompanhe leads, tarefas e clientes sem sair da operação.</p><div className="stack"><a className="btn" href="/leads">Ver leads →</a><a className="btn" href="/tasks">Ver tarefas →</a>{isAdmin&&<a className="btn primary" href="/admin">Abrir Super Admin →</a>}</div></div></div></div>}
  {section==='minha-area'&&<div className="twocol"><div className="glass panel"><h2>Meu perfil</h2><p><strong>Nome:</strong> {profile?.full_name||'Não informado'}</p><p><strong>E-mail:</strong> {session.email}</p><p><strong>Permissão:</strong> {isAdmin?'Super Admin':'Usuário'}</p><p className="muted small">As permissões são validadas no Supabase e não apenas pela interface.</p></div><div className="glass panel"><h2>Empresas vinculadas</h2>{members.length?members.map(x=><p key={x.organization_id}>{x.organization?.name||x.organization_id} <span className="pill">{x.role}</span></p>):<div className="empty">Ainda não há vínculo com empresa.</div>}</div></div>}
  {section==='leads'&&<div className="glass panel"><div className="heading"><h2>Últimos leads</h2><input className="textbox" style={{maxWidth:280}} placeholder="Buscar lead..." aria-label="Buscar lead" value={query} onChange={e=>setQuery(e.target.value)}/></div>{!org?<div className="empty">Selecione uma empresa para consultar os leads.</div>:<div className="tablewrap"><table className="tbl"><thead><tr><th>Contato</th><th>Origem</th><th>Temperatura</th><th>Status</th><th>Data</th></tr></thead><tbody>{leads.filter(x=>JSON.stringify(x).toLowerCase().includes(query.toLowerCase())).map(x=><tr key={x.id}><td>{[x.contact?.first_name,x.contact?.last_name].filter(Boolean).join(' ')||'Contato não vinculado'}</td><td>{x.source||'—'}</td><td><span className="pill">{x.temperature||'—'}</span></td><td>{x.status||'—'}</td><td>{new Date(x.created_at).toLocaleDateString('pt-BR')}</td></tr>)}</tbody></table>{!leads.length&&<div className="empty">Nenhum lead cadastrado.</div>}</div>}</div>}
  {section==='tasks'&&<div className="glass panel"><h2>Gerenciar tarefas</h2>{!org?<div className="empty">Selecione uma empresa para gerenciar tarefas.</div>:<><form onSubmit={createTask} className="inlineform"><input className="textbox" placeholder="Nova tarefa" value={taskName} onChange={e=>setTaskName(e.target.value)} required/><button disabled={submitting} className="btn primary">Adicionar tarefa</button></form><div className="divider"/><div className="tablewrap"><table className="tbl"><thead><tr><th>Tarefa</th><th>Prioridade</th><th>Status</th><th>Ação</th></tr></thead><tbody>{tasks.map(t=><tr key={t.id}><td>{t.title}</td><td>{t.priority}</td><td><span className="pill">{t.status}</span></td><td><button className="btn btnsmall subtle" onClick={()=>completeTask(t)}>{t.status==='completed'?'Reabrir':'Concluir'}</button></td></tr>)}</tbody></table>{!tasks.length&&<div className="empty">Nenhuma tarefa cadastrada.</div>}</div></>}</div>}
  </main></div>;
}
