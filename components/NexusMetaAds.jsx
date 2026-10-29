'use client';
import {useCallback,useEffect,useState} from 'react';
import {ArrowUpRight,BarChart3,CheckCircle2,Eye,Link2,LockKeyhole,RefreshCw,ShieldAlert,Wallet} from 'lucide-react';
import {db} from '../lib/supabase';
const money=(n,c='BRL')=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:c}).format(Number(n)||0);
const count=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
const minor=n=>Number(n)/100;
const status=s=>String(s||'Sem status').replaceAll('_',' ');
export default function NexusMetaAds({organizationId}){
 const [data,setData]=useState({accounts:[],manager:false}),[loading,setLoading]=useState(true);
 const [accountId,setAccountId]=useState(''),[token,setToken]=useState(''),[adding,setAdding]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const request=useCallback(async(method='GET',body=null)=>{
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error('Sessão expirada.');
  const res=await fetch('/api/meta-ads'+(method==='GET'?'?org_id='+encodeURIComponent(organizationId):''),{
   method,headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},
   ...(body?{body:JSON.stringify({org_id:organizationId,...body})}:{}),cache:'no-store'});
  const out=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(out.error||'Falha ao consultar a Meta.');
  return out;
 },[organizationId]);
 const refresh=useCallback(async()=>{setLoading(true);try{const r=await request();setData(r);setError('')}catch(e){setError(e.message)}finally{setLoading(false)}},[request]);
 useEffect(()=>{setData({accounts:[],manager:false});setAdding(false);setAccountId('');setToken('');refresh()},[refresh]);
 async function connect(e){e.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
  try{const result=await request('POST',{action:'connect',account_id:accountId,access_token:token});
   setNotice(result.message);setToken('');setAccountId('');setAdding(false);await refresh();
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function disconnect(id){if(busy||!window.confirm('Desvincular esta conta de anúncios do Nexus?'))return;setBusy(true);
  try{const r=await request('POST',{action:'disconnect',connection_id:id});setNotice(r.message);await refresh()}
  catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <div className="nxad-page">
  <header className="nxad-header"><div><span className="nxad-overline"><BarChart3 size={16}/> NEXUS / MÍDIA PAGA</span><h1>Visão dos anúncios.</h1><p>Gastos e campanhas, sem misturar contas de outras empresas. Painel somente leitura.</p></div><div className="nxad-header-actions"><button type="button" onClick={refresh} disabled={loading}><RefreshCw size={16}/> Atualizar</button>{data.manager&&<button type="button" className="solid" onClick={()=>setAdding(x=>!x)}><Link2 size={15}/> {adding?'Cancelar':'Vincular conta'}</button>}</div></header>
  {error&&<div role="alert" className="nxad-error">{error}</div>}{notice&&<div role="status" className="nxad-notice"><CheckCircle2 size={16}/>{notice}</div>}
  {adding&&data.manager&&<form className="nxad-connect" onSubmit={connect}><div><h2>Vincular conta da Meta</h2><p>O token deve ter permissão <code>ads_read</code> para esta conta. Ele será criptografado no servidor.</p></div><label>ID da conta (act_...)<input required value={accountId} onChange={e=>setAccountId(e.target.value)} placeholder="Ex.: 1234567890"/></label><label>Token de acesso da Meta<input type="password" autoComplete="off" required minLength={20} value={token} onChange={e=>setToken(e.target.value)} placeholder="Token autorizado para leitura"/></label><button type="submit" disabled={busy||!token||!accountId}>{busy?'Verificando...':'Conectar para leitura'}</button></form>}
  {loading&&<div className="nxad-empty">Consultando contas e resultados...</div>}
  {!loading&&!data.accounts.length&&<div className="nxad-empty"><Wallet size={32}/><h2>Nenhuma conta vinculada</h2><p>Um gestor pode adicionar uma conta autorizada da Meta. Saldo ou campanha não são inventados enquanto não há conexão.</p></div>}
  {!loading&&data.accounts.map(account=><section key={account.id} className="nxad-account">
   <div className="nxad-account-head"><div><span>CONTA DE ANÚNCIOS · {account.account_id}</span><h2>{account.name}</h2><small>{account.error?'Consulta indisponível':'Moeda '+account.currency+' · Status '+status(account.account_status)}</small></div><div>{data.manager&&<button type="button" onClick={()=>disconnect(account.id)} disabled={busy}>Desvincular</button>}<a target="_blank" rel="noopener noreferrer" href={'https://adsmanager.facebook.com/adsmanager/manage/campaigns?act='+account.account_id.replace('act_','')}>Abrir Gerenciador <ArrowUpRight size={15}/></a></div></div>
   {account.error?<div className="nxad-error"><ShieldAlert size={16}/>{account.error}</div>:<>
     <div className="nxad-stats">
      <div><small>INVESTIMENTO · 7 DIAS</small><strong>{money(account.spend_7d,account.currency)}</strong></div>
      <div><small>CAMPANHAS CONSULTADAS</small><strong>{count(account.campaigns.length)}</strong></div>
      <div><small>{account.is_prepay_account?'CRÉDITO PRÉ-PAGO':'SALDO DE COBRANÇA'}</small><strong>{account.is_prepay_account?'Não verificado':account.billing_balance_minor===null?'Não informado':money(minor(account.billing_balance_minor),account.currency)}</strong></div>
     </div>
     <p className="nxad-billing-note"><Eye size={15}/> {account.is_prepay_account?'A Meta não confirmou o crédito pré-pago disponível nessa consulta. Consulte o Gerenciador para o valor exato.':'O saldo de cobrança não representa necessariamente dinheiro disponível para anunciar.'} Métricas: últimos 7 dias.</p>
     <div className="nxad-table-scroll"><table><thead><tr><th>Campanha</th><th>Situação</th><th>Gasto · 7 dias</th><th>Impressões</th><th>Cliques</th><th>CTR</th></tr></thead><tbody>
      {account.campaigns.map(c=><tr key={c.id}><td><strong>{c.name}</strong><small>{c.id}</small></td><td><span className="nxad-pill">{status(c.status)}</span></td><td>{money(c.spend_7d,account.currency)}</td><td>{count(c.impressions_7d)}</td><td>{count(c.clicks_7d)}</td><td>{Number(c.ctr_7d||0).toFixed(2).replace('.',',')}%</td></tr>)}
      {!account.campaigns.length&&<tr><td colSpan={6}>Nenhuma campanha disponível para esta conta.</td></tr>}
     </tbody></table></div>
     {account.limited_to_first_100&&<p className="nxad-billing-note">Listagem limitada às primeiras 100 campanhas; não é um relatório completo para contas maiores.</p>}
   </>}
  </section>)}
  <p className="nxad-footer"><LockKeyhole size={15}/> Consulta protegida por empresa, credenciais armazenadas criptografadas e nenhuma alteração automática em campanhas.</p>
 </div>;
}
