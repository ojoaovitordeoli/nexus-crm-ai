'use client';
import {useCallback,useEffect,useState} from 'react';
import {Bot,MessageSquareText,Plus,Send,Trash2,LockKeyhole,RefreshCw} from 'lucide-react';
import {db} from '../lib/supabase';

export default function NexusPersonalChat({organizationId}){
 const [threads,setThreads]=useState([]),[active,setActive]=useState(null);
 const [messages,setMessages]=useState([]),[draft,setDraft]=useState('');
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[configured,setConfigured]=useState(false);
 const [error,setError]=useState(''),[consent,setConsent]=useState(false);
 const api=useCallback(async(method='GET',args={},threadId='')=>{
   const {data:{session}}=await db.auth.getSession();
   if(!session?.access_token)throw new Error('Entre novamente para acessar o copiloto.');
   const query=new URLSearchParams({org_id:organizationId,...(threadId?{thread_id:threadId}:{})});
   const response=await fetch('/api/personal-ai'+(method==='GET'?'?'+query:''),{
    method,headers:{Authorization:'Bearer '+session.access_token,...(method!=='GET'?{'Content-Type':'application/json'}:{})},
    ...(method!=='GET'?{body:JSON.stringify({org_id:organizationId,...args})}:{}),cache:'no-store'
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||'Não foi possível carregar o chat.');
   return result;
 },[organizationId]);
 const refresh=useCallback(async()=>{setLoading(true);try{
   const data=await api();setThreads(data.threads||[]);setConfigured(Boolean(data.configured));setError('');
 }catch(e){setError(e.message)}finally{setLoading(false)}},[api]);
 useEffect(()=>{setActive(null);setMessages([]);setDraft('');setConsent(false);refresh()},[refresh]);
 async function openThread(thread){setActive(thread);setMessages([]);setError('');try{
   const data=await api('GET',{},thread.id);setMessages(data.messages||[]);
 }catch(e){setError(e.message)}}
 async function send(e){e.preventDefault();const question=draft.trim();
   if(busy||!consent||question.length<2||!configured)return;
   setBusy(true);setError('');
   try{
     const data=await api('POST',{question,consent:true,...(active?{thread_id:active.id}:{})});
     setDraft('');await refresh();
     const t=data.thread;setActive(t);
     const history=await api('GET',{},t.id);setMessages(history.messages||[]);
   }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function erase(){if(!active||busy)return;
   if(!window.confirm('Excluir definitivamente esta conversa do seu histórico?'))return;
   setBusy(true);setError('');
   try{await api('DELETE',{thread_id:active.id});setActive(null);setMessages([]);await refresh()}
   catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div className="nxc-page">
  <header className="nxc-header"><div><span className="nxc-eyebrow"><Bot size={16}/> NEXUS / IA INDIVIDUAL</span><h1>Seu copiloto de trabalho.</h1><p>Histórico separado por usuário e empresa. Nenhum outro colaborador vê suas conversas.</p></div><span className={'nxc-status '+(configured?'ok':'')}>{configured?'IA configurada':'Configuração pendente'}</span></header>
  {!configured&&!loading&&<div className="nxc-note"><LockKeyhole size={18}/> Configure OPENAI_API_KEY e OPENAI_MODEL no servidor e aplique a migração SQL de IA individual.</div>}
  {error&&<div role="alert" className="nxc-error">{error}</div>}
  <div className="nxc-layout">
   <aside className="nxc-history"><div className="nxc-history-top"><strong>Minhas conversas</strong><button type="button" onClick={()=>{setActive(null);setMessages([]);setDraft('')}}><Plus size={17}/> Nova</button></div>
    {threads.map(t=><button key={t.id} type="button" className={'nxc-history-item '+(active?.id===t.id?'selected':'')} onClick={()=>openThread(t)}><MessageSquareText size={17}/><span>{t.title}</span></button>)}
    {!threads.length&&<p className="nxc-empty-side">Nenhum histórico ainda.</p>}
    <button type="button" onClick={refresh} className="nxc-refresh" disabled={loading}><RefreshCw size={15}/> {loading?'Consultando...':'Atualizar'}</button>
   </aside>
   <section className="nxc-chat">
    <div className="nxc-chat-top"><div><span>CONVERSA PRIVADA</span><strong>{active?.title||'Nova conversa'}</strong></div>{active&&<button type="button" onClick={erase} disabled={busy} title="Excluir meu histórico"><Trash2 size={17}/> Excluir</button>}</div>
    <div className="nxc-messages">
      {!messages.length&&<div className="nxc-welcome"><Bot size={29}/><h2>Como posso ajudar na sua operação?</h2><p>Você pode pedir ajuda para organizar atendimentos, planejar follow-ups e analisar indicadores agregados permitidos da empresa.</p></div>}
      {messages.map(m=><div key={m.id} className={'nxc-message '+(m.role==='user'?'mine':'assistant')}><small>{m.role==='user'?'Você':'Copiloto Nexus'}</small><p>{m.content}</p></div>)}
      {busy&&<div className="nxc-typing">Consultando a IA...</div>}
    </div>
    <form onSubmit={send} className="nxc-compose"><textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={3} maxLength={3000} placeholder="Pergunte algo sobre seu trabalho..." aria-label="Sua mensagem para a IA"/>
     <div className="nxc-compose-bottom"><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/> Autorizo enviar minha pergunta, o histórico e até 20 tarefas atribuídas ou criadas por mim ao provedor de IA.</label><button disabled={!configured||busy||!consent||draft.trim().length<2} type="submit"><Send size={16}/> {busy?'Enviando':'Enviar'}</button></div>
     <small>Não inclua senhas ou informações sensíveis. A IA não envia mensagens a clientes nem muda dados do CRM.</small>
    </form>
   </section>
  </div>
 </div>;
}
