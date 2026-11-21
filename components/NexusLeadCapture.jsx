'use client';
import {useCallback,useEffect,useState} from 'react';
import {Copy,KeyRound} from 'lucide-react';
import {db} from '../lib/supabase';

const when=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}):'';
const EXAMPLE=`{
  "name": "Ana Souza",
  "whatsapp": "(48) 99999-1111",
  "email": "ana@exemplo.com",
  "source": "Landing page exame de vista",
  "utm_source": "instagram",
  "utm_campaign": "exame-gratis",
  "ad_name": "Vídeo 01",
  "answers": { "urgencia": "esta semana", "orcamento": "até R$ 800" },
  "message": "Quero marcar o exame"
}`;

// V42: Configurações → Captura de leads. Só o administrador da empresa vê (a API confere de novo).
export default function NexusLeadCapture({organizationId}){
  const [state,setState]=useState({status:'loading',info:null});
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(''),[newToken,setNewToken]=useState('');
  const call=useCallback(async(method,body)=>{
    const {data:{session}}=await db.auth.getSession();
    if(!session?.access_token)throw Object.assign(new Error('Sua sessão expirou. Entre novamente.'),{status:401});
    const res=await fetch('/api/lead-capture'+(method==='GET'?'?org_id='+encodeURIComponent(organizationId):''),{
      method,headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify({org_id:organizationId,...body})}:{})});
    const json=await res.json().catch(()=>null);
    if(!res.ok)throw Object.assign(new Error(json?.error||'Falha de comunicação com o servidor.'),{status:res.status,code:json?.code});
    return json;
  },[organizationId]);
  const load=useCallback(async()=>{
    if(!organizationId)return;
    try{const r=await call('GET');setState({status:'ready',info:r});setError('')}
    catch(e){setState({status:e.code==='not_installed'?'not_installed':e.status===403?'denied':'error',info:null});setError(e.message)}
  },[call,organizationId]);
  useEffect(()=>{load()},[load]);
  if(state.status==='denied')return null;
  const info=state.info,endpoint=typeof window!=='undefined'?window.location.origin+'/api/leads/capture':'/api/leads/capture';
  async function tokenAction(action){
    if(busy)return;
    if(action==='rotate_token'&&info?.active&&!window.confirm('Gerar uma chave nova desliga a atual. Os formulários só voltam a mandar leads depois que você trocar a chave neles. Continuar?'))return;
    if(action==='revoke_token'&&!window.confirm('Desligar a captura? Leads novos serão recusados até gerar outra chave.'))return;
    setBusy(action);setError('');setNotice('');
    try{const r=await call('POST',{action});setNewToken(r.token||'');setNotice(r.message);await load()}
    catch(e){setError(e.message)}finally{setBusy('')}
  }
  async function copy(text,msg){
    try{await navigator.clipboard.writeText(text);setNotice(msg)}catch{setError('Não deu para copiar automaticamente. Selecione o texto e copie.')}
  }
  return <section className="fx-box fx-prosp-conn" aria-labelledby="fx-capture-title">
    <div className="fx-boxhead"><h2 id="fx-capture-title"><KeyRound size={16}/> Captura de leads (formulário e landing page)</h2>
      {state.status==='ready'&&<span className={'fx-prosp-dot'+(info?.active?' is-on':'')}>{info?.active?'Ligada':'Desligada'}</span>}</div>
    <div className="fx-prosp-conn-body">
      {state.status==='loading'&&<p className="fx-muted" role="status">Carregando…</p>}
      {state.status==='not_installed'&&<p className="fx-muted">A captura de leads ainda não foi ativada no banco desta instalação.</p>}
      {state.status==='error'&&<p className="fx-muted" role="alert">{error} <button type="button" className="nx13-linkbutton" onClick={load}>Tentar novamente</button></p>}
      {state.status==='ready'&&<>
        <p className="fx-muted">{info?.active
          ?<>Chave terminada em <code>…{info.hint}</code>. {info.last_used_at?'Último lead recebido: '+when(info.last_used_at)+'.':'Nenhum lead recebido ainda.'}</>
          :'Gere uma chave e coloque no n8n ou na função do seu site. Cada lead entra na primeira etapa do funil padrão, já como quente, morno ou frio.'}</p>
        <div className="fx-prosp-conn-actions">
          <button type="button" className="fx-btn fx-btn--primary" disabled={!!busy} onClick={()=>tokenAction('rotate_token')}>{busy==='rotate_token'?'Gerando…':info?.active?'Gerar chave nova':'Gerar chave'}</button>
          {info?.active&&<button type="button" className="nx13-linkbutton" disabled={!!busy} onClick={()=>tokenAction('revoke_token')}>Desligar captura</button>}
        </div>
        {newToken&&<div className="fx-prosp-token" role="group" aria-label="Chave nova">
          <code>{newToken}</code>
          <button type="button" className="fx-btn" onClick={()=>copy(newToken,'Chave copiada. Cole no n8n ou na função do site.')}><Copy size={15}/> Copiar</button>
          <small>Aparece só agora. Não coloque no código da página (HTML/JavaScript do navegador): use no n8n ou numa função do servidor.</small>
        </div>}
        <details className="fx-capture-howto" style={{marginTop:12,fontSize:13,lineHeight:1.55}}>
          <summary>Como ligar o formulário</summary>
          <p>Envie <code>POST</code> para <code>{endpoint}</code> com o cabeçalho <code>Authorization: Bearer &lt;chave&gt;</code> e o corpo em JSON:</p>
          <pre style={{whiteSpace:'pre-wrap',wordBreak:'break-word',fontSize:12,background:'var(--fx-subtle)',border:'1px solid var(--fx-border)',borderRadius:8,padding:10,margin:'8px 0'}}>{EXAMPLE}</pre>
          <button type="button" className="fx-btn" onClick={()=>copy(EXAMPLE,'Exemplo copiado.')}><Copy size={15}/> Copiar exemplo</button>
          <p>Classificação: WhatsApp +25, e-mail +10, Instagram +10, comentou a palavra-chave +15, urgência "hoje/esta semana" +40 ou "este mês" +20, orçamento +15, mensagem +10. Quente a partir de 65, morno de 35 a 64, frio abaixo de 35. Se o formulário mandar <code>"temperature": "quente"</code>, vale o que veio. O porquê fica anotado no histórico do lead.</p>
          <p>Aceita também só o @ do Instagram (<code>"instagram": "@perfil"</code>, <code>"keyword": "EXAME"</code>) para o "comenta a palavra" do ManyChat. Contato que já existe é reaproveitado; se ele já tem atendimento aberto, a nova entrada vira uma nota e o lead só esquenta (nunca esfria sozinho).</p>
        </details>
        {notice&&<p role="status" className="fx-muted">{notice}</p>}
        {error&&<p role="alert" className="nx13-error">{error}</p>}
      </>}
    </div>
  </section>;
}
