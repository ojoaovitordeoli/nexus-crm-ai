'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Archive, ArrowRight, BarChart3, Building2, CheckCircle2,
  ChevronDown, CircleAlert, CircleCheck, Layers3,
  LockKeyhole, Plus, RefreshCw, RotateCcw, Search, ShieldCheck, SlidersHorizontal,
  Trash2, UserPlus, UsersRound, X
} from 'lucide-react';
import { db } from '../lib/supabase';

const ROLES = [
  ['AGENCY_ADMIN','Admin da agência'],['ORGANIZATION_ADMIN','Admin da empresa'],
  ['MANAGER','Gerente'],['SDR','SDR'],['SELLER','Vendedor'],['VIEWER','Visualizador']
];
const ROLE_NAME = Object.fromEntries(ROLES);
const LABELS = {active:'Ativa',archived:'Arquivada',suspended:'Suspensa',removed:'Removido',invited:'Convidado'};
const stamp = iso => iso ? new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}) : '—';
const clean = value => String(value ?? '').toLocaleLowerCase('pt-BR');
const initials = value => String(value || '?').trim().split(/\s+/).slice(0,2).map(s=>s[0]?.toUpperCase()).join('');
const percent = (count,total) => Math.min(100,Math.round(count / Math.max(total,1) * 100));
const roleColor = ['#4f72ff','#19b6a4','#b58af5','#f4b95c','#f18c84','#9da9bd'];
const AUDIT_LABEL = {
  membership_create:'Acesso vinculado',membership_update:'Acesso alterado',membership_status:'Status de acesso alterado',
  profile_status:'Status de usuário alterado',user_create:'Usuário criado',organization_archive:'Empresa arquivada',
  organization_restore:'Empresa restaurada',organization_delete:'Empresa excluída',organization_create:'Empresa criada'
};
const auditLabel = action => AUDIT_LABEL[action] || (action ? String(action).replace(/_/g,' ') : 'Evento');
const ENTITY_LABEL = {organization:'empresa',organization_member:'acesso',profile:'usuário'};
// Erros do Supabase/RPC chegam em inglês e às vezes com detalhe técnico: a tela recebe português.
const MISSING_RPC = /schema cache|could not find the function|does not exist|PGRST202|42883/i;
function rpcMessage(err,fallback){
  const text=String(err?.message||'');const code=String(err?.code||'');
  if(MISSING_RPC.test(text)||MISSING_RPC.test(code))return null;
  // RAISE EXCEPTION das funções do NEXUS (código P0001) já vem em português.
  if(code==='P0001'&&text)return text;
  if(code==='23505')return 'Já existe uma empresa com esse identificador. Tente novamente.';
  return fallback;
}
async function readJson(response){
  try{return await response.json()}catch{return {error:response.ok?null:'O servidor respondeu de forma inesperada (código '+response.status+'). Tente novamente.'}}
}
function Pill({status}) {return <span className={'adm-pill adm-pill--'+(status||'neutral')}><i/>{LABELS[status]||status||'Não definido'}</span>}
function Message({text,kind}) {if(!text)return null;return <div role={kind==='danger'?'alert':'status'} className={'adm-message '+(kind==='danger'?'adm-message--danger':'adm-message--success')}>{kind==='danger'?<CircleAlert size={18}/>:<CheckCircle2 size={18}/>}<span>{text}</span></div>}
function Empty({icon:Icon=Layers3,title,description}) {return <div className="adm-empty"><span className="adm-empty-icon"><Icon size={24}/></span><strong>{title}</strong><p>{description}</p></div>}

export default function AdminWorkspace({isAdmin,onRefresh}) {
  const [tab,setTab] = useState('companies');
  const [users,setUsers] = useState([]);
  const [companies,setCompanies] = useState([]);
  const [members,setMembers] = useState([]);
  const [audits,setAudits] = useState([]);
  const [loading,setLoading] = useState(true);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState('');
  const [success,setSuccess] = useState('');
  const [search,setSearch] = useState('');
  const [showArchived,setShowArchived] = useState(false);
  const [companyName,setCompanyName] = useState('');
  const [name,setName] = useState('');
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [selectedUser,setSelectedUser] = useState('');
  const [selectedCompany,setSelectedCompany] = useState('');
  const [role,setRole] = useState('SELLER');
  const [confirm,setConfirm] = useState(null);
  const [confirmationName,setConfirmationName] = useState('');
  const [lastSync,setLastSync] = useState(null);

  const clearMessage = ()=>{setError('');setSuccess('');};
  async function sendAccess(input){
    const {data:{session}}=await db.auth.getSession();
    if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
    const response=await fetch('/api/admin/access',{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
      body:JSON.stringify(input)
    });
    let result;
    result=await readJson(response);
    if(!response.ok)throw new Error(result?.error||'Falha ao atualizar o acesso.');
    return result;
  }
  const load = useCallback(async()=>{
    if(!db||!isAdmin)return;
    setLoading(true);
    try{
    const [p,o,m,a]=await Promise.all([
      db.from('profiles').select('id,full_name,is_super_admin,status').order('full_name').limit(500),
      db.from('organizations').select('id,name,plan,status,created_at,slug').order('name').limit(500),
      db.from('organization_members').select('id,organization_id,user_id,role,status').limit(1000),
      db.from('audit_logs').select('id,user_id,action,entity_type,created_at').order('created_at',{ascending:false}).limit(50)
    ]);
    const failed=[p,o,m,a].find(x=>x.error);
    if(failed)setError('Não foi possível carregar todos os dados do painel. Clique em Atualizar para tentar de novo.');
    if(!p.error)setUsers(p.data||[]);
    if(!o.error)setCompanies(o.data||[]);
    if(!m.error)setMembers(m.data||[]);
    if(!a.error)setAudits(a.data||[]);
    setLastSync(new Date());
    }catch{setError('Sem conexão com o servidor. Verifique a internet e clique em Atualizar.')}
    finally{setLoading(false)}
  },[isAdmin]);
  useEffect(()=>{load()},[load]);
  useEffect(()=>{
    if(!confirm)return;
    const handle=e=>{if(e.key==='Escape'&&!saving){setConfirm(null);setConfirmationName('')}};
    window.addEventListener('keydown',handle);
    return ()=>window.removeEventListener('keydown',handle);
  },[confirm,saving]);

  const activeCompanies = useMemo(()=>companies.filter(c=>c.status!=='archived'),[companies]);
  const archivedCompanies = useMemo(()=>companies.filter(c=>c.status==='archived'),[companies]);
  const activeMemberships = useMemo(()=>members.filter(m=>m.status==='active'),[members]);
  const filteredCompanies = (showArchived?archivedCompanies:activeCompanies).filter(c=>
    clean(c.name).includes(clean(search))||clean(c.slug).includes(clean(search)));
  const filteredUsers = users.filter(u=>clean(u.full_name).includes(clean(search)));

  async function createCompany(e){
    e.preventDefault();clearMessage();
    const text=companyName.trim();
    if(text.length<2){setError('Informe o nome da empresa.');return}
    setSaving(true);
    const base=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60);
    // Nome só com símbolos/emoji gerava identificador começando com "-".
    const slug=(base||'empresa')+'-'+Date.now().toString(36);
    try{
      const {error:e2}=await db.rpc('admin_create_organization',{p_name:text,p_slug:slug,p_plan:'free'});
      if(e2)throw e2;
      setCompanyName('');setShowArchived(false);setSuccess('Empresa criada e pronta para configurar.');
      await load();if(onRefresh)await onRefresh();
    }catch(ex){setError(rpcMessage(ex,'Não foi possível criar a empresa. Tente novamente.')??'A criação de empresas ainda não está habilitada no banco (função admin_create_organization ausente). Peça para aplicar supabase/fix_admin_create_organization.sql.')}
    finally{setSaving(false)}
  }
  async function manageCompany(){
    if(!confirm||!db)return;
    const {company,action}=confirm;
    if(action==='delete'&&confirmationName!==company.name)return;
    clearMessage();setSaving(true);
    let warning='';
    try{
      if(action==='delete'){
        const {error:e2}=await db.rpc('admin_manage_organization',{
          p_org_id:company.id,p_action:action,p_confirm_name:confirmationName
        });
        if(e2){
          const text=rpcMessage(e2,'Não foi possível excluir a empresa. Tente novamente.');
          throw new Error(text??'A exclusão definitiva ainda não está habilitada neste ambiente: a função de banco admin_manage_organization não foi instalada. A empresa continua arquivada e com os dados preservados.');
        }
      } else {
        const {data:{session}}=await db.auth.getSession();
        if(!session?.access_token)throw new Error('Faça login novamente.');
        const response=await fetch('/api/admin/organizations',{
          method:'POST',headers:{
            'Content-Type':'application/json',
            Authorization:'Bearer '+session.access_token
          },
          body:JSON.stringify({org_id:company.id,action})
        });
        const data=await readJson(response);
        if(!response.ok)throw new Error(data.error||'Falha ao atualizar empresa.');
        warning=data.warning||'';
      }
      // O aviso de auditoria era sobrescrito pela mensagem de sucesso logo abaixo.
      setSuccess((action==='archive'?'Empresa arquivada. Ela saiu da operação, mas os dados foram preservados.':
        action==='restore'?'Empresa restaurada e disponível novamente.':'Empresa vazia excluída definitivamente.')+(warning?' '+warning:''));
      setConfirm(null);setConfirmationName('');
      await load();if(onRefresh)await onRefresh();
    }catch(ex){
      setConfirm(null);setConfirmationName('');
      setError(ex.message||'Não foi possível concluir a ação.');
    }finally{setSaving(false)}
  }
  function askCompany(company,action){clearMessage();setConfirmationName('');setConfirm({company,action})}
  async function createUser(e){
    e.preventDefault();clearMessage();setSaving(true);
    try{
      const {data:{session}}=await db.auth.getSession();
      if(!session?.access_token)throw Error('Sua sessão expirou. Entre novamente.');
      const r=await fetch('/api/admin/users',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},
        body:JSON.stringify({full_name:name,email,password})
      });
      const data=await readJson(r);
      if(!r.ok)throw Error(data.error||'Erro ao cadastrar.');
      setName('');setEmail('');setPassword('');
      setSuccess('Usuário criado. Abra a aba Acessos para vinculá-lo a uma empresa.'+(data.warning?' '+data.warning:''));
      await load();
    }catch(ex){setError(ex.message||'Não foi possível cadastrar usuário.')}
    finally{setSaving(false)}
  }
  async function addMember(e){
    e.preventDefault();clearMessage();
    if(!selectedUser||!selectedCompany){setError('Escolha usuário e empresa.');return}
    setSaving(true);
    try{
      const result=await sendAccess({
        action:'assign',user_id:selectedUser,org_id:selectedCompany,role
      });
      setSuccess(result.message+(result.warning?' '+result.warning:''));
      await load();
    }catch(ex){setError('Não foi possível vincular o usuário: '+ex.message)}
    finally{setSaving(false)}
  }
  async function changeUserStatus(id,current){
    const next=current==='active'?'suspended':'active';
    if(!window.confirm((next==='suspended'?'Suspender':'Reativar')+' este usuário?'))return;
    clearMessage();setSaving(true);
    try{
      const result=await sendAccess({action:'user_status',user_id:id,status:next});
      setSuccess(result.message+(result.warning?' '+result.warning:''));
      await load();
    }catch(ex){setError('Não foi possível atualizar: '+ex.message)}
    finally{setSaving(false)}
  }
  async function changeMemberStatus(item){
    const next=item.status==='active'?'removed':'active';
    if(!window.confirm(next==='removed'?'Remover o acesso deste usuário à empresa?':'Restaurar este acesso?'))return;
    clearMessage();setSaving(true);
    try{
      const result=await sendAccess({action:'member_status',member_id:item.id,status:next});
      setSuccess(result.message+(result.warning?' '+result.warning:''));
      await load();
    }catch(ex){setError('Não foi possível atualizar: '+ex.message)}
    finally{setSaving(false)}
  }
  const companyNameById=id=>companies.find(c=>c.id===id)?.name||'Empresa não encontrada';
  const userNameById=id=>users.find(u=>u.id===id)?.full_name||'Usuário não encontrado';
  const switchTab=id=>{setTab(id);setSearch('');clearMessage()};
  const tabs=[['companies',Building2,'Empresas'],['users',UsersRound,'Usuários'],['permissions',ShieldCheck,'Acessos'],['audits',Activity,'Auditoria']];

  if(!isAdmin)return <div className="adm"><Message kind="danger" text="Área exclusiva do Super Admin. Sua conta não possui permissão de acesso."/></div>;

  return <div className="adm">
    <header className="fx-pagehead">
      <div className="fx-pagehead-title"><h1>Administração</h1>
        <span className="fx-count">{lastSync?'Atualizado às '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'Carregando dados'}</span></div>
      <div className="fx-actions">
        <button type="button" className="fx-btn" onClick={()=>load()} disabled={loading}><RefreshCw size={15}/> Atualizar</button>
      </div>
    </header>

    <section className="fx-strip fx-strip--4" aria-label="Resumo da plataforma">
      <div><span>Empresas ativas</span><strong>{loading?'—':activeCompanies.length}</strong></div>
      <div><span>Usuários</span><strong>{loading?'—':users.length}</strong></div>
      <div><span>Vínculos ativos</span><strong>{loading?'—':activeMemberships.length}</strong></div>
      <div><span>Eventos de auditoria</span><strong>{loading?'—':audits.length}</strong></div>
      <p className="fx-strip-note">{archivedCompanies.length} empresa(s) arquivada(s) · {users.filter(u=>u.status==='active').length} conta(s) ativa(s). Nenhum valor é estimado.</p>
    </section>

    <section className="adm-content">
      <div className="adm-content-top">
        <div className="adm-tabs" role="tablist" aria-label="Áreas administrativas">
          {tabs.map(([key,Icon,label])=><button key={key} type="button" role="tab"
            aria-selected={tab===key} className={'adm-tab '+(tab===key?'adm-tab--active':'')}
            onClick={()=>switchTab(key)}><Icon size={17}/>{label}{key==='companies'&&<b>{companies.length}</b>}</button>)}
        </div>
        <button type="button" className="adm-iconbtn" title="Atualizar dados" aria-label="Atualizar dados"
          disabled={loading||saving} onClick={()=>{clearMessage();load()}}><RefreshCw size={18} className={loading?'adm-spin':''}/></button>
      </div>
      {error&&<Message text={error} kind="danger"/>}
      {success&&<Message text={success} kind="success"/>}
      {tab==='companies'&&<>
        <div className="adm-section-heading">
          <div><h3>Suas empresas</h3><p>Organize os ambientes que usam o NEXUS CRM.</p></div>
          <button type="button" className="adm-primary" onClick={()=>{setShowArchived(false);document.getElementById('adm-new-company')?.focus()}}><Plus size={17}/> Nova empresa</button>
        </div>
        <div className="adm-columns">
          <div className="adm-surface adm-list-surface">
            <div className="adm-list-controls">
              <div className="adm-segmented">
                <button className={!showArchived?'selected':''} onClick={()=>{setShowArchived(false);setSearch('')}}>Ativas <span>{activeCompanies.length}</span></button>
                <button className={showArchived?'selected':''} onClick={()=>{setShowArchived(true);setSearch('')}}>Arquivadas <span>{archivedCompanies.length}</span></button>
              </div>
              <label className="adm-search"><Search size={17}/><input aria-label="Buscar empresa" placeholder="Buscar empresa..." value={search} onChange={e=>setSearch(e.target.value)}/></label>
            </div>
            <div className="adm-tablewrap"><table className="adm-table"><thead><tr><th>Empresa</th><th>Plano</th><th>Membros</th><th>Status</th><th className="adm-right">Gerenciar</th></tr></thead><tbody>
              {filteredCompanies.map(c=><tr key={c.id}>
                <td><div className="adm-identity"><span className="adm-avatar adm-avatar--company">{initials(c.name)}</span><div><strong>{c.name}</strong><small>{c.slug||'Ambiente de trabalho'}</small></div></div></td>
                <td><span className="adm-plan">{c.plan||'free'}</span></td>
                <td><span className="adm-member-count"><UsersRound size={14}/>{members.filter(m=>m.organization_id===c.id&&m.status==='active').length}</span></td>
                <td><Pill status={c.status}/></td>
                <td><div className="adm-row-actions">
                  {c.status==='archived'?<>
                    <button disabled={saving} className="adm-textbtn" onClick={()=>askCompany(c,'restore')} title={'Restaurar '+c.name}><RotateCcw size={15}/> Restaurar</button>
                    <button disabled={saving} className="adm-textbtn adm-textbtn--danger" onClick={()=>askCompany(c,'delete')} title={'Excluir permanentemente '+c.name}><Trash2 size={15}/><span className="adm-action-label">Excluir</span></button>
                  </>:<button disabled={saving} className="adm-textbtn" onClick={()=>askCompany(c,'archive')} title={'Arquivar '+c.name}><Archive size={15}/> Arquivar</button>}
                </div></td>
              </tr>)}
            </tbody></table></div>
            {!filteredCompanies.length&&<Empty icon={showArchived?Archive:Building2}
              title={search?'Nenhum resultado encontrado':showArchived?'Nenhuma empresa arquivada':'Nenhuma empresa ativa'}
              description={search?'Tente outro termo de busca.':showArchived?'As empresas arquivadas ficam aqui, com dados preservados.':'Crie sua primeira empresa no painel ao lado.'}/>}
            <div className="adm-list-foot"><LockKeyhole size={14}/> Arquivar preserva os dados. Exclusão definitiva exige confirmação e empresa sem registros operacionais.</div>
          </div>
          <aside className="adm-surface adm-creation">
            
            
            <h4>Criar empresa</h4>
            <p>Um espaço independente para cada operação, com funil inicial preparado.</p>
            <form className="adm-form" onSubmit={createCompany}>
              <label>Nome da empresa<input id="adm-new-company" placeholder="Ex.: Ótica Exemplo" minLength={2} maxLength={150} required value={companyName} onChange={e=>setCompanyName(e.target.value)}/></label>
              <button disabled={saving||companyName.trim().length<2} type="submit" className="adm-primary adm-wide">{saving?'Criando...':'Criar empresa'} <ArrowRight size={17}/></button>
            </form>
            <div className="adm-form-note"><CircleCheck size={15}/> Funil de 8 etapas incluído</div>
          </aside>
        </div>
      </>}

      {tab==='users'&&<>
        <div className="adm-section-heading"><div><h3>Usuários da plataforma</h3><p>Convide sua equipe e controle quem pode entrar no CRM.</p></div></div>
        <div className="adm-columns">
          <div className="adm-surface adm-list-surface">
            <div className="adm-list-controls"><div className="adm-count-title"><UsersRound size={18}/> Contas cadastradas <span>{users.length}</span></div><label className="adm-search"><Search size={17}/><input aria-label="Buscar usuário" placeholder="Buscar usuário..." value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
            <div className="adm-tablewrap"><table className="adm-table"><thead><tr><th>Usuário</th><th>Permissão</th><th>Status</th><th className="adm-right">Ação</th></tr></thead><tbody>
              {filteredUsers.map(u=><tr key={u.id}>
                <td><div className="adm-identity"><span className="adm-avatar">{initials(u.full_name)}</span><div><strong>{u.full_name||'Sem nome'}</strong><small>{u.id.slice(0,8)}</small></div></div></td>
                <td>{u.is_super_admin?<span className="adm-role adm-role--admin"><ShieldCheck size={13}/> Super Admin</span>:<span className="adm-role">Operação</span>}</td>
                <td><Pill status={u.status}/></td>
                <td><div className="adm-row-actions">{u.is_super_admin?<span className="adm-protected"><LockKeyhole size={14}/> Protegido</span>:
                  <button disabled={saving} className="adm-textbtn" onClick={()=>changeUserStatus(u.id,u.status)}>{u.status==='active'?'Suspender':'Reativar'}</button>}</div></td>
              </tr>)}
            </tbody></table></div>
            {!filteredUsers.length&&<Empty icon={UsersRound} title="Nenhum usuário encontrado" description="Cadastre um usuário para começar."/>}
          </div>
          <aside className="adm-surface adm-creation">
            
            <h4>Adicionar usuário</h4>
            <p>Crie uma conta de trabalho e depois defina a qual empresa ela terá acesso.</p>
            <form className="adm-form" onSubmit={createUser}>
              <label>Nome completo<input required minLength={2} maxLength={150} placeholder="Nome e sobrenome" autoComplete="off" value={name} onChange={e=>setName(e.target.value)}/></label>
              <label>E-mail<input required type="email" placeholder="nome@empresa.com" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)}/></label>
              <label>Senha inicial <small>mínimo 12 caracteres</small><input required type="password" minLength={12} maxLength={128} placeholder="Senha forte e individual" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
              <button disabled={saving} className="adm-primary adm-wide">{saving?'Cadastrando...':'Cadastrar usuário'}<ArrowRight size={17}/></button>
            </form>
            <div className="adm-form-note"><LockKeyhole size={15}/> A criação exige autorização do Super Admin.</div>
          </aside>
        </div>
      </>}

      {tab==='permissions'&&<>
        <div className="adm-section-heading"><div><h3>Permissões de acesso</h3><p>Cada pessoa vê apenas as empresas vinculadas à sua conta.</p></div></div>
        <div className="adm-columns">
          <div className="adm-surface adm-list-surface">
            <div className="adm-list-controls"><div className="adm-count-title"><ShieldCheck size={18}/> Acessos cadastrados <span>{members.length}</span></div></div>
            <div className="adm-tablewrap"><table className="adm-table"><thead><tr><th>Pessoa</th><th>Empresa</th><th>Função</th><th>Status</th><th className="adm-right">Ação</th></tr></thead><tbody>
              {members.map(m=><tr key={m.id}>
                <td><strong>{userNameById(m.user_id)}</strong></td>
                <td>{companyNameById(m.organization_id)}</td><td><span className="adm-role">{ROLE_NAME[m.role]||m.role}</span></td>
                <td><Pill status={m.status}/></td>
                <td><button disabled={saving} className="adm-textbtn" onClick={()=>changeMemberStatus(m)}>{m.status==='active'?'Remover':'Reativar'}</button></td>
              </tr>)}
            </tbody></table></div>
            {!members.length&&<Empty icon={LockKeyhole} title="Sem acessos atribuídos" description="Vincule um usuário a uma empresa para ativar a operação."/>}
          </div>
          <aside className="adm-surface adm-creation"><h4>Vincular acesso</h4><p>Defina a empresa e a função do usuário.</p>
            <form className="adm-form" onSubmit={addMember}>
              <label>Usuário<select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} required><option value="">Selecionar usuário</option>{users.filter(u=>u.status==='active'&&!u.is_super_admin).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
              <label>Empresa<select value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)} required><option value="">Selecionar empresa</option>{activeCompanies.filter(c=>c.status==='active').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
              <label>Função<select value={role} onChange={e=>setRole(e.target.value)}>{ROLES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
              <button disabled={saving||!selectedUser||!selectedCompany} className="adm-primary adm-wide">{saving?'Salvando...':'Salvar permissão'}<ArrowRight size={17}/></button>
            </form><div className="adm-form-note"><ShieldCheck size={15}/> Permissões verificadas no servidor.</div>
          </aside>
        </div>
      </>}

      {tab==='audits'&&<>
        <div className="adm-section-heading"><div><h3>Atividade recente</h3><p>Histórico administrativo dos últimos eventos registrados.</p></div></div>
        <div className="adm-columns">
          <div className="adm-surface adm-list-surface">
            <div className="adm-list-controls"><div className="adm-count-title"><Activity size={18}/> Linha do tempo <span>{audits.length}</span></div><span className="adm-updated">Últimos 50 eventos</span></div>
            <div className="adm-audit-list">{audits.map(a=><div key={a.id} className="adm-audit-item"><span className="adm-audit-icon"><Activity size={17}/></span><div><strong>{auditLabel(a.action)}</strong><span>Por {userNameById(a.user_id)} · {ENTITY_LABEL[a.entity_type]||a.entity_type||'sistema'}</span></div><time>{stamp(a.created_at)}</time></div>)}</div>
            {!audits.length&&<Empty icon={Activity} title="Nenhuma atividade registrada" description="Os eventos administrativos aparecerão aqui."/>}
          </div>
          <aside className="adm-surface adm-creation adm-security-panel">
            <h4>Trilha de auditoria</h4><p>As alterações de empresa são registradas para facilitar o acompanhamento das ações administrativas.</p>
            <div className="adm-security-point"><CheckCircle2 size={17}/> Controle de acesso por usuário</div>
            <div className="adm-security-point"><CheckCircle2 size={17}/> Gestão de empresas reversível</div>
            <div className="adm-security-point"><CheckCircle2 size={17}/> Exclusões com confirmação</div>
          </aside>
        </div>
      </>}
    </section>
    {confirm&&<div className="adm-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!saving){setConfirm(null);setConfirmationName('')}}}>
      <div className="adm-dialog" role="dialog" aria-modal="true" aria-labelledby="adm-dialog-title">
        <button className="adm-close" aria-label="Fechar" onClick={()=>{setConfirm(null);setConfirmationName('')}} disabled={saving}><X size={19}/></button>
        <div className={'adm-dialog-icon '+(confirm.action==='delete'?'adm-dialog-icon--danger':'')}>{confirm.action==='delete'?<Trash2 size={25}/>:confirm.action==='restore'?<RotateCcw size={25}/>:<Archive size={25}/>}</div>
        <h3 id="adm-dialog-title">{confirm.action==='archive'?'Arquivar empresa?':confirm.action==='restore'?'Restaurar empresa?':'Excluir definitivamente?'}</h3>
        <p>{confirm.action==='archive'?<>A empresa <strong>{confirm.company.name}</strong> sairá das operações ativas. Os dados serão preservados e você poderá restaurá-la depois.</>:confirm.action==='restore'?<>A empresa <strong>{confirm.company.name}</strong> voltará a aparecer na operação.</>:<>Esta ação é irreversível. Só funciona para uma empresa <strong>arquivada e sem dados operacionais</strong>. Se houver registros, o sistema bloqueará a exclusão.</>}</p>
        {confirm.action==='delete'&&<label className="adm-confirm-label">Digite <strong>{confirm.company.name}</strong> para confirmar<input autoFocus value={confirmationName} onChange={e=>setConfirmationName(e.target.value)} placeholder="Nome exato da empresa"/></label>}
        <div className="adm-dialog-actions"><button type="button" className="adm-secondary" autoFocus={confirm.action!=='delete'} disabled={saving} onClick={()=>{setConfirm(null);setConfirmationName('')}}>Cancelar</button><button className={'adm-primary '+(confirm.action==='delete'?'adm-primary--danger':'')} disabled={saving||(confirm.action==='delete'&&confirmationName!==confirm.company.name)} onClick={manageCompany}>{saving?'Processando...':confirm.action==='archive'?'Sim, arquivar':confirm.action==='restore'?'Restaurar empresa':'Excluir definitivamente'}</button></div>
      </div>
    </div>}
  </div>;
}
