'use client';
import {useCallback,useEffect,useState} from 'react';
import {ArrowUpRight,Copy,KeyRound,Mail,MessageCircle,RefreshCw,ShieldCheck} from 'lucide-react';
import {db} from '../lib/supabase';

// Avisos da prospecção automática (e-mail do Harvey e agente de WhatsApp).
// Só Admin da empresa e Super Admin. As regras valem no servidor (app/api/prospecting-alerts).
const STATUS_FILTERS=[['open','Em aberto'],['novo','Novos'],['em_atendimento','Em atendimento'],['resolvido','Resolvidos'],['all','Todos']];
const CHANNEL_FILTERS=[['all','Todos os canais'],['email','E-mail'],['whatsapp','WhatsApp']];
const STATUS_OPTIONS=[['novo','Novo'],['em_atendimento','Em atendimento'],['resolvido','Resolvido'],['descartado','Descartado']];
const when=v=>v&&!isNaN(Date.parse(v))?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'—';
const num=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
const brl=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(n)||0);
const pct=(a,b)=>b>0?Math.round(a*100/b)+'%':'';
const phoneLabel=p=>{const d=String(p||'');return d.startsWith('55')&&d.length>=12?'('+d.slice(2,4)+') '+d.slice(4,-4)+'-'+d.slice(-4):d};

export default function NexusProspecting({organizationId,canSee}){
  const [state,setState]=useState({status:'loading',alerts:[],connection:null,totals:null});
  const [statusFilter,setStatusFilter]=useState('open');const [channel,setChannel]=useState('all');
  const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState('');
  const [newToken,setNewToken]=useState('');

  const call=useCallback(async(method,body,query='')=>{
    const {data:{session}}=await db.auth.getSession();
    if(!session?.access_token)throw Object.assign(new Error('Sua sessão expirou. Entre novamente.'),{status:401});
    const res=await fetch('/api/prospecting-alerts'+(method==='GET'?'?org_id='+encodeURIComponent(organizationId)+query:''),{
      method,headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify({org_id:organizationId,...body})}:{})});
    const json=await res.json().catch(()=>null);
    if(!res.ok)throw Object.assign(new Error(json?.error||'Falha de comunicação com o servidor.'),{status:res.status,code:json?.code});
    return json;
  },[organizationId]);

  const load=useCallback(async()=>{
    if(!organizationId||!canSee)return;
    setState(s=>({...s,status:s.status==='ready'?'refreshing':'loading'}));
    try{
      const r=await call('GET',null,'&status='+statusFilter+'&channel='+channel);
      setState({status:'ready',alerts:r.alerts||[],connection:r.connection||null,totals:r.totals||null});setError('');
    }catch(e){setState(s=>({...s,status:e.code==='not_installed'?'not_installed':e.status===403?'denied':'error'}));setError(e.message)}
  },[call,organizationId,canSee,statusFilter,channel]);
  useEffect(()=>{load()},[load]);

  async function setStatus(alert,status){
    if(busy)return;setBusy(alert.id);setError('');setNotice('');
    try{const r=await call('POST',{action:'status',alert_id:alert.id,status});setNotice(r.message);await load()}
    catch(e){setError(e.message)}finally{setBusy('')}
  }
  async function tokenAction(action){
    if(busy)return;
    if(action==='rotate_token'&&state.connection?.active&&!window.confirm('Gerar um token novo desliga o atual. O vigia só volta a enviar depois que você trocar o token nele. Continuar?'))return;
    if(action==='revoke_token'&&!window.confirm('Desligar o vigia? Avisos novos serão recusados até gerar outro token.'))return;
    setBusy(action);setError('');setNotice('');
    try{const r=await call('POST',{action});setNewToken(r.token||'');setNotice(r.message);await load()}
    catch(e){setError(e.message)}finally{setBusy('')}
  }
  async function copyToken(){
    try{await navigator.clipboard.writeText(newToken);setNotice('Token copiado. Cole no arquivo de configuração do vigia.')}
    catch{setError('Não deu para copiar automaticamente. Selecione o texto e copie.')}
  }

  if(!canSee||state.status==='denied')return <div className="fx-page fx-prosp"><div className="fx-empty fx-prosp-denied" role="alert">
    <ShieldCheck size={28}/><strong>Acesso restrito</strong><p>As notificações da prospecção aparecem só para o administrador da empresa.</p></div></div>;

  const conn=state.connection;
  return <div className="fx-page fx-prosp">
    <header className="fx-pagehead">
      <div className="fx-pagehead-title"><h1>Prospecção</h1>{state.status==='ready'&&<span className="fx-count">{state.alerts.length} {state.alerts.length===1?'aviso':'avisos'}</span>}</div>
      <div className="fx-actions"><button type="button" className="fx-btn" onClick={load} disabled={state.status==='loading'||state.status==='refreshing'}><RefreshCw size={15}/> Atualizar</button></div>
    </header>
    <p className="fx-muted fx-prosp-intro">Quem respondeu o e-mail do Harvey com interesse, pergunta ou objeção, e as vendas e leads quentes avisados pelo agente de WhatsApp.</p>
    {error&&state.status!=='not_installed'&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    {notice&&<div className="fx-alert fx-alert--ok" role="status">{notice}</div>}

    {state.status==='not_installed'&&<div className="fx-empty" role="status"><strong>Ainda não ativado</strong><p>As notificações da prospecção dependem de uma atualização do banco que ainda não foi aplicada nesta instalação.</p></div>}

    {state.totals?.available&&<section className="fx-box fx-prosp-board" aria-labelledby="fx-prosp-board-title">
      <div className="fx-boxhead"><h2 id="fx-prosp-board-title">Números da prospecção</h2>
        <span className="fx-muted fx-prosp-board-when">{state.totals.lines.some(l=>l.measured_at)?'Atualizado '+when(state.totals.lines.map(l=>l.measured_at).filter(Boolean).sort().pop()):'Aguardando o primeiro envio do vigia'}</span></div>
      <div className="fx-prosp-board-wrap"><table className="fx-prosp-board-table">
        <thead><tr><th scope="col">Origem</th><th scope="col">Contatados</th><th scope="col">Responderam</th><th scope="col">Interessados</th><th scope="col">Vendas</th><th scope="col">Vendido</th></tr></thead>
        <tbody>{[...state.totals.lines,state.totals.total].map(l=><tr key={l.channel} className={l.channel==='total'?'is-total':''}>
          <th scope="row">{l.label}</th>
          <td data-label="Contatados">{num(l.sent)}</td>
          <td data-label="Responderam">{num(l.replied)}{pct(l.replied,l.sent)&&<small>{pct(l.replied,l.sent)}</small>}</td>
          <td data-label="Interessados">{num(l.interested)}</td>
          <td data-label="Vendas">{num(l.sales)}</td>
          <td data-label="Vendido">{brl(l.revenue)}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="fx-muted fx-prosp-board-note">Venda que começou no e-mail e fechou no WhatsApp conta para o e-mail. Valores informados pelo agente na hora do fechamento.</p>
    </section>}

    {state.status!=='not_installed'&&<section className="fx-box fx-prosp-conn" aria-labelledby="fx-prosp-conn-title">
      <div className="fx-boxhead"><h2 id="fx-prosp-conn-title"><KeyRound size={16}/> Ligação com o vigia</h2>
        <span className={'fx-prosp-dot'+(conn?.active?' is-on':'')}>{conn?.active?'Ligado':'Desligado'}</span></div>
      <div className="fx-prosp-conn-body">
        <p className="fx-muted">{conn?.active
          ?<>Token terminado em <code>…{conn.hint}</code>. {conn.last_used_at?'Último envio: '+when(conn.last_used_at)+'.':'O vigia ainda não enviou nenhum aviso.'}</>
          :'Gere um token e coloque no vigia do computador para os avisos chegarem aqui.'}</p>
        <div className="fx-prosp-conn-actions">
          <button type="button" className="fx-btn fx-btn--primary" disabled={!!busy} onClick={()=>tokenAction('rotate_token')}>{busy==='rotate_token'?'Gerando...':conn?.active?'Gerar token novo':'Gerar token'}</button>
          {conn?.active&&<button type="button" className="nx13-linkbutton" disabled={!!busy} onClick={()=>tokenAction('revoke_token')}>Desligar vigia</button>}
        </div>
        {newToken&&<div className="fx-prosp-token" role="group" aria-label="Token novo">
          <code>{newToken}</code>
          <button type="button" className="fx-btn" onClick={copyToken}><Copy size={15}/> Copiar</button>
          <small>Aparece só agora. Não mande por WhatsApp nem e-mail.</small>
        </div>}
      </div>
    </section>}

    {state.status!=='not_installed'&&<section className="fx-box" aria-label="Avisos da prospecção">
      <div className="fx-boxhead fx-prosp-filters">
        <div className="fx-tabs" role="group" aria-label="Filtrar por situação">{STATUS_FILTERS.map(([id,label])=><button type="button" key={id} aria-pressed={statusFilter===id} className={statusFilter===id?'active':''} onClick={()=>setStatusFilter(id)}>{label}</button>)}</div>
        <select aria-label="Filtrar por canal" value={channel} onChange={e=>setChannel(e.target.value)}>{CHANNEL_FILTERS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
      </div>
      {state.status==='loading'&&<p className="fx-muted fx-prosp-wait" role="status">Carregando os avisos...</p>}
      {state.status==='error'&&<div className="fx-empty"><strong>Não foi possível carregar</strong><p>{error}</p><button type="button" className="fx-btn" onClick={load}>Tentar novamente</button></div>}
      {['ready','refreshing'].includes(state.status)&&!state.alerts.length&&<div className="fx-empty"><strong>{statusFilter==='open'?'Nenhum aviso em aberto':'Nenhum aviso neste filtro'}</strong>
        <p>{conn?.active?'Quando alguém responder o e-mail ou o agente avisar uma venda, aparece aqui.':'Os avisos só chegam depois de ligar o vigia acima.'}</p></div>}
      {['ready','refreshing'].includes(state.status)&&state.alerts.length>0&&<ul className="fx-prosp-list">
        {state.alerts.map(a=><li key={a.id} className={'fx-prosp-item fx-prosp-item--'+a.status}>
          <div className="fx-prosp-head">
            <span className={'fx-prosp-channel fx-prosp-channel--'+a.channel}>{a.channel==='email'?<Mail size={14}/>:<MessageCircle size={14}/>}{a.channel==='email'?'E-mail':'WhatsApp'}</span>
            <span className={'fx-prosp-kind fx-prosp-kind--'+a.kind}>{a.kind_label}</span>
            <time className="fx-muted" dateTime={a.occurred_at}>{when(a.occurred_at)}</time>
          </div>
          <div className="fx-prosp-who">
            <strong>{a.company_name||a.contact_name||a.contact_email||phoneLabel(a.contact_phone)}</strong>
            <small>{[a.company_name&&a.contact_name,a.contact_email,a.contact_phone&&phoneLabel(a.contact_phone)].filter(Boolean).join(' · ')}</small>
          </div>
          {a.message&&<blockquote className="fx-prosp-msg">{a.message}</blockquote>}
          <div className="fx-prosp-foot">
            <label className="fx-prosp-status">Situação<select value={a.status} disabled={busy===a.id} onChange={e=>setStatus(a,e.target.value)} aria-label={'Situação do aviso de '+(a.company_name||a.contact_name||'contato')}>
              {STATUS_OPTIONS.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
            <span className="fx-prosp-links">
              {a.whatsapp_url?<a className="fx-btn fx-btn--primary" href={a.whatsapp_url} target="_blank" rel="noopener noreferrer"><MessageCircle size={15}/> Abrir no WhatsApp <ArrowUpRight size={14}/></a>:<span className="fx-muted">Sem telefone</span>}
              {a.mail_url&&<a className="fx-btn" href={a.mail_url}><Mail size={15}/> E-mail</a>}
            </span>
          </div>
        </li>)}
      </ul>}
    </section>}
  </div>;
}
