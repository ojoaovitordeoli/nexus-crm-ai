'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,LayoutGrid,Maximize2,MessageSquare,Minimize2,Pin,Send,Sparkles,X} from 'lucide-react';
import {db} from '../lib/supabase';
import NexusViewCanvas from './NexusViewCanvas';

// Assistente NEXUS: conversa sobre a operação da empresa.
// Ações chegam como propostas; só são executadas quando a pessoa clica em Confirmar,
// pela mesma API de operação (mesmas permissões e regras de etapa).
// V51 "Sob Medida": o assistente também MONTA TELAS (lista, quadro, gráfico, número) e a pessoa salva em "Minhas telas".
const SUGGESTIONS=['Monta um quadro dos meus leads por etapa','Gráfico das vendas por vendedor nos últimos 30 dias','Quero guardar o convênio de cada cliente','Quais leads estão parados há 3 dias?','O que eu tenho pra hoje?'];
const plain=t=>String(t||'').replace(/\*\*(.+?)\*\*/g,'$1').replace(/^#+\s*/gm,'');

async function authHeaders(){
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
  return {'Content-Type':'application/json',Authorization:'Bearer '+session.access_token};
}

export default function NexusAssistant({organizationId,organizationName,readonly=false,canConfigure=false,onOperation,onChanged}){
  const [open,setOpen]=useState(false),[mounted,setMounted]=useState(false);
  const [status,setStatus]=useState({checked:false,configured:false});
  const [messages,setMessages]=useState([]);
  const [text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [aba,setAba]=useState('conversa'),[largo,setLargo]=useState(false);
  const [minhas,setMinhas]=useState({carregado:false,lista:[],aviso:'',erro:''});
  const [vocab,setVocab]=useState(null); // V53: palavras do ramo da empresa
  const [aberta,setAberta]=useState(null); // {id,nome,tela,estado,erro}
  const listRef=useRef(null),inputRef=useRef(null);
  useEffect(()=>setMounted(true),[]);
  // Conversa e telas são por empresa: trocar de empresa começa do zero.
  useEffect(()=>{setMessages([]);setError('');setMinhas({carregado:false,lista:[],aviso:'',erro:''});setAberta(null);setVocab(null)},[organizationId]);
  useEffect(()=>{
    if(!open||status.checked)return;
    fetch('/api/assistant').then(r=>r.json()).then(j=>setStatus({checked:true,configured:Boolean(j?.configured)})).catch(()=>setStatus({checked:true,configured:false}));
  },[open,status.checked]);
  useEffect(()=>{if(open&&aba==='conversa')setTimeout(()=>inputRef.current?.focus(),60)},[open,aba]);
  useEffect(()=>{listRef.current?.scrollTo({top:listRef.current.scrollHeight,behavior:'smooth'})},[messages,busy]);
  useEffect(()=>{
    if(!open)return;
    const onKey=e=>{if(e.key==='Escape')setOpen(false)};
    window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
  },[open]);

  const ask=useCallback(async question=>{
    const q=String(question||'').trim();if(!q||busy||!organizationId)return;
    const next=[...messages,{role:'user',content:q}];
    setMessages(next);setText('');setBusy(true);setError('');setAba('conversa');
    try{
      const headers=await authHeaders();
      const history=next.filter(m=>m.role==='user'||m.role==='assistant').map(m=>({role:m.role,content:m.content}));
      const res=await fetch('/api/assistant',{method:'POST',headers,body:JSON.stringify({org_id:organizationId,messages:history})});
      const json=await res.json().catch(()=>null);
      if(!res.ok){if(json?.configured===false)setStatus({checked:true,configured:false});throw new Error(json?.error||'O assistente não respondeu.')}
      const telas=(json.telas||[]).map(t=>({...t,estado:'',erro:''}));
      if(telas.some(t=>t.spec?.tipo==='quadro'||t.spec?.tipo==='lista'))setLargo(true);
      setMessages(m=>[...m,{role:'assistant',content:plain(json.text),proposals:(json.proposals||[]).map(p=>({...p,state:'pending'})),telas}]);
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  },[busy,messages,organizationId]);

  async function decide(msgIndex,proposal,confirm){
    const set=(state,note='')=>setMessages(m=>m.map((x,i)=>i!==msgIndex?x:{...x,proposals:x.proposals.map(p=>p.id===proposal.id?{...p,state,note}:p)}));
    if(!confirm){set('cancelled');return}
    set('running');
    try{
      let r;
      if(proposal.payload?.action==='field_save'){
        // V52: campo extra é configuração — vai para /api/crm-settings, que só aceita gerente/admin.
        const res=await fetch('/api/crm-settings',{method:'POST',headers:await authHeaders(),body:JSON.stringify({org_id:organizationId,action:'field_save',field:proposal.payload.field})});
        const json=await res.json().catch(()=>null);
        if(!res.ok)throw new Error(json?.error||'Não consegui criar o campo.');
        r={message:(json?.message||'Campo criado.')+' Já aparece em "Campos extras" na ficha do lead.'};
      }else if(proposal.payload?.action==='segment_save'){
        // V53: ramo da empresa — /api/crm-settings (só gerente/admin).
        const res=await fetch('/api/crm-settings',{method:'POST',headers:await authHeaders(),body:JSON.stringify({org_id:organizationId,action:'segment_save',ramo:proposal.payload.ramo})});
        const json=await res.json().catch(()=>null);
        if(!res.ok)throw new Error(json?.error||'Não consegui salvar o ramo.');
        r={message:json?.message||'Ramo salvo.'};setMinhas(m=>({...m,carregado:false}));
      }else if(proposal.payload?.action==='automation_create'||proposal.payload?.action==='automation_toggle'){
        // V54: automações — /api/automations (só gerente/admin). Criar já liga a regra: o "Confirmar" é a aprovação.
        const post=async body=>{const res=await fetch('/api/automations',{method:'POST',headers:await authHeaders(),body:JSON.stringify({org_id:organizationId,...body})});const json=await res.json().catch(()=>null);if(!res.ok)throw new Error(json?.error||'Não consegui salvar a automação.');return json};
        if(proposal.payload.action==='automation_create'){
          const created=await post({action:'create',...proposal.payload.rule});
          await post({action:'toggle',rule_id:created.rule.id,enabled:true});
          r={message:'Automação criada e ligada. Ela cria a tarefa sozinha a partir de agora.'};
        }else{await post({action:'toggle',rule_id:proposal.payload.rule_id,enabled:proposal.payload.enabled});r={message:'Automação pausada.'}}
      }else r=await onOperation(proposal.payload);
      set('done',r?.message||'Feito.');onChanged?.();
    }
    catch(e){
      const needsFields=Array.isArray(e.missing)&&e.missing.length;
      set('failed',needsFields?'Essa etapa pede campos obrigatórios. Abra o lead em Leads para preencher e mover.':(e.message||'Não foi possível concluir.'));
    }
  }

  async function salvarTela(msgIndex,tela){
    const set=patch=>setMessages(m=>m.map((x,i)=>i!==msgIndex?x:{...x,telas:x.telas.map(t=>t.id===tela.id?{...t,...patch}:t)}));
    set({estado:'salvando',erro:''});
    try{
      const res=await fetch('/api/views',{method:'POST',headers:await authHeaders(),body:JSON.stringify({org_id:organizationId,acao:'salvar',nome:tela.titulo,spec:tela.spec})});
      const json=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(json?.error||'Não consegui salvar.');
      set({estado:'salvo'});setMinhas(s=>({...s,carregado:false}));
    }catch(e){set({estado:'',erro:e.message})}
  }

  const carregarMinhas=useCallback(async()=>{
    try{
      const res=await fetch('/api/views?org_id='+encodeURIComponent(organizationId),{headers:await authHeaders()});
      const json=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(json?.error||'Não consegui carregar suas telas.');
      setMinhas({carregado:true,lista:json.telas||[],aviso:json.indisponivel?json.aviso:'',erro:''});
      if(json?.vocab)setVocab(json.vocab);
    }catch(e){setMinhas({carregado:true,lista:[],aviso:'',erro:e.message})}
  },[organizationId]);
  // Carrega ao abrir o painel: traz as telas salvas e as palavras do ramo (sugestões no tom do negócio).
  useEffect(()=>{if(open&&!minhas.carregado)carregarMinhas()},[open,minhas.carregado,carregarMinhas]);
  async function fixar(item){
    const quer=!item.inicio;
    setMinhas(s=>({...s,erro:'',lista:s.lista.map(t=>t.id===item.id?{...t,inicio:quer}:t)}));
    try{
      const res=await fetch('/api/views',{method:'POST',headers:await authHeaders(),body:JSON.stringify({org_id:organizationId,acao:'fixar',id:item.id,inicio:quer})});
      const json=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(json?.error||'Não consegui fixar.');
    }catch(e){setMinhas(s=>({...s,erro:e.message,lista:s.lista.map(t=>t.id===item.id?{...t,inicio:!quer}:t)}))}
  }

  async function abrirSalva(item){
    setAberta({...item,tela:null,estado:'carregando',erro:''});setLargo(true);
    try{
      const res=await fetch('/api/views',{method:'POST',headers:await authHeaders(),body:JSON.stringify({org_id:organizationId,acao:'abrir',spec:item.spec})});
      const json=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(json?.error||'Não consegui abrir a tela.');
      setAberta({...item,tela:{...json.tela,titulo:item.nome},estado:'',erro:''});
    }catch(e){setAberta(a=>({...a,estado:'',erro:e.message}))}
  }
  async function apagarSalva(item){
    // Confirmação em dois toques no próprio botão (ConfirmButton). Apaga só a tela; os dados continuam.
    try{
      const res=await fetch('/api/views?org_id='+encodeURIComponent(organizationId)+'&id='+encodeURIComponent(item.id),{method:'DELETE',headers:await authHeaders()});
      const json=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(json?.error||'Não consegui apagar.');
      setAberta(null);setMinhas(s=>({...s,lista:s.lista.filter(t=>t.id!==item.id)}));
    }catch(e){setAberta(a=>a&&({...a,erro:e.message}))}
  }

  const conversa=<>
    {!messages.length&&<div className="nx-ai-welcome">
      <p>Peça o que quiser ver de <strong>{organizationName}</strong> e eu monto a tela: lista, quadro, gráfico ou número. {readonly?'Seu perfil é somente leitura: posso montar telas e consultar, mas não alterar.':'Toda ação aparece para você confirmar antes de ser salva.'}</p>
      <div className="nx-ai-chips">{(vocab?.sugestoes?.length?[...vocab.sugestoes,'O que eu tenho pra hoje?'].filter((x,i,a)=>a.indexOf(x)===i).slice(0,5):SUGGESTIONS).map(s=><button type="button" key={s} onClick={()=>ask(s)} disabled={busy||!status.checked}>{s}</button>)}</div>
    </div>}
    {messages.map((m,i)=><div key={i} className={'nx-ai-msg nx-ai-msg--'+m.role}>
      <p>{m.content}</p>
      {m.telas?.map(t=><NexusViewCanvas key={t.id} tela={t} estado={t.estado} erro={t.erro} onSalvar={()=>salvarTela(i,t)}/>)}
      {m.proposals?.map(p=><div key={p.id} className={'nx-ai-card is-'+p.state}>
        <span>{p.summary}</span>
        {p.state==='pending'&&<div className="nx-ai-card-actions"><button type="button" className="fx-btn fx-btn--primary" onClick={()=>decide(i,p,true)}><Check size={14}/> Confirmar</button><button type="button" className="fx-btn" onClick={()=>decide(i,p,false)}>Cancelar</button></div>}
        {p.state==='running'&&<small>Salvando…</small>}
        {p.state==='done'&&<small className="is-ok">✓ {p.note}</small>}
        {p.state==='cancelled'&&<small>Cancelado.</small>}
        {p.state==='failed'&&<small className="is-error">{p.note}</small>}
      </div>)}
    </div>)}
    {busy&&<div className="nx-ai-msg nx-ai-msg--assistant"><p className="nx-ai-typing">Montando…</p></div>}
    {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
  </>;

  const telas=<div className="nx-ai-telas">
    {aberta?<>
      <button type="button" className="fx-btn nx-ai-voltar" onClick={()=>setAberta(null)}>← Minhas telas</button>
      {aberta.tela?<NexusViewCanvas tela={aberta.tela} estado={aberta.estado} erro={aberta.erro} onAtualizar={()=>abrirSalva(aberta)} onApagar={()=>apagarSalva(aberta)}/>
        :<p className="nx-view-empty" role="status">{aberta.erro||'Abrindo…'}</p>}
    </>:<>
      {!minhas.carregado&&<p className="nx-view-empty">Carregando…</p>}
      {minhas.erro&&<div className="fx-alert fx-alert--error" role="alert">{minhas.erro}</div>}
      {minhas.aviso&&<p className="nx-view-warn" role="status">{minhas.aviso}</p>}
      {minhas.carregado&&!minhas.lista.length&&!minhas.aviso&&!minhas.erro&&<div className="nx-ai-welcome"><p>Você ainda não salvou nenhuma tela. Peça uma na conversa ("monta um quadro dos meus leads por etapa") e clique em <strong>Salvar nas minhas telas</strong>.</p></div>}
      {minhas.lista.length>0&&<p className="nx-ai-telas-dica">Fixe até 4 telas para elas aparecerem na sua Visão geral.</p>}
      <ul className="nx-ai-telas-lista">{minhas.lista.map(t=><li key={t.id}><button type="button" onClick={()=>abrirSalva(t)}><LayoutGrid size={15}/><span>{t.nome}</span><small>{t.spec?.tipo}</small></button>
        <button type="button" className="nx-ai-pin" aria-pressed={t.inicio===true} onClick={()=>fixar(t)} title={t.inicio?'Tirar da tela inicial':'Mostrar na tela inicial'}><Pin size={13}/>{t.inicio?'Na inicial':'Fixar'}</button></li>)}</ul>
    </>}
  </div>;

  const panel=open&&<div className="nx-ai-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
    <aside className={'nx-ai'+(largo?' is-wide':'')} role="dialog" aria-modal="true" aria-label="Assistente NEXUS">
      <header className="nx-ai-head"><div><strong><Sparkles size={16}/> Assistente</strong><small>{organizationName}</small></div>
        <div className="nx-ai-head-actions">
          <button type="button" className="fx-iconbtn nx-ai-wide-toggle" aria-label={largo?'Diminuir painel':'Ampliar painel'} title={largo?'Diminuir':'Ampliar'} onClick={()=>setLargo(v=>!v)}>{largo?<Minimize2 size={15}/>:<Maximize2 size={15}/>}</button>
          <button type="button" className="fx-iconbtn" aria-label="Fechar assistente" onClick={()=>setOpen(false)}><X size={16}/></button>
        </div></header>
      {(!status.checked||status.configured)&&<nav className="nx-ai-tabs" aria-label="Seções do assistente">
        <button type="button" aria-pressed={aba==='conversa'} onClick={()=>setAba('conversa')}><MessageSquare size={14}/> Conversa</button>
        <button type="button" aria-pressed={aba==='telas'} onClick={()=>setAba('telas')}><LayoutGrid size={14}/> Minhas telas</button>
      </nav>}
      <div className="nx-ai-body" ref={listRef} aria-live="polite">
        {status.checked&&!status.configured?<div className="nx-ai-off">
          <strong>Assistente ainda não ativado</strong>
          {canConfigure?<p>Para ligar, cadastre a chave da IA no servidor (Render › Environment): <code>ANTHROPIC_API_KEY</code>. O guia está em <code>docs/HOSPEDAGEM.md</code>.</p>
            :<p>O administrador da sua empresa ainda não ativou o assistente.</p>}
        </div>:aba==='conversa'?conversa:telas}
      </div>
      {(!status.checked||status.configured)&&aba==='conversa'&&<form className="nx-ai-input" onSubmit={e=>{e.preventDefault();ask(text)}}>
        <textarea ref={inputRef} rows={1} maxLength={2000} placeholder="Peça uma tela ou uma ação…" value={text} onChange={e=>setText(e.target.value)}
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
