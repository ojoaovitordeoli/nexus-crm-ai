'use client';
import {useMemo,useState} from 'react';
import {CheckCircle2,Plus,Target,X} from 'lucide-react';
import {parseBRL} from '../lib/shell-rules.mjs';
import {dataCurta} from '../lib/formato.mjs';
import {PAYMENT_METHODS,paymentLabel,goalProgress} from '../lib/sale-rules.mjs';
import ConfirmButton from './ConfirmButton';

const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
// V57: sale_date (AAAA-MM-DD) é dia local; new Date() mostrava o dia anterior no fuso de Brasília.
const date=v=>dataCurta(v);
// Data do negócio: sale_date quando existir; created_at para registros antigos.
const saleWhen=s=>s?.sale_date||s?.created_at;
const PERIODS=[['all','Todas'],[30,'30 dias'],[90,'90 dias']];
const todayISO=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const monthName=key=>{const [y,m]=String(key||'').split('-').map(Number);return y&&m?new Date(y,m-1,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'}):''};
const PAYMENT_OPTIONS=Object.entries(PAYMENT_METHODS);

const personOf=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim();

// Meta de faturamento do mês: realizado x meta, ritmo esperado para o dia e quanto falta.
function GoalPanel({goal,canManage,readonly,onOperation,onReload}){
  const [editing,setEditing]=useState(false),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  if(!goal)return null;
  const range=goal.from&&goal.to?{fromIso:goal.from,toIso:goal.to}:null;
  const p=goal.target?goalProgress({target:goal.target,achieved:goal.achieved||0,range}):null;
  const canEdit=canManage&&!readonly;
  async function save(e){
    e.preventDefault();
    const target=draft.trim()?parseBRL(draft):null;
    if(target!==null&&(!Number.isFinite(target)||target<=0)){setError('Meta inválida. Use o formato 50.000,00.');return}
    setBusy(true);setError('');
    try{await onOperation({action:'goal_set',month:goal.month,target});setEditing(false);await onReload?.()}
    catch(err){setError(err.message||'Não foi possível salvar a meta.')}finally{setBusy(false)}
  }
  const status={done:'Meta batida',on_track:'No ritmo',behind:'Abaixo do ritmo'};
  return <section className="fx-box fx-goal" aria-label="Meta do mês">
    <div className="fx-boxhead"><h2><Target size={16} aria-hidden="true"/> Meta de {monthName(goal.month)}</h2>
      {canEdit&&!editing&&<button type="button" className="nx13-linkbutton" onClick={()=>{setDraft(goal.target?new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2}).format(goal.target):'');setEditing(true);setError('')}}>{goal.target?'Alterar meta':'Definir meta'}</button>}
    </div>
    {editing?<form className="fx-goal-form" onSubmit={save}>
      <label>Meta de faturamento<input inputMode="decimal" placeholder="Ex.: 50.000,00" value={draft} onChange={e=>setDraft(e.target.value)} autoFocus aria-describedby="goal-hint"/></label>
      <small id="goal-hint" className="fx-muted">Deixe em branco e salve para remover a meta deste mês.</small>
      <span className="fx-row-actions"><button type="submit" className="fx-btn fx-btn--primary" disabled={busy}>{busy?'Salvando…':'Salvar meta'}</button><button type="button" className="fx-btn" onClick={()=>setEditing(false)}>Cancelar</button></span>
      {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    </form>:p?<div className="fx-goal-body">
      <div className="fx-goal-numbers"><strong>{money(p.achieved)}</strong><span>de {money(p.target)}</span><em className={'fx-goal-status fx-goal-status--'+p.status}>{status[p.status]}</em></div>
      <div className="fx-goal-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100,p.pct)} aria-label={'Meta atingida em '+p.pct+'%'}>
        <span style={{width:Math.min(100,p.pct)+'%'}}/><i style={{left:Math.min(100,p.expected)+'%'}} title={'Esperado hoje: '+p.expected+'%'}/>
      </div>
      <p className="fx-muted">{p.pct}% da meta · esperado para hoje: {p.expected}% · {p.remaining>0?'faltam '+money(p.remaining):'meta atingida'}{goal.sales_count!=null?' · '+goal.sales_count+(goal.sales_count===1?' venda no mês':' vendas no mês'):''}</p>
    </div>:<div className="fx-goal-body"><p className="fx-muted">{goal.achieved!=null?'Faturamento do mês até agora: '+money(goal.achieved)+'. ':''}{canEdit?'Defina a meta para acompanhar o ritmo do mês.':'Nenhuma meta definida para este mês.'}</p></div>}
  </section>;
}

export default function PremiumSales({sales=[],count=0,leads=[],goal=null,readonly=false,canManage=false,userId='',onOperation,onReload}){
  const [editId,setEditId]=useState(''),[editValue,setEditValue]=useState(''),[editLead,setEditLead]=useState(''),[editPayment,setEditPayment]=useState(''),[rowBusy,setRowBusy]=useState('');
  const canFix=sale=>!readonly&&(canManage||sale.seller_id===userId);
  const startFix=sale=>{setEditId(sale.id);setEditValue(new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(sale.value)||0));setEditLead(sale.lead_id||'');setEditPayment(sale.payment_method||'');setError('');setNotice('')};
  async function saveFix(e,sale){
    e.preventDefault();const amount=parseBRL(editValue);
    if(!Number.isFinite(amount)||amount<=0||amount>100000000){setError('Valor inválido. Use o formato 1.500,00.');return}
    setRowBusy(sale.id);setError('');
    try{const r=await onOperation({action:'sale_update',id:sale.id,value:amount,lead_id:editLead||null,payment_method:editPayment||null});setEditId('');setNotice(r.message||'Venda corrigida.');await onReload?.()}
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
  const [payment,setPayment]=useState('');
  const [product,setProduct]=useState('');
  const [saleDate,setSaleDate]=useState(todayISO);
  const [notes,setNotes]=useState('');
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
      const payload={action:'sale_create',value:amount,payment_method:payment||null,product,notes};
      if(saleDate&&saleDate!==todayISO())payload.sale_date=saleDate;
      if(leadId)payload.lead_id=leadId;
      const result=await onOperation(payload);
      setValue('');setLeadId('');setPayment('');setProduct('');setNotes('');setSaleDate(todayISO());
      setNotice(result.message||'Venda registrada.');await onReload?.()
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
    {!readonly&&showCreate&&<form className="fx-panel fx-sale-form" onSubmit={create} aria-label="Registrar venda">
      <label>Valor da venda<input inputMode="decimal" required placeholder="Ex.: 1.500,00" aria-describedby="sale-value-hint" value={value} onChange={e=>{setValue(e.target.value);if(error)setError('')}} autoFocus/><small id="sale-value-hint" className="fx-muted">{value&&Number.isFinite(parseBRL(value))&&parseBRL(value)>0?'Será registrado: '+money(parseBRL(value)):'Use vírgula para os centavos.'}</small></label>
      <label>Forma de pagamento<select value={payment} onChange={e=>setPayment(e.target.value)} aria-label="Forma de pagamento">
        <option value="">Não informada</option>{PAYMENT_OPTIONS.map(([id,text])=><option key={id} value={id}>{text}</option>)}
      </select></label>
      <label>Cliente (opcional)<select value={leadId} onChange={e=>setLeadId(e.target.value)} aria-label="Lead da venda">
        <option value="">Sem vínculo com lead</option>
        {openLeads.map(l=><option key={l.id} value={l.id}>{l.person}</option>)}
      </select><small className="fx-muted">A venda entra na linha do tempo do lead.</small></label>
      <label>Data da venda<input type="date" value={saleDate} max={todayISO()} onChange={e=>setSaleDate(e.target.value)} aria-label="Data da venda"/></label>
      <label className="fx-sale-form-wide">Produto ou serviço (opcional)<input maxLength={160} placeholder="Ex.: Óculos multifocal + armação" value={product} onChange={e=>setProduct(e.target.value)}/></label>
      <label className="fx-sale-form-wide">Observação (opcional)<textarea maxLength={600} rows={2} placeholder="Parcelas, desconto combinado, entrega…" value={notes} onChange={e=>setNotes(e.target.value)}/></label>
      <button type="submit" className="fx-btn fx-btn--primary" disabled={saving||!value.trim()}>{saving?'Registrando…':'Salvar venda'}</button>
    </form>}
    <GoalPanel goal={goal} canManage={canManage} readonly={readonly} onOperation={onOperation} onReload={onReload}/>
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
          <label role="cell">Pagamento<select value={editPayment} onChange={e=>setEditPayment(e.target.value)} aria-label="Forma de pagamento da venda">
            <option value="">Não informada</option>{PAYMENT_OPTIONS.map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></label>
          <label role="cell">Valor<input inputMode="decimal" value={editValue} onChange={e=>setEditValue(e.target.value)} aria-label="Valor da venda" autoFocus/></label>
          <span role="cell" className="fx-sale-edit-actions"><button type="submit" className="fx-btn fx-btn--primary" disabled={rowBusy===sale.id}>Salvar</button><button type="button" className="fx-btn" onClick={()=>setEditId('')}>Cancelar</button></span>
        </form>:<div className="fx-tr" role="row" key={sale.id}><span role="cell"><strong>{personOf(sale.contact)||'Venda #'+String(sale.id).slice(0,8)}</strong>{(sale.product||sale.payment_method)&&<small className="fx-sale-meta">{[sale.product,paymentLabel(sale.payment_method)].filter(Boolean).join(' · ')}</small>}</span><span role="cell" className="fx-muted">{date(saleWhen(sale))}</span><strong role="cell" className="fx-num">{money(sale.value)}</strong>
          <span role="cell" className="fx-row-actions">{canFix(sale)&&<button type="button" className="nx13-linkbutton" onClick={()=>startFix(sale)} disabled={Boolean(rowBusy)}>Corrigir</button>}
            {canManage&&!readonly&&<ConfirmButton onConfirm={()=>removeSale(sale)} disabled={Boolean(rowBusy)}/>}</span></div>)}
      </div>:<div className="fx-empty"><strong>{sales.length?'Nenhuma venda neste período':'Nenhuma venda registrada'}</strong><p>{sales.length?'Escolha outro período.':readonly?'As vendas lançadas pela equipe aparecerão aqui.':'Use “Registrar venda” para lançar a primeira.'}</p></div>}
    </section>
  </div>;
}
