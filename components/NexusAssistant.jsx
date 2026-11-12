'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,Send,Sparkles,X} from 'lucide-react';
import {db} from '../lib/supabase';

// Assistente NEXUS: conversa sobre a operação da empresa.
// Ações chegam como propostas; só são executadas quando a pessoa clica em Confirmar,
// pela mesma API de operação (mesmas permissões e regras de etapa).
const SUGGESTIONS=['O que eu tenho pra hoje?','Quais leads estão parados há 3 dias?','Como está o funil?','Quanto vendemos nos últimos 30 dias?','Como importo minha planilha de clientes?'];
const plain=t=>String(t||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/^#+\s*/gm,'');

export default function NexusAssistant({organizationId,organizationName,readonly=false,canConfigure=false,onOperation,onChanged}){
  const [open,setOpen]=useState(false),[mounted,setMounted]=useState(false);
  const [status,setStatus]=useState({checked:false,configured:false});
  const [messages,setMessages]=useState([]);
  const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const listRef=useRef(null),inputRef=useRef(null);
  useEffect(()=>setMounted(true),[]);
  // Conversa é por empresa: trocar de empresa começa do zero.
  useEffect(()=>{setMessages([]);setError('')},[organizationId]);
  useEffect(()=>{
    if(!open||status.checked)return;
    fetch('/api/assistant').then(r=>r.json()).then(j=>setStatus({checked:true,configured:Boolean(j?.configured)})).catch(()=>setStatus({checked:true,configured:false}));
  },[open,status.checked]);
  useEffect(()=>{if(open)setTimeout(()=>inputRef.current?.focus(),60)},[open]);
  useEffect(()=>{listRef.current?.scrollTo({top:listRef.current.scrollHeight,behavior:'smooth'})},[messages,busy]);
  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{if(e.key==='Escape')setOpen(false)};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[open]);

  const ask=useCallback(async question=>{
    const q=String(question||'').trim();if(!q||busy||!organizationId)return;
    const next=[...messages,{role:'user',content:q}];
    setMessages(next);setText('');setBusy(true);setError('');
    try{
      const {data:{session}}=await db.auth.getSession();
      if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
      const history=next.filter(m=>m.role==='user'||m.role==='assistant').map(m=>({role:m.role,content:m.content}));
      const res=await fetch('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({org_id:organizationId,messages:history})});
      const json=await res.json().catch(()=>null);
      if(!res.ok){if(json?.configured===false)setStatus({checked:true,configured:false});throw new Error(json?.error||'O assistente não respondeu.')}
      setMessages(m=>[...m,{role:'assistant',content:plain(json.text),proposals:(json.proposals||[]).map(p=>({...p,state:'pending'}))}]);
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  },[busy,messages,organizationId]);

  async function decide(msgIndex,proposal,confirm){
    const set=(state,note='')=>setMessages(m=>m.map((x,i)=>i!==msgIndex?x:{...x,proposals:x.proposals.map(p=>p.id===proposal.id?{...p,state,note}:p)}));
    if(!confirm){set('cancelled');return}
    set('running');
    try{const r=await onOperation(proposal.payload);set('done',r?.message||'Feito.');onChanged?.()}
    catch(e){
      const needsFields=Array.isArray(e.missing)&&e.missing.length;
      set('failed',needsFields?'Essa etapa pede campos obrigatórios. Abra o lead em Leads para preencher e mover.':(e.message||'Não foi possível concluir.'));
    }
  }

  const panel=open&&<div className="nx-ai-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
    <aside className="nx-ai" role="dialog" aria-modal="true" aria-label="Assistente NEXUS">
      <header className="nx-ai-head"><div><strong><Sparkles size={16}/> Assistente</strong><small>{organizationName}</small></div>
        <button type="button" className="fx-iconbtn" aria-label="Fechar assistente" onClick={()=>setOpen(false)}><X size={16}/></button></header>
      <div className="nx-ai-body" ref={listRef} aria-live="polite">
        {status.checked&&!status.configured?<div className="nx-ai-off">
          <strong>Assistente ainda não ativado</strong>
          {canConfigure?<p>Para ligar, cadastre a chave da IA no servidor (Render › Environment): <code>ANTHROPIC_API_KEY</code>. O guia está em <code>docs/HOSPEDAGEM.md</code>.</p>
            :<p>O administrador da sua empresa ainda não ativou o assistente.</p>}
        </div>:<>
          {!messages.length&&<div className="nx-ai-welcome">
            <p>Pergunte sobre a operação de <strong>{organizationName}</strong> ou peça uma ação. {readonly?'Seu perfil é somente leitura: posso consultar, mas não alterar.':'Toda ação aparece para você confirmar antes de ser salva.'}</p>
            <div className="nx-ai-chips">{SUGGESTIONS.map(s=><button type="button" key={s} onClick={()=>ask(s)} disabled={busy||!status.checked}>{s}</button>)}</div>
          </div>}
          {messages.map((m,i)=><div key={i} className={'nx-ai-msg nx-ai-msg--'+m.role}>
            <p>{m.content}</p>
            {m.proposals?.map(p=><div key={p.id} className={'nx-ai-card is-'+p.state}>
              <span>{p.summary}</span>
              {p.state==='pending'&&<div className="nx-ai-card-actions"><button type="button" className="fx-btn fx-btn--primary" onClick={()=>decide(i,p,true)}><Check size={14}/> Confirmar</button><button type="button" className="fx-btn" onClick={()=>decide(i,p,false)}>Cancelar</button></div>}
              {p.state==='running'&&<small>Salvando...</small>}
              {p.state==='done'&&<small className="is-ok">✓ {p.note}</small>}
              {p.state==='cancelled'&&<small>Cancelado.</small>}
              {p.state==='failed'&&<small className="is-error">{p.note}</small>}
            </div>)}
          </div>)}
          {busy&&<div className="nx-ai-msg nx-ai-msg--assistant"><p className="nx-ai-typing">Pensando...</p></div>}
          {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
        </>}
      </div>
      {(!status.checked||status.configured)&&<form className="nx-ai-input" onSubmit={e=>{e.preventDefault();ask(text)}}>
        <textarea ref={inputRef} rows={1} maxLength={2000} placeholder="Pergunte ou peça algo..." value={text} onChange={e=>setText(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();ask(text)}}} aria-label="Mensagem para o assistente"/>
        <button type="submit" className="fx-btn fx-btn--primary" disabled={busy||!text.trim()} aria-label="Enviar"><Send size={15}/></button>
      </form>}
      <p className="nx-ai-foot">As perguntas são processadas pelo provedor de IA configurado. Confira antes de confirmar.</p>
    </aside>
  </div>;

  return <>
    <button type="button" className="staff-icon-button nx-ai-trigger" onClick={()=>setOpen(true)} aria-label="Abrir assistente" title="Assistente"><Sparkles size={17}/><span>Assistente</span></button>
    {mounted&&panel&&createPortal(panel,document.body)}
  </>;
}
