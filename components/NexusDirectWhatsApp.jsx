'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {ExternalLink,MessageCircle,Plus,RefreshCw,Send,ShieldAlert,Smartphone,Unplug} from 'lucide-react';
import {db} from '../lib/supabase';

export default function NexusDirectWhatsApp({organizationId}){
 const [connections,setConnections]=useState([]),[channel,setChannel]=useState(null);
 const [messages,setMessages]=useState([]),[target,setTarget]=useState(''),[draft,setDraft]=useState('');
 const [bridgeReady,setBridgeReady]=useState(false),[qr,setQr]=useState(null);
 const [label,setLabel]=useState(''),[visibility,setVisibility]=useState('private');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const api=useCallback(async(method='GET',data=null,connectionId='')=>{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error('Sua sessão expirou.');
  const params=new URLSearchParams({org_id:organizationId,...(connectionId?{connection_id:connectionId}:{})});
  const response=await fetch('/api/direct-whatsapp'+(method==='GET'?'?'+params:''),{
    method,headers:{Authorization:'Bearer '+session.access_token,...(data?{'Content-Type':'application/json'}:{})},
    ...(data?{body:JSON.stringify({org_id:organizationId,...data})}:{}),cache:'no-store'
  });
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(value.error||'O conector não respondeu.');
  return value;
 },[organizationId]);
 const load=useCallback(async()=>{setLoading(true);try{
    const r=await api();setConnections(r.connections||[]);setBridgeReady(Boolean(r.bridge_configured));setError('');
  }catch(e){setError(e.message)}finally{setLoading(false)}},[api]);
 useEffect(()=>{setChannel(null);setMessages([]);setTarget('');setQr(null);load()},[load]);
 const people=useMemo(()=>{
  const map=new Map();for(const m of messages){if(!map.has(m.remote_jid))map.set(m.remote_jid,[]);map.get(m.remote_jid).push(m)}
  return [...map.entries()].sort((a,b)=>new Date(b[1].at(-1)?.occurred_at||0)-new Date(a[1].at(-1)?.occurred_at||0));
 },[messages]);
 const thread=people.find(p=>p[0]===target)?.[1]||[];
 async function choose(c){
   setChannel(c);setQr(null);setTarget('');setMessages([]);setError('');
   try{const r=await api('GET',null,c.id);setMessages(r.messages||[])}catch(e){setError(e.message)}
 }
 async function create(e){
   e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
   try{const r=await api('POST',{action:'create',label:label.trim(),visibility});
     setNotice(r.message);setQr(r.qr);setLabel('');await load();setChannel(r.connection);setMessages([]);
   }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function operation(action){
   if(!channel||busy)return;setBusy(true);setError('');
   try{const r=await api('POST',{action,connection_id:channel.id});
     if(action==='qr')setQr(r.qr||null);
     if(action==='status')setNotice('Estado retornado pelo conector: '+r.state);
     if(action==='logout'){setQr(null);setNotice(r.message);setChannel({...channel,state:'close'})}
     await load();
   }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function send(e){
  e.preventDefault();if(!target||draft.trim().length<1||busy)return;
  setBusy(true);setError('');setNotice('');
  try{const r=await api('POST',{action:'send',connection_id:channel.id,remote_jid:target,text:draft.trim()});
    setDraft('');setNotice(r.message);const history=await api('GET',null,channel.id);setMessages(history.messages||[]);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div className="nxwa-page">
   <header className="nxwa-header"><div><span className="nxwa-eyebrow"><Smartphone size={16}/> NEXUS / WHATSAPP DIRETO</span><h1>Seu WhatsApp dentro do CRM.</h1><p>Conecte pelo QR Code de Aparelhos conectados, sem usar a Cloud API oficial da Meta.</p></div><button onClick={load} type="button" disabled={loading}><RefreshCw size={17}/> Atualizar canais</button></header>
   <div className="nxwa-warning"><ShieldAlert size={19}/><span>Conector experimental e não oficial via WhatsApp Web. Pode desconectar ou resultar em restrições da conta. Não use para disparos em massa. Sessões precisam de um serviço Evolution API próprio e persistente.</span></div>
   {error&&<div className="nxwa-error" role="alert">{error}</div>}{notice&&<div className="nxwa-notice" role="status">{notice}</div>}
   {!bridgeReady&&<div className="nxwa-setup">Para ativar, o administrador precisa configurar EVOLUTION_API_URL, EVOLUTION_API_KEY, NEXUS_PUBLIC_BASE_URL e NEXUS_DIRECT_WEBHOOK_SECRET no servidor. O QR não é gerado antes disso.</div>}
   <div className="nxwa-layout">
    <aside className="nxwa-channels"><div className="nxwa-channels-title">CANAIS {loading?'· consultando':''}</div>
      {connections.map(c=><button key={c.id} type="button" onClick={()=>choose(c)} className={channel?.id===c.id?'current':''}><MessageCircle size={17}/><span><strong>{c.label}</strong><small>{c.visibility==='private'?'Meu canal privado':'Canal da equipe'} · {c.state}</small></span></button>)}
      {!connections.length&&<p>Nenhum WhatsApp vinculado.</p>}
      <form className="nxwa-create" onSubmit={create}><strong><Plus size={16}/> Adicionar canal</strong><label>Nome<input value={label} minLength={2} maxLength={80} onChange={e=>setLabel(e.target.value)} placeholder="Ex.: Meu WhatsApp"/></label><label>Visibilidade<select value={visibility} onChange={e=>setVisibility(e.target.value)}><option value="private">Somente eu</option><option value="team">Compartilhar com equipe (gestor)</option></select></label><button type="submit" disabled={!bridgeReady||busy||label.trim().length<2}>{busy?'Criando...':'Gerar conexão QR'}</button></form>
    </aside>
    <section className="nxwa-main">
      {!channel?<div className="nxwa-placeholder"><Smartphone size={35}/><h2>Selecione ou conecte um canal</h2><p>Seu histórico aparecerá aqui depois de receber mensagens no número vinculado.</p></div>:<>
        <div className="nxwa-toolbar"><div><strong>{channel.label}</strong><small>{channel.visibility==='private'?'Visível apenas para seu usuário':'Compartilhado com a empresa'} · {channel.state}</small></div><button type="button" disabled={busy} onClick={()=>operation('status')}>Verificar status</button><button type="button" disabled={busy} onClick={()=>operation('qr')}>Exibir QR</button><button type="button" disabled={busy} onClick={()=>operation('logout')}><Unplug size={15}/> Desconectar</button></div>
        {qr&&<div className="nxwa-qr"><img src={qr} alt="QR Code temporário da sessão, a ser lido pelo WhatsApp no celular" width={220} height={220}/><div><strong>Conectar um aparelho</strong><p>No WhatsApp pessoal ou Business, entre em Aparelhos conectados → Conectar um aparelho e leia este QR. A sessão pertence ao serviço Evolution API, não ao navegador do Nexus.</p></div></div>}
        <div className="nxwa-messages-layout">
          <nav className="nxwa-people" aria-label="Conversas recebidas"><strong>CONVERSAS</strong>{people.map(([jid,items])=><button type="button" key={jid} className={target===jid?'active':''} onClick={()=>{setTarget(jid);setDraft('')}}><span>{jid.split('@')[0]}</span><small>{items.at(-1)?.text_body||'Mídia ou mensagem sem texto'}</small></button>)}{!people.length&&<p>Nenhuma mensagem recebida ou sincronizada.</p>}</nav>
          <div className="nxwa-thread">
            {target?<><div className="nxwa-thread-top">{target.split('@')[0]}</div><div className="nxwa-bubbles">{thread.map(m=><div key={m.id} className={m.from_me?'mine':'incoming'}><p>{m.text_body||'(Mensagem sem texto)'}</p><small>{new Date(m.occurred_at).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small></div>)}</div><form className="nxwa-reply" onSubmit={send}><textarea value={draft} rows={3} maxLength={3000} onChange={e=>setDraft(e.target.value)} placeholder="Escreva uma resposta manual..."/><button type="submit" disabled={busy||!/^\d{8,17}@s\.whatsapp\.net$/.test(target)||!draft.trim()}><Send size={16}/> Enviar</button></form></>:<div className="nxwa-placeholder">Escolha uma conversa para responder.</div>}
          </div>
        </div>
      </>}
    </section>
   </div>
   <p className="nxwa-foot">Este conector não é endossado pelo WhatsApp. <a href="https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App" target="_blank" rel="noopener noreferrer">Consulte os termos oficiais <ExternalLink size={13}/></a></p>
 </div>;
}
