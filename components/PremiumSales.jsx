'use client';
import {useState} from 'react';
import {CheckCircle2,Plus,Receipt,TrendingUp,Wallet} from 'lucide-react';

const money=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(n)||0);
const date=v=>v?new Date(v).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'—';

export default function PremiumSales({sales=[],count=0,readonly=false,onOperation,onReload}){
  const [value,setValue]=useState('');
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const revenue=sales.reduce((sum,item)=>sum+Number(item.value||0),0);
  const average=sales.length?revenue/sales.length:0;
  const partial=count>sales.length;
  async function create(e){
    e.preventDefault();
    const amount=Number(String(value).replace(',','.'));
    if(readonly||saving||!Number.isFinite(amount)||amount<=0)return;
    setSaving(true);setError('');setNotice('');
    try{const result=await onOperation({action:'sale_create',value:amount});setValue('');setNotice(result.message||'Venda registrada.');await onReload?.()}
    catch(e){setError(e.message||'Não foi possível registrar a venda.')}
    finally{setSaving(false)}
  }
  return <div className="nxp-premium nxp-sales-page">
    <div className="nxp-page-head"><div><span className="nxp-kicker">Resultados comerciais</span><h1>Vendas</h1><p>Registre as vendas e acompanhe os valores lançados pela equipe.</p></div><span className="nxp-total"><span/>{count} vendas carregadas</span></div>
    {error&&<div className="nxp-error" role="alert">{error}</div>}{notice&&<div className="nxp-success" role="status"><CheckCircle2 size={16}/>{notice}</div>}
    <div className="nxp-sales-metrics"><article><span><Receipt size={19}/></span><small>Vendas registradas</small><strong>{count}</strong><em>na empresa</em></article><article><span><Wallet size={19}/></span><small>Receita carregada</small><strong>{money(revenue)}</strong><em>entre as vendas carregadas</em></article><article><span><TrendingUp size={19}/></span><small>Ticket médio</small><strong>{money(average)}</strong><em>entre as vendas carregadas</em></article></div>
    {!readonly&&<section className="nxp-surface nxp-sale-create"><div><span className="nxp-kicker">Nova venda</span><h2>Registrar venda</h2><p>Informe o valor da venda. O histórico e os indicadores serão atualizados.</p></div><form onSubmit={create}><label>Valor da venda<input inputMode="decimal" required min="0.01" step="0.01" placeholder="R$ 0,00" value={value} onChange={e=>setValue(e.target.value)}/></label><button className="nxp-button nxp-button--primary" disabled={saving||!value}>{saving?'Registrando...':<><Plus size={16}/> Registrar venda</>}</button></form></section>}
    <section className="nxp-surface nxp-sales-list"><div className="nxp-panel-head"><div><span className="nxp-kicker">Histórico</span><h3>Últimas vendas</h3><p>Registros mais recentes da empresa. {partial?'Os valores acima consideram somente as vendas carregadas, não o histórico integral.':'Os valores acima consideram as vendas carregadas.'}</p></div><Receipt size={21}/></div>{sales.length?<div className="nxp-sales-table"><div className="nxp-sales-row nxp-sales-row--head"><span>Identificador</span><span>Data</span><span>Valor</span></div>{sales.map((sale,index)=><div className="nxp-sales-row" key={sale.id}><span><strong>Venda #{String(sale.id).slice(0,8)}</strong><small>Registro operacional {index+1}</small></span><span>{date(sale.created_at)}</span><strong>{money(sale.value)}</strong></div>)}</div>:<div className="nxp-sales-empty"><Receipt size={28}/><strong>Nenhuma venda registrada ainda</strong><p>Registre a primeira venda para começar a acompanhar receita e ticket médio.</p></div>}</section>
  </div>;
}
