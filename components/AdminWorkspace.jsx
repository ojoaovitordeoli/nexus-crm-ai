'use client';
import { useCallback, useEffect, useState } from 'react';
import { db } from '../lib/supabase';

const ROLES=[
  ['AGENCY_ADMIN','Admin da agência'],
  ['ORGANIZATION_ADMIN','Admin da empresa'],
  ['MANAGER','Gerente'],
  ['SDR','SDR'],
  ['SELLER','Vendedor'],
  ['VIEWER','Visualizador']
];
const ROLE_NAME=Object.fromEntries(ROLES);
const date=iso=>iso?new Date(iso).toLocaleString('pt-BR'):'—';
const css={width:'100%',maxWidth:460};
function AdminError({children}){return <div className="notice error" role="alert">{children}</div>}
function AdminInfo({children}){return <div className="notice success" role="status">{children}</div>}

export default function AdminWorkspace({isAdmin,onRefresh}) {
  const [tab,setTab]=useState('companies');
  const [users,setUsers]=useState([]);
  const [companies,setCompanies]=useState([]);
  const [members,setMembers]=useState([]);
  const [audits,setAudits]=useState([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [success,setSuccess]=useState('');
  const [search,setSearch]=useState('');
  const [companyName,setCompanyName]=useState('');
  const [name,setName]=useState('');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [selectedUser,setSelectedUser]=useState('');
  const [selectedCompany,setSelectedCompany]=useState('');
  const [role,setRole]=useState('SELLER');

  const clearMessage=()=>{setError('');setSuccess('')};
  const load=useCallback(async()=>{
    if(!db||!isAdmin)return;
    setLoading(true);
    const [p,o,m,a]=await Promise.all([
      db.from('profiles').select('id,full_name,is_super_admin,status').order('full_name').limit(500),
      db.from('organizations').select('id,name,plan,status').order('name').limit(500),
      db.from('organization_members').select('id,organization_id,user_id,role,status').limit(1000),
      db.from('audit_logs').select('id,user_id,action,entity_type,created_at').order('created_at',{ascending:false}).limit(50)
    ]);
    const failed=[p,o,m,a].find(x=>x.error);
    if(failed)setError('Erro ao consultar dados administrativos: '+failed.error.message);
    if(!p.error)setUsers(p.data||[]);
    if(!o.error)setCompanies(o.data||[]);
    if(!m.error)setMembers(m.data||[]);
    if(!a.error)setAudits(a.data||[]);
    setLoading(false);
  },[isAdmin]);
  useEffect(()=>{load()},[load]);

  async function createCompany(e){
    e.preventDefault();clearMessage();
    const clean=companyName.trim();
    if(clean.length<2){setError('Informe o nome da empresa.');return}
    setSaving(true);
    const slug=clean.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
      .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'-'+Date.now().toString(36);
    const {error:e2}=await db.rpc('admin_create_organization',{p_name:clean,p_slug:slug,p_plan:'free'});
    if(e2)setError('Não foi possível criar empresa: '+e2.message+' (confira as migrações administrativas).');
    else{setCompanyName('');setSuccess('Empresa criada com funil padrão de oito etapas.');await load();if(onRefresh)await onRefresh();}
    setSaving(false);
  }
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
      const data=await r.json();
      if(!r.ok)throw Error(data.error||'Erro ao criar usuário.');
      setName('');setEmail('');setPassword('');
      setSuccess('Usuário cadastrado. Agora vincule-o à empresa usando o formulário ao lado.'+(data.warning?' '+data.warning:''));
      await load();
    }catch(ex){setError(ex.message||'Não foi possível cadastrar usuário.')}
    finally{setSaving(false)}
  }
  async function addMember(e){
    e.preventDefault();clearMessage();
    if(!selectedUser||!selectedCompany){setError('Escolha um usuário e uma empresa.');return}
    setSaving(true);
    const {error:e2}=await db.rpc('admin_add_member',{
      p_user_id:selectedUser,p_org_id:selectedCompany,p_role:role
    });
    if(e2)setError('Não foi possível vincular o usuário: '+e2.message+'. Verifique se a função admin_add_member existe no Supabase.');
    else{setSuccess('Usuário vinculado à empresa com a permissão selecionada.');await load();}
    setSaving(false);
  }
  async function changeUserStatus(id,current){
    const next=current==='active'?'suspended':'active';
    if(!window.confirm((next==='suspended'?'Suspender':'Reativar')+' este usuário?'))return;
    clearMessage();setSaving(true);
    const {error:e2}=await db.rpc('admin_set_profile_status',{p_user_id:id,p_status:next});
    if(e2)setError('Não foi possível atualizar o usuário: '+e2.message);
    else{setSuccess('Status do usuário atualizado.');await load();}
    setSaving(false);
  }
  async function changeMemberStatus(m){
    const next=m.status==='active'?'removed':'active';
    if(!window.confirm((next==='removed'?'Remover o vínculo deste usuário':'Reativar o vínculo')+'?'))return;
    clearMessage();setSaving(true);
    const {error:e2}=await db.rpc('admin_set_member_status',{p_member_id:m.id,p_status:next});
    if(e2)setError('Não foi possível atualizar o vínculo: '+e2.message);
    else{setSuccess('Vínculo atualizado.');await load();}
    setSaving(false);
  }
  if(!isAdmin)return <AdminError>Esta área é exclusiva do Super Admin. O acesso depende do perfil no Supabase.</AdminError>;
  const companyNameById=id=>companies.find(c=>c.id===id)?.name||'Empresa não localizada';
  const userNameById=id=>users.find(u=>u.id===id)?.full_name||'Usuário não localizado';
  const matches=(value)=>String(value||'').toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'));
  return <div className="stack">
    <div className="grid">
      <div className="glass metric"><div className="muted">Empresas</div><div className="number">{companies.length}</div><span className="small muted">Cadastradas no CRM</span></div>
      <div className="glass metric"><div className="muted">Usuários</div><div className="number">{users.length}</div><span className="small muted">Contas registradas</span></div>
      <div className="glass metric"><div className="muted">Vínculos ativos</div><div className="number">{members.filter(m=>m.status==='active').length}</div><span className="small muted">Acessos por empresa</span></div>
      <div className="glass metric"><div className="muted">Eventos recentes</div><div className="number">{audits.length}</div><span className="small muted">Até 50 registros</span></div>
    </div>

    <div className="glass panel">
      <div className="filter" role="tablist" aria-label="Áreas administrativas">
        {[['companies','Empresas'],['users','Usuários'],['permissions','Acessos'],['audits','Auditoria']].map(([id,label])=>
          <button key={id} role="tab" aria-selected={tab===id} className={'btn btnsmall '+(tab===id?'current':'subtle')} onClick={()=>{setTab(id);clearMessage()}}>{label}</button>
        )}
        <button className="btn btnsmall subtle" onClick={load} disabled={saving||loading}>Atualizar dados</button>
      </div>
      {error&&<div style={{marginTop:16}}><AdminError>{error}</AdminError></div>}
      {success&&<div style={{marginTop:16}}><AdminInfo>{success}</AdminInfo></div>}
      <p className="sectiontip">Área reservada ao proprietário do sistema. Cada usuário comum deve ser vinculado à empresa em que vai trabalhar.</p>
    </div>
    {loading&&<div className="glass panel"><p className="muted">Consultando informações do Supabase...</p></div>}
    {tab==='companies'&&<div className="twocol">
      <div className="glass panel"><h2>Empresas cadastradas</h2>
        <label className="field">Buscar empresa<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome da empresa"/></label>
        <div className="tablewrap"><table className="tbl"><thead><tr><th>Empresa</th><th>Plano</th><th>Status</th><th>Usuários</th></tr></thead><tbody>
          {companies.filter(x=>matches(x.name)).map(x=><tr key={x.id}><td>{x.name}</td><td>{x.plan||'free'}</td><td><span className="pill">{x.status}</span></td><td>{members.filter(m=>m.organization_id===x.id&&m.status==='active').length}</td></tr>)}
        </tbody></table></div>{companies.length===0&&<div className="empty">Nenhuma empresa cadastrada.</div>}
      </div>
      <div className="glass panel"><h2>Adicionar empresa</h2><p className="muted small">Cria a empresa e as oito etapas padrão do funil, se a migração estiver instalada.</p>
        <form onSubmit={createCompany} className="stack">
          <label className="field">Nome da empresa<input value={companyName} onChange={e=>setCompanyName(e.target.value)} minLength={2} required placeholder="Ex.: Ótica Exemplo" /></label>
          <button disabled={saving} className="btn primary">{saving?'Salvando...':'Criar empresa'}</button>
        </form>
      </div>
    </div>}
    {tab==='users'&&<div className="twocol">
      <div className="glass panel"><h2>Usuários</h2><label className="field">Buscar usuário<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome do usuário"/></label>
        <div className="tablewrap"><table className="tbl"><thead><tr><th>Nome</th><th>Perfil</th><th>Status</th><th>Ação</th></tr></thead><tbody>
        {users.filter(x=>matches(x.full_name)).map(x=><tr key={x.id}>
          <td>{x.full_name}</td><td>{x.is_super_admin?'Super Admin':'Operação'}</td>
          <td><span className="pill">{x.status||'active'}</span></td>
          <td>{x.is_super_admin?<span className="small muted">Protegido</span>:
            <button disabled={saving} className="btn btnsmall subtle" onClick={()=>changeUserStatus(x.id,x.status)}>{x.status==='active'?'Suspender':'Reativar'}</button>}</td>
        </tr>)}</tbody></table></div>{users.length===0&&<div className="empty">Nenhum usuário encontrado.</div>}
      </div>
      <div className="glass panel"><h2>Adicionar usuário</h2>
        <p className="muted small">Criação segura pelo servidor. Não envia e-mail, evitando o limite atual do Supabase.</p>
        <form onSubmit={createUser} className="stack">
          <label className="field">Nome completo<input required minLength={2} value={name} onChange={e=>setName(e.target.value)} autoComplete="off" placeholder="Nome e sobrenome"/></label>
          <label className="field">E-mail<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="off" placeholder="pessoa@empresa.com.br"/></label>
          <label className="field">Senha inicial (mínimo 12 caracteres)<input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Senha individual"/></label>
          <button disabled={saving} className="btn primary">{saving?'Criando...':'Cadastrar usuário'}</button>
          <p className="sectiontip">Requer a variável SUPABASE_SERVICE_ROLE_KEY configurada exclusivamente no servidor Netlify. Nunca compartilhe essa chave.</p>
        </form>
      </div>
    </div>}
    {tab==='permissions'&&<div className="twocol">
      <div className="glass panel"><h2>Vincular usuário à empresa</h2><p className="muted small">Cada vínculo define em qual empresa o usuário pode trabalhar e seu papel.</p>
        <form onSubmit={addMember} className="stack">
          <label className="field">Usuário<select required className="textbox" value={selectedUser} onChange={e=>setSelectedUser(e.target.value)}><option value="">Selecione um usuário</option>{users.filter(u=>u.status==='active'&&!u.is_super_admin).map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
          <label className="field">Empresa<select required className="textbox" value={selectedCompany} onChange={e=>setSelectedCompany(e.target.value)}><option value="">Selecione uma empresa</option>{companies.filter(c=>c.status==='active').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label className="field">Papel<select className="textbox" value={role} onChange={e=>setRole(e.target.value)}>{ROLES.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label>
          <button disabled={saving} className="btn primary">Salvar acesso</button>
        </form>
      </div>
      <div className="glass panel"><h2>Acessos cadastrados</h2>
        <div className="tablewrap"><table className="tbl"><thead><tr><th>Usuário</th><th>Empresa</th><th>Papel</th><th>Status</th><th>Ação</th></tr></thead><tbody>
          {members.map(m=><tr key={m.id}><td>{userNameById(m.user_id)}</td><td>{companyNameById(m.organization_id)}</td><td>{ROLE_NAME[m.role]||m.role}</td><td><span className="pill">{m.status}</span></td>
            <td><button disabled={saving} className="btn btnsmall subtle" onClick={()=>changeMemberStatus(m)}>{m.status==='active'?'Remover':'Reativar'}</button></td>
          </tr>)}
        </tbody></table></div>{members.length===0&&<div className="empty">Nenhum acesso cadastrado.</div>}
      </div>
    </div>}
    {tab==='audits'&&<div className="glass panel"><h2>Auditoria administrativa</h2>
      <p className="muted small">Últimos 50 registros salvos no banco, sem informações sensíveis.</p>
      <div className="tablewrap"><table className="tbl"><thead><tr><th>Data</th><th>Evento</th><th>Usuário</th><th>Entidade</th></tr></thead><tbody>
        {audits.map(x=><tr key={x.id}><td>{date(x.created_at)}</td><td>{x.action}</td><td>{userNameById(x.user_id)}</td><td>{x.entity_type||'—'}</td></tr>)}
      </tbody></table></div>{audits.length===0&&<div className="empty">Nenhuma atividade registrada.</div>}
    </div>}
  </div>;
}
