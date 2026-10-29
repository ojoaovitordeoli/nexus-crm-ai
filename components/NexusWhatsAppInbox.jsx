'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {CheckCheck,ChevronRight,ContactRound,ExternalLink,Inbox,MessageCircle,PlugZap,RefreshCw,Search,Send,ShieldCheck,WifiOff} from 'lucide-react';
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
      setServerReady(Boolean(result.verified_server));setError('');
    }catch(e){setError(e.message)}
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
  return <div className="nx-inbox-page">
    <header className="nx-inbox-head"><div><span className="nx-inbox-kicker"><MessageCircle size={16}/> NEXUS / ATENDIMENTO</span><h1>WhatsApp Business</h1><p>Recebimento oficial de mensagens, protegido por empresa. As conversas só aparecem depois da conexão com a Meta.</p></div>
    <button className="nx-inbox-button" disabled={loading} onClick={load} type="button"><RefreshCw size={17}/> Atualizar</button></header>
    {error&&<div className="nx-inbox-alert nx-inbox-alert--error" role="alert">{error}</div>}
    {notice&&<div className="nx-inbox-alert nx-inbox-alert--success" role="status">{notice}</div>}
    <section className="nx-inbox-connections">
      <div><span className="nx-inbox-kicker">CANAIS DE ATENDIMENTO</span><h2>Conexões da empresa</h2><p>{serverReady?'Servidor pronto para receber webhooks assinados.':'A API da Meta ainda precisa ser configurada no Render.'}</p></div>
      <div className="nx-inbox-conn-list">{connections.map(c=><div className="nx-inbox-conn" key={c.id}><span className={c.status==='active'?'ready':'waiting'}><PlugZap size={19}/></span><div><strong>{c.display_name}</strong><small>ID: {c.phone_number_id}</small></div><em className={c.status==='active'?'ready':'waiting'}>{c.status==='active'?'Recebendo':'Aguardando Meta'}</em></div>)}
      {!connections.length&&<span className="nx-inbox-no-connection"><WifiOff size={20}/> Nenhum número vinculado</span>}</div>
      {isSuperAdmin&&<button type="button" className="nx-inbox-button nx-inbox-button--primary" onClick={()=>setFormOpen(v=>!v)}>{formOpen?'Fechar cadastro':'Registrar número da Meta'} <ChevronRight size={17}/></button>}
    </section>
    {formOpen&&isSuperAdmin&&<form className="nx-inbox-setup" onSubmit={register}>
      <h3>Registrar Phone Number ID</h3><p>Use o identificador numérico obtido no painel Meta Developers. Este cadastro não solicita nem armazena token de acesso.</p>
      <label>Phone Number ID<input required placeholder="Ex.: 112233445566778" pattern="[0-9]{6,24}" value={phoneId} onChange={e=>setPhoneId(e.target.value)}/></label>
      <label>Nome de exibição<input placeholder="Ex.: Atendimento principal" maxLength={100} value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
      <button className="nx-inbox-button nx-inbox-button--primary" type="submit" disabled={busy}>{busy?'Registrando...':'Registrar número'}</button>
      <div className="nx-inbox-setup-notice"><ShieldCheck size={17}/> No Render, configure META_APP_SECRET e META_WEBHOOK_VERIFY_TOKEN. Na Meta, assine os eventos de mensagens para <code>https://nexus-crm-ai.onrender.com/api/webhooks/whatsapp</code>. O status será ativado quando o primeiro evento válido chegar.</div>
    </form>}
    <div className="nx-inbox-layout">
      <aside className="nx-inbox-list">
        <div className="nx-inbox-title"><Inbox size={19}/><strong>Conversas recebidas</strong><span>{people.length}</span></div>
        <label className="nx-inbox-search"><Search size={17}/><input placeholder="Pesquisar telefone ou contato" aria-label="Pesquisar conversas" value={filter} onChange={e=>setFilter(e.target.value)}/></label>
        <div className="nx-inbox-conversations">{people.map(([wa,msg])=><button key={wa} type="button" className={'nx-inbox-conversation '+(activeWa===wa?'selected':'')} onClick={()=>setSelected(wa)}>
          <span className="nx-inbox-avatar">{initial(wa)}</span><span><strong>{contacts.find(c=>String(c.whatsapp||'').replace(/\D/g,'').endsWith(wa.replace(/^55/,'')))?.first_name||wa}</strong><small>{msg.message_type==='text'?(msg.text_body||'Mensagem sem texto'):'Mensagem de '+msg.message_type}</small></span><time>{localDate(msg.occurred_at)}</time>
        </button>)}{!people.length&&<div className="nx-inbox-empty"><MessageCircle size={25}/><strong>Sem mensagens sincronizadas</strong><p>Quando um número autorizado receber mensagens pela API oficial, elas aparecerão aqui.</p></div>}</div>
      </aside>
      <section className="nx-inbox-thread">
        {activeWa?<><header><span className="nx-inbox-avatar">{initial(activeWa)}</span><div><strong>{currentName}</strong><small>WhatsApp {activeWa}</small></div>{link&&<a href={link} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp externo"><ExternalLink size={18}/></a>}</header>
        <div className="nx-inbox-messages">{currentMessages.map(m=><div key={m.id} className={'nx-inbox-bubble '+(m.direction==='outbound'?'outbound':'inbound')}>
          <p>{m.message_type==='text'?(m.text_body||'Mensagem sem texto'):'Mensagem '+m.message_type+' recebida'}</p>
          <small>{localDate(m.occurred_at)}{m.delivery_status&&' · '+m.delivery_status}</small>
        </div>)}</div>
        <footer><ShieldCheck size={18}/><span>Caixa de entrada somente leitura. O envio integrado será liberado após configurar token seguro, consentimento e política de janela de atendimento.</span>{link&&<a href={link} target="_blank" rel="noopener noreferrer">Responder pelo WhatsApp <Send size={15}/></a>}</footer>
        </>:<div className="nx-inbox-empty nx-inbox-empty--thread"><Inbox size={35}/><strong>Suas mensagens, em um só lugar</strong><p>Conecte o número da Meta e receba eventos para começar o histórico real.</p></div>}
      </section>
    </div>
  </div>;
}
