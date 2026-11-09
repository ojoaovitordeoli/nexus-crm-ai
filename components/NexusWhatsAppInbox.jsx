'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {ExternalLink,Info,Plus,RefreshCw,Search,ShieldCheck,X} from 'lucide-react';
import {db} from '../lib/supabase';

const localDate=t=>t?new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const initial=s=>String(s||'?').slice(-2).toUpperCase();
export default function NexusWhatsAppInbox({organizationId,contacts=[],isSuperAdmin=false}){
  const [connections,setConnections]=useState([]);
  const [messages,setMessages]=useState([]);
  const [serverReady,setServerReady]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [unavailable,setUnavailable]=useState('');
  const [notice,setNotice]=useState('');
  const [filter,setFilter]=useState('');
  const [selected,setSelected]=useState('');
  const [formOpen,setFormOpen]=useState(false);
  const [phoneId,setPhoneId]=useState('');
  const [displayName,setDisplayName]=useState('');
  const load=useCallback(async()=>{
    if(!organizationId){setLoading(false);return}
    setLoading(true);
    try{
      const {data:{session}}=await db.auth.getSession();
      if(!session?.access_token)throw new Error('Entre novamente para consultar suas mensagens.');
      const res=await fetch('/api/whatsapp/inbox?org_id='+encodeURIComponent(organizationId),{
        headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'
      });
      const result=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(result.error||'Não foi possível carregar o WhatsApp.');
      setConnections(result.connections||[]);setMessages(result.messages||[]);
      setServerReady(Boolean(result.verified_server));setError('');setUnavailable('');
    }catch(e){
      // Estrutura do banco ausente: estado neutro "não ativado"; o texto técnico fica só para Super Admin.
      if(/migra|instalad|supabase/i.test(e.message)){setUnavailable(e.message);setError('')}
      else setError(e.message);
    }
    finally{setLoading(false)}
  },[organizationId]);
  useEffect(()=>{load()},[load]);
  const people=useMemo(()=>{
    const map=new Map();
    const ordered=[...messages].sort((a,b)=>new Date(b.occurred_at)-new Date(a.occurred_at));
    for(const msg of ordered){
      if(!map.has(msg.wa_id))map.set(msg.wa_id,msg);
    }
    return [...map.entries()].filter(([wa])=>{
      const name=contacts.find(c=>String(c.whatsapp||'').replace(/\D/g,'').endsWith(wa.replace(/^55/,'')))?.first_name||'';
      return (name+' '+wa).toLowerCase().includes(filter.toLowerCase());
    });
  },[messages,contacts,filter]);
  const activeWa=selected||people[0]?.[0]||'';
  const currentMessages=messages.filter(m=>m.wa_id===activeWa).sort((a,b)=>new Date(a.occurred_at)-new Date(b.occurred_at));
  const currentName=contacts.find(c=>String(c.whatsapp||'').replace(/\D/g,'').endsWith(activeWa.replace(/^55/,'')))?.first_name||activeWa;
  const link=activeWa?'https://wa.me/'+activeWa:null;
  async function register(e){
    e.preventDefault();if(!isSuperAdmin||busy)return;
    setBusy(true);setError('');setNotice('');
    try{
      const {data:{session}}=await db.auth.getSession();
      if(!session?.access_token)throw new Error('Sessão expirada.');
      const response=await fetch('/api/whatsapp/inbox',{
        method:'POST',
        headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
        body:JSON.stringify({org_id:organizationId,phone_number_id:phoneId,display_name:displayName})
      });
      const result=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(result.error||'Falha ao cadastrar o número.');
      setNotice(result.message);setPhoneId('');setDisplayName('');setFormOpen(false);
      await load();
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }
  const nameFor=wa=>contacts.find(c=>String(c.whatsapp||'').replace(/\D/g,'').endsWith(wa.replace(/^55/,'')))?.first_name||wa;
  return <div className="fx-page fx-int fx-wa-page">
    <header className="fx-pagehead">
      <div className="fx-pagehead-title"><h1>WhatsApp</h1>
        {!unavailable&&!loading&&<span className="fx-count">{people.length} {people.length===1?'conversa':'conversas'}</span>}
        <span className="fx-count">{unavailable?'Não ativado':'Somente leitura'}</span>
      </div>
      <div className="fx-actions"><button className="fx-btn" disabled={loading} onClick={load} type="button"><RefreshCw size={16}/> Atualizar</button></div>
    </header>
    {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    {notice&&<div className="fx-alert fx-alert--ok" role="status">{notice}</div>}

    {unavailable?<section className="fx-box fx-int-off" aria-labelledby="fx-wa-off">
      <div className="fx-int-off-body">
        <Info size={18} aria-hidden="true"/>
        <div><h2 id="fx-wa-off">WhatsApp ainda não ativado</h2>
          <p>O administrador da sua empresa precisa ativar a caixa de entrada do WhatsApp. Até lá, nenhuma mensagem é recebida aqui.</p></div>
      </div>
      {isSuperAdmin&&<p className="fx-boxfoot fx-int-tech"><strong>Detalhe técnico (Super Admin):</strong> {unavailable} Arquivo: <code>supabase/20261028_automation_whatsapp_foundation.sql</code></p>}
    </section>:<>
    <section className="fx-box">
      <div className="fx-boxhead"><h2>Números conectados</h2><span className="fx-groupcount">{connections.length}</span>
        {isSuperAdmin&&<button type="button" className="fx-btn fx-int-meta-end" aria-expanded={formOpen} onClick={()=>setFormOpen(v=>!v)}>{formOpen?<><X size={16}/> Fechar cadastro</>:<><Plus size={16}/> Registrar número da Meta</>}</button>}
      </div>
      {formOpen&&isSuperAdmin&&<form className="fx-panel fx-wa-setup" onSubmit={register} aria-label="Registrar Phone Number ID">
        <label>Phone Number ID<input required placeholder="Ex.: 112233445566778" pattern="[0-9]{6,24}" value={phoneId} onChange={e=>setPhoneId(e.target.value)}/></label>
        <label>Nome de exibição<input placeholder="Ex.: Atendimento principal" maxLength={100} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
        <button className="fx-btn fx-btn--primary" type="submit" disabled={busy}>{busy?'Registrando...':'Registrar número'}</button>
        <p className="fx-wa-setup-note"><ShieldCheck size={15}/> Use o identificador numérico do painel Meta Developers; este cadastro não solicita nem armazena token. No Render, configure META_APP_SECRET e META_WEBHOOK_VERIFY_TOKEN. Na Meta, assine os eventos de mensagens para <code>https://nexus-crm-ai.onrender.com/api/webhooks/whatsapp</code>. O status é ativado quando o primeiro evento válido chegar.</p>
      </form>}
      {connections.map(c=><div className="fx-row fx-wa-conn" key={c.id}>
        <div><strong>{c.display_name}</strong><small>ID {c.phone_number_id}</small></div>
        <span className={'fx-int-status '+(c.status==='active'?'is-on':'is-off')}>{c.status==='active'?'Recebendo':'Aguardando Meta'}</span>
      </div>)}
      {!connections.length&&<p className="fx-empty-small">{loading?'Carregando...':'Nenhum número conectado. O administrador conecta o número oficial da empresa para receber as mensagens aqui.'}</p>}
      {isSuperAdmin&&<p className="fx-boxfoot">{serverReady?'Servidor pronto para receber webhooks assinados.':'A API da Meta ainda precisa ser configurada no Render.'}</p>}
    </section>

    <section className="fx-box fx-wa-inbox">
      <div className="fx-boxhead"><h2>Conversas recebidas</h2><span className="fx-groupcount">{people.length}</span>
        <label className="fx-search fx-search--end"><Search size={15}/><input placeholder="Pesquisar telefone ou contato" aria-label="Pesquisar conversas" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
      </div>
      {people.length?<div className="fx-wa-layout">
        <div className="fx-wa-list">{people.map(([wa,msg])=><button key={wa} type="button" aria-pressed={activeWa===wa} className={'fx-wa-item'+(activeWa===wa?' is-active':'')} onClick={()=>setSelected(wa)}>
          <span className="fx-avatar">{initial(wa)}</span><span className="fx-wa-item-text"><strong>{nameFor(wa)}</strong><small>{msg.message_type==='text'?(msg.text_body||'Mensagem sem texto'):'Mensagem de '+msg.message_type}</small></span><time>{localDate(msg.occurred_at)}</time>
        </button>)}</div>
        <div className="fx-wa-thread">
          <div className="fx-wa-threadhead"><span className="fx-avatar">{initial(activeWa)}</span><div><strong>{currentName}</strong><small>WhatsApp {activeWa}</small></div>
            {link&&<a className="fx-btn" href={link} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp externo"><ExternalLink size={15}/> Abrir no WhatsApp</a>}</div>
          <div className="fx-wa-messages">{currentMessages.map(m=><div key={m.id} className={'fx-wa-msg '+(m.direction==='outbound'?'is-out':'is-in')}>
            <p>{m.message_type==='text'?(m.text_body||'Mensagem sem texto'):'Mensagem '+m.message_type+' recebida'}</p>
            <small>{localDate(m.occurred_at)}{m.delivery_status&&' · '+m.delivery_status}</small>
          </div>)}</div>
        </div>
      </div>:<div className="fx-empty"><strong>{loading?'Carregando conversas...':filter?'Nenhuma conversa encontrada':'Nenhuma mensagem recebida'}</strong>{!loading&&<p>{filter?'Ajuste a busca.':'As mensagens recebidas pelo número oficial da empresa aparecerão aqui.'}</p>}</div>}
      <p className="fx-boxfoot fx-boxfoot--note"><ShieldCheck size={14}/> Caixa de entrada somente leitura da API oficial da Meta. O NEXUS não envia mensagens; para responder, use o WhatsApp da empresa.</p>
    </section>
    </>}
  </div>;
}
