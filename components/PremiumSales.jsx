'use client';
import {useMemo,useState} from 'react';
import {CheckCircle2,Plus,X} from 'lucide-react';
import {parseBRL} from '../lib/shell-rules.mjs';
import ConfirmButton from './ConfirmButton';

const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const date=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';
// Data do negócio: sale_date quando existir; created_at para registros antigos.
const saleWhen=s=>s?.sale_date||s?.created_at;
const PERIODS=[['all','Todas'],[30,'30 dias'],[90,'90 dias']];

const personOf=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim();
export default function PremiumSales({sales=[],count=0,leads=[],readonly=false,canManage=false,userId='',onOperation,onReload}){
  const [editId,setEditId]=useState(''),[editValue,setEditValue]=useState(''),[editLead,setEditLead]=useState(''),[rowBusy,setRowBusy]=useState('');
  const canFix=sale=>!readonly&&(canManage||sale.seller_id===userId);
  const startFix=sale=>{setEditId(sale.id);setEditValue(new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(sale.value)||0));setEditLead(sale.lead_id||'');setError('');setNotice('')};
  async function saveFix(e,sale){
    e.preventDefault();const amount=parseBRL(editValue);
    if(!Number.isFinite(amount)||amount<=0||amount>100000000){setError('Valor inválido. Use o formato 1.500,00.');return}
    setRowBusy(sale.id);setError('');
    try{const r=await onOperation({action:'sale_update',id:sale.id,value:amount,lead_id:editLead||null});setEditId('');setNotice(r.message||'Venda corrigida.');await onReload?.()}
    catch(err){setError(err.message||'Não foi possível corrigir.')}finally{setRowBusy('')}
  }
  async function removeSale(sale){
    setRowBusy(sale.id);setError('');
    try{const r=await onOperation({action:'sale_delete',id:sale.id});setNotice(r.message||'Venda excluída.');await onReload?.()}
    catch(err){setError(err.message||'Não foi possível excluir.')}finally{setRowBusy('')}
  }
  const [leadId,setLeadId]=useState('');
  // Leads abertos com contato, para vincular a venda ao cliente.
  const openLeads=useMemo(()=>leads.filter(l=>!l.closed_at&&l.status!=='won'&&l.status!=='lost'&&l.contact).map(l=>({id:l.id,person:personOf(l.contact)||'Contato sem nome'})),[leads]);
  const [value,setValue]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [showCreate,setShowCreate]=useState(false);
  const [period,setPeriod]=useState('all');
  const shown=useMemo(()=>period==='all'?sales:sales.filter(s=>new Date(saleWhen(s)||0).getTime()>=Date.now()-period*86400000),[sales,period]);
  const revenue=shown.reduce((sum,item)=>sum+Number(item.value||0),0);
  const average=shown.length?revenue/shown.length:0;
  const partial=count>sales.length;
  async function create(e){
    e.preventDefault();
    if(readonly||saving)return;
    // Antes: "1.500,00" virava NaN (nada acontecia) e "1.500" era gravado como R$ 1,50.
    const amount=parseBRL(value);
    if(!Number.isFinite(amount)||amount<=0||amount>100000000){setNotice('');setError('Valor inválido. Use o formato 1.500,00 (até R$ 100.000.000,00).');return}
    setSaving(true);setError('');setNotice('');
    try{
      const payload={action:'sale_create',value:amount};
      if(leadId)payload.lead_id=leadId;
      const result=await onOperation(payload);
      setValue('');setLeadId('');setNotice(result.message||'Venda registrada.');await onReload?.()
    }
    catch(e){setError(e.message||'Não foi possível registrar a venda.')}
    finally{setSaving(false)}
  }
  return <div className="fx-page fx-sales">
    <header className="fx-pagehead">
      <div className="fx-pagehead-title"><h1>Vendas</h1><span className="fx-count">{new Intl.NumberFormat('pt-BR').format(count)} {count===1?'venda':'vendas'}</span></div>
      {!readonly&&<div className="fx-actions"><button type="button" className="fx-btn fx-btn--primary" aria-expanded={showCreate} onClick={()=>setShowCreate(v=>!v)}>{showCreate?<><X size={16}/> Fechar</>:<><Plus size={16}/> Registrar venda</>}</button></div>}
    </header>
    {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    {notice&&<div className="fx-alert fx-alert--ok" role="status"><CheckCircle2 size={16}/>{notice}</div>}
    {!readonly&&showCreate&&<form className="fx-panel fx-panel--narrow" onSubmit={create} aria-label="Registrar venda">
      <label>Valor da venda<input inputMode="decimal" required placeholder="Ex.: 1.500,00" aria-describedby="sale-value-hint" value={value} onChange={e=>{setValue(e.target.value);if(error)setError('')}} autoFocus/><small id="sale-value-hint" className="fx-muted">{value&&Number.isFinite(parseBRL(value))&&parseBRL(value)>0?'Será registrado: '+money(parseBRL(value)):'Use vírgula para os centavos.'}</small></label>
      <label>Cliente (opcional)<select value={leadId} onChange={e=>setLeadId(e.target.value)} aria-label="Lead da venda">
        <option value="">Sem vínculo com lead</option>
        {openLeads.map(l=><option key={l.id} value={l.id}>{l.person}</option>)}
      </select><small className="fx-muted">A venda entra na linha do tempo do lead.</small></label>
      <button type="submit" className="fx-btn fx-btn--primary" disabled={saving||!value.trim()}>{saving?'Registrando...':'Salvar venda'}</button>
    </form>}
    <section className="fx-strip" aria-label="Resumo das vendas">
      <div><span>Total</span><strong>{money(revenue)}</strong></div>
      <div><span>Quantidade</span><strong>{shown.length}</strong></div>
      <div><span>Ticket médio</span><strong>{shown.length?money(average):'—'}</strong></div>
      <p className="fx-strip-note">{partial?'Calculado sobre as '+sales.length+' vendas carregadas de '+count+' registradas.':'Calculado sobre as vendas registradas.'}</p>
    </section>
    <section className="fx-box">
      <div className="fx-boxhead"><h2>Últimas vendas</h2><div className="fx-tabs" role="group" aria-label="Período">{PERIODS.map(([id,text])=><button type="button" key={id} className={period===id?'active':''} aria-pressed={period===id} onClick={()=>setPeriod(id)}>{text}</button>)}</div></div>
      {shown.length?<div className="fx-table fx-table--sales" role="table" aria-label="Vendas registradas">
        <div className="fx-thead" role="row"><span role="columnheader">Cliente</span><span role="columnheader">Data</span><span role="columnheader">Valor</span><span role="columnheader"><span className="fx-sr">Ações</span></span></div>
        {shown.map(sale=>editId===sale.id?<form className="fx-tr fx-sale-edit" role="row" key={sale.id} onSubmit={e=>saveFix(e,sale)}>
          <label role="cell">Cliente<select value={editLead} onChange={e=>setEditLead(e.target.value)} aria-label="Cliente da venda">
            <option value="">Sem vínculo com lead</option>
            {sale.lead_id&&!openLeads.some(l=>l.id===sale.lead_id)&&<option value={sale.lead_id}>{personOf(sale.contact)||'Lead atual'}</option>}
            {openLeads.map(l=><option key={l.id} value={l.id}>{l.person}</option>)}</select></label>
          <label role="cell">Valor<input inputMode="decimal" value={editValue} onChange={e=>setEditValue(e.target.value)} aria-label="Valor da venda" autoFocus/></label>
          <span role="cell" className="fx-sale-edit-actions"><button type="submit" className="fx-btn fx-btn--primary" disabled={rowBusy===sale.id}>Salvar</button><button type="button" className="fx-btn" onClick={()=>setEditId('')}>Cancelar</button></span>
        </form>:<div className="fx-tr" role="row" key={sale.id}><span role="cell"><strong>{personOf(sale.contact)||'Venda #'+String(sale.id).slice(0,8)}</strong></span><span role="cell" className="fx-muted">{date(saleWhen(sale))}</span><strong role="cell" className="fx-num">{money(sale.value)}</strong>
          <span role="cell" className="fx-row-actions">{canFix(sale)&&<button type="button" className="nx13-linkbutton" onClick={()=>startFix(sale)} disabled={Boolean(rowBusy)}>Corrigir</button>}
            {canManage&&!readonly&&<ConfirmButton onConfirm={()=>removeSale(sale)} disabled={Boolean(rowBusy)}/>}</span></div>)}
      </div>:<div className="fx-empty"><strong>{sales.length?'Nenhuma venda neste período':'Nenhuma venda registrada'}</strong><p>{sales.length?'Escolha outro período.':readonly?'As vendas lançadas pela equipe aparecerão aqui.':'Use “Registrar venda” para lançar a primeira.'}</p></div>}
    </section>
  </div>;
}
