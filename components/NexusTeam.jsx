'use client';
import {useCallback,useEffect,useState} from 'react';
import {UserPlus,X} from 'lucide-react';
import {db} from '../lib/supabase';

// Equipe da empresa: o admin cadastra, muda a função e desativa pessoas.
// As regras valem no servidor (app/api/team); aqui só mostramos o que é permitido.
const randomPassword=()=>{
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes=crypto.getRandomValues(new Uint32Array(14));
  return Array.from(bytes,b=>chars[b%chars.length]).join('');
};

export default function NexusTeam({organizationId}){
  const [state,setState]=useState({status:'loading',members:[],roles:[]});
  const [error,setError]=useState('');const [notice,setNotice]=useState('');
  const [open,setOpen]=useState(false);const [busy,setBusy]=useState('');
  const [form,setForm]=useState({full_name:'',email:'',role:'SELLER',password:''});

  const call=useCallback(async(method,body)=>{
    const {data:{session}}=await db.auth.getSession();
    if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
    const res=await fetch(method==='GET'?'/api/team?org_id='+encodeURIComponent(organizationId):'/api/team',{
      method,headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify({org_id:organizationId,...body})}:{})});
    const json=await res.json().catch(()=>null);
    if(!res.ok)throw new Error(json?.error||'Falha de comunicação com o servidor.');
    return json;
  },[organizationId]);

  const load=useCallback(async()=>{
    if(!organizationId)return;
    try{const r=await call('GET');setState({status:'ready',members:r.members||[],roles:r.can_assign||[]})}
    catch(e){setState(s=>({...s,status:'error'}));setError(e.message)}
  },[call,organizationId]);
  useEffect(()=>{load()},[load]);

  async function invite(e){
    e.preventDefault();if(busy)return;
    setBusy('invite');setError('');setNotice('');
    try{const r=await call('POST',{action:'invite',...form});setNotice(r.message);setForm({full_name:'',email:'',role:'SELLER',password:''});setOpen(false);await load()}
    catch(err){setError(err.message)}finally{setBusy('')}
  }
  async function change(member,patch){
    if(busy)return;setBusy(member.id);setError('');setNotice('');
    try{const r=await call('POST',{action:patch.role?'role':'status',member_id:member.id,...patch});setNotice(r.message);await load()}
    catch(err){setError(err.message)}finally{setBusy('')}
  }
  const active=state.members.filter(m=>m.status==='active'),inactive=state.members.filter(m=>m.status!=='active');

  return <section className="fx-box fx-team" aria-labelledby="fx-team-title">
    <div className="fx-boxhead"><h2 id="fx-team-title">Equipe</h2><span className="fx-groupcount">{active.length}</span>
      <button type="button" className="fx-btn fx-btn--primary fx-team-add" aria-expanded={open} onClick={()=>{setOpen(v=>!v);if(!form.password)setForm(f=>({...f,password:randomPassword()}))}}>
        {open?<><X size={15}/> Fechar</>:<><UserPlus size={15}/> Adicionar pessoa</>}</button>
    </div>
    {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    {notice&&<div className="fx-alert fx-alert--ok" role="status">{notice}</div>}
    {open&&<form className="fx-panel fx-team-form" onSubmit={invite} aria-label="Adicionar pessoa à equipe">
      <label>Nome<input required minLength={2} maxLength={150} value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} autoFocus/></label>
      <label>E-mail<input required type="email" maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
      <label>Função<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}>{state.roles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}</select></label>
      <label>Senha inicial<input required minLength={12} maxLength={128} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} spellCheck={false} autoComplete="off"/></label>
      <button type="submit" className="fx-btn fx-btn--primary" disabled={busy==='invite'}>{busy==='invite'?'Cadastrando...':'Cadastrar'}</button>
      <p className="fx-muted fx-team-hint">Anote a senha inicial e passe para a pessoa junto com o e-mail. Ela pode trocar depois em "Esqueci minha senha".</p>
    </form>}
    {state.status==='loading'&&<p className="fx-muted fx-team-empty">Carregando a equipe...</p>}
    {state.status==='ready'&&<div className="fx-team-list">
      {active.map(m=><div className="fx-row fx-team-row" key={m.id}>
        <span className="fx-avatar">{m.full_name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span>
        <span className="fx-team-who"><strong>{m.full_name}{m.is_me&&<small> (você)</small>}</strong><small>{m.email}</small></span>
        {m.editable?<select aria-label={'Função de '+m.full_name} value={m.role} disabled={busy===m.id} onChange={e=>change(m,{role:e.target.value})}>
          {state.roles.some(r=>r.value===m.role)?null:<option value={m.role}>{m.role_label}</option>}
          {state.roles.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
        </select>:<span className="fx-muted">{m.role_label}</span>}
        {m.editable?<button type="button" className="nx13-linkbutton fx-team-off" disabled={busy===m.id} onClick={()=>change(m,{status:'removed'})}>Desativar</button>:<span/>}
      </div>)}
      {inactive.length>0&&<details className="fx-team-inactive"><summary>Desativados ({inactive.length})</summary>
        {inactive.map(m=><div className="fx-row fx-team-row" key={m.id}>
          <span className="fx-avatar">{m.full_name.slice(0,2).toUpperCase()}</span>
          <span className="fx-team-who"><strong>{m.full_name}</strong><small>{m.email}</small></span>
          <span className="fx-muted">{m.role_label}</span>
          {m.editable?<button type="button" className="nx13-linkbutton" disabled={busy===m.id} onClick={()=>change(m,{status:'active'})}>Reativar</button>:<span/>}
        </div>)}
      </details>}
    </div>}
  </section>;
}
