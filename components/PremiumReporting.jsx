'use client';
import {useMemo,useState} from 'react';
import NexusCrmSettings from './NexusCrmSettings';
import Link from 'next/link';
import {CheckCircle2,Download,LockKeyhole,Moon,Sun} from 'lucide-react';
import {sourceFunnel} from '../lib/sales-attribution.mjs';

const currency=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(Number(n)||0);
const integer=n=>new Intl.NumberFormat('pt-BR').format(Number(n)||0);
const when=s=>s?new Date(s).toLocaleDateString('pt-BR'):'';
const daysPeriod=(v,days)=>new Date(v||0).getTime()>=Date.now()-days*86400000;
const stageName=s=>String(s||'Sem etapa').replace(/[_-]/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const safeCell=value=>{
  let text=String(value??'').replace(/\r?\n/g,' ');
  if(/^[\s]*[=+@-]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
};
function downloadCsv(rows,name){
  const output='\ufeff'+rows.map(r=>r.map(safeCell).join(';')).join('\r\n');
  const blob=new Blob([output],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');anchor.href=url;anchor.download=name;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  URL.revokeObjectURL(url);
}
export function PremiumReports({data,counts,orgName,readonly}){
  const [period,setPeriod]=useState(30);
  const [csvMessage,setCsvMessage]=useState('');
  const view=useMemo(()=>{
    const leads=data.leads.filter(l=>daysPeriod(l.created_at,period));
    const appointments=data.appointments.filter(a=>daysPeriod(a.created_at,period));
    const sales=data.sales.filter(s=>daysPeriod(s.created_at,period));
    return {leads,appointments,sales,funnel:sourceFunnel(data,{days:period}),
      revenue:sales.reduce((total,s)=>total+Number(s.value||0),0)};
  },[data,period]);
  const rows=[
    ['Tipo','Registro','Status','Valor','Data'],
    ...view.sales.map(s=>['Venda',s.id,'Registrada',s.value,when(s.created_at)]),
    ...view.leads.map(l=>['Lead',l.contact?.first_name||l.id,l.status||'',l.source||'',when(l.created_at)]),
    ...view.appointments.map(a=>['Agendamento',a.title||a.id,a.status||'',a.type||'',when(a.created_at)])
  ];
  function exportReport(){
    if(readonly)return;
    downloadCsv(rows,'nexus-relatorio-'+period+'-dias.csv');
    setCsvMessage('Relatório CSV exportado com os registros carregados.');
  }
  const funnel=view.funnel;
  const pct=v=>v===null?'—':String(v).replace('.',',')+'%';
  return <div className="fx-page fx-reports">
    <header className="fx-pagehead">
      <div className="fx-pagehead-title"><h1>Relatórios</h1><span className="fx-count">últimos {period} dias</span></div>
      <div className="fx-actions"><div className="fx-tabs" role="group" aria-label="Período">{[7,30,90].map(n=><button type="button" key={n} aria-pressed={n===period} className={n===period?'active':''} onClick={()=>{setPeriod(n);setCsvMessage('')}}>{n} dias</button>)}</div>
      {!readonly&&<button type="button" onClick={exportReport} className="fx-btn"><Download size={15}/> Exportar CSV</button>}</div>
    </header>
    {csvMessage&&<div role="status" className="fx-alert fx-alert--ok"><CheckCircle2 size={16}/>{csvMessage}<button type="button" aria-label="Fechar aviso" onClick={()=>setCsvMessage('')}>×</button></div>}
    <section className="fx-strip fx-strip--4" aria-label="Resumo do período">
      <div><span>Leads captados</span><strong>{integer(view.leads.length)}</strong></div>
      <div><span>Agendamentos criados</span><strong>{integer(view.appointments.length)}</strong></div>
      <div><span>Vendas</span><strong>{integer(view.sales.length)}</strong></div>
      <div><span>Faturamento</span><strong>{currency(view.revenue)}</strong></div>
      <p className="fx-strip-note">Baseado nos últimos 250 registros carregados por módulo. Nenhum valor é estimado.</p>
    </section>
    <section className="fx-box" aria-labelledby="fx-origem-titulo">
      <div className="fx-boxhead"><h2 id="fx-origem-titulo">Origem até a venda</h2><span className="fx-groupcount">{funnel.rows.length}</span></div>
      {funnel.rows.length?<div className="fx-table fx-table--sources" role="table" aria-label="Resultado por origem dos leads">
        <div className="fx-thead" role="row"><span role="columnheader">Origem</span><span role="columnheader">Leads</span><span role="columnheader">Agendaram</span><span role="columnheader">Compraram</span><span role="columnheader">Conversão</span><span role="columnheader">Faturamento</span></div>
        {funnel.rows.map(r=><div className="fx-tr" role="row" key={r.source}>
          <span role="cell"><strong>{r.source}</strong></span>
          <span role="cell" className="fx-num" data-label="Leads">{integer(r.leads)}</span>
          <span role="cell" className="fx-num" data-label="Agendaram">{integer(r.withAppointment)} <small className="fx-muted">{pct(r.appointmentRate)}</small></span>
          <span role="cell" className="fx-num" data-label="Compraram">{integer(r.withSale)}</span>
          <strong role="cell" className={'fx-num'+(r.saleRate?'':' fx-muted')} data-label="Conversão">{pct(r.saleRate)}</strong>
          <strong role="cell" className="fx-num" data-label="Faturamento">{currency(r.revenue)}</strong>
        </div>)}
      </div>:<div className="fx-empty"><strong>Sem leads no período</strong><p>Quando houver leads com origem registrada, você verá aqui quantos agendaram e compraram.</p></div>}
      <p className="fx-note">Coorte: leads criados nos últimos {period} dias. Agendamentos e vendas contam só quando estão vinculados ao lead na ficha; volume de leads sozinho não indica a melhor origem.
        {funnel.unattributedSales>0&&<> <strong>{integer(funnel.unattributedSales)} {funnel.unattributedSales===1?'venda':'vendas'} ({currency(funnel.unattributedRevenue)}) sem lead vinculado</strong> não {funnel.unattributedSales===1?'entra':'entram'} em nenhuma origem — registre a venda a partir do lead para medir.</>}</p>
    </section>
    <section className="fx-box"><div className="fx-boxhead"><h2>Totais no banco</h2><Link href="/leads" className="fx-link">Abrir leads</Link></div>
        <dl className="fx-kv">
          <div><dt>Empresa</dt><dd>{orgName}</dd></div>
          <div><dt>Contatos</dt><dd>{integer(counts.contacts)}</dd></div>
          <div><dt>Leads</dt><dd>{integer(counts.leads)}</dd></div>
          <div><dt>Tarefas</dt><dd>{integer(counts.tasks)}</dd></div>
          <div><dt>Agendamentos</dt><dd>{integer(counts.appointments)}</dd></div>
        </dl>
      </section>
    <p className="fx-note">Para períodos mais longos ou relatórios financeiros completos, será necessária uma consulta paginada no servidor.</p>
  </div>;
}
export function PremiumSettings({profile,session,role,organization,onTheme,dark}){
  const [message,setMessage]=useState('');
  const organizationName=organization?.name||'Empresa não selecionada';
  return <div className="fx-page fx-settings">
    <header className="fx-pagehead"><div className="fx-pagehead-title"><h1>Configurações</h1></div></header>
    {message&&<div className="fx-alert fx-alert--ok" role="status"><CheckCircle2 size={16}/>{message}<button type="button" aria-label="Fechar aviso" onClick={()=>setMessage('')}>×</button></div>}
    <div className="fx-two">
      <section className="fx-box"><div className="fx-boxhead"><h2>Aparência</h2><span className="fx-boxmeta">Salvo neste navegador</span></div>
      <div className="fx-theme-choice" role="group" aria-label="Tema">
        <button type="button" aria-pressed={!dark} className={!dark?'selected':''} onClick={()=>{if(dark)onTheme();setMessage('Tema claro selecionado.')}}><Sun size={17}/><span><strong>Claro</strong><small>Fundo branco, destaque roxo</small></span>{!dark&&<CheckCircle2 size={16}/>}</button>
        <button type="button" aria-pressed={dark} className={dark?'selected':''} onClick={()=>{if(!dark)onTheme();setMessage('Tema escuro selecionado.')}}><Moon size={17}/><span><strong>Escuro</strong><small>Fundo preto, destaque roxo</small></span>{dark&&<CheckCircle2 size={16}/>}</button>
      </div>
      </section>
      <section className="fx-box"><div className="fx-boxhead"><h2>Conta e permissões</h2><Link href="/minha-area" className="fx-link">Ver meu perfil</Link></div>
        <dl className="fx-kv">
          <div><dt>Nome</dt><dd>{profile?.full_name||'Não informado'}</dd></div>
          <div><dt>E-mail</dt><dd>{session?.email||'—'}</dd></div>
          <div><dt>Empresa</dt><dd>{organizationName}</dd></div>
          <div><dt>Perfil</dt><dd>{role||'Membro'}</dd></div>
        </dl>
        <p className="fx-boxfoot fx-boxfoot--note"><LockKeyhole size={14}/> Permissões e cadastro são administrados pelo Super Admin. A senha é alterada pelo fluxo de recuperação do login.</p>
      </section>
    </div>
    <NexusCrmSettings organizationId={organization?.id}/>
  </div>;
}
