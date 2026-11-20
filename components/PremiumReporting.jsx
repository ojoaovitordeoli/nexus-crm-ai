'use client';
import {useMemo,useState} from 'react';
import NexusCrmSettings from './NexusCrmSettings';
import NexusTeam from './NexusTeam';
import NexusLeadCapture from './NexusLeadCapture';
import Link from 'next/link';
import {CheckCircle2,Download,LockKeyhole,Moon,Sun} from 'lucide-react';
import {sourceFunnel} from '../lib/sales-attribution.mjs';
import {referralRanking} from '../lib/referrals.mjs';
import {aceSummary} from '../lib/ace.mjs';

const rate=v=>v===null||v===undefined?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:1}).format(v)+'%';
function AcePanel({ace,referralsReady}){
  const {attraction:a,conversion:c,expansion:e}=ace;
  return <section className="fx-box fx-ace" aria-label="Método ACE">
    <div className="fx-boxhead"><h2>Método ACE</h2><span className="fx-boxmeta">Atração → Conversão → Expansão · leads que chegaram nos últimos {ace.days} dias</span></div>
    <div className="fx-ace-flow">
      <div className="fx-ace-step" aria-label="Atração">
        <span className="fx-ace-kicker">1 · Atração</span>
        <strong className="fx-ace-big">{integer(a.leads)}</strong><span className="fx-ace-unit">{a.leads===1?'lead chegou':'leads chegaram'}</span>
        {a.sources.length?<ul className="fx-ace-list">{a.sources.slice(0,4).map(s=><li key={s.name}><span>{s.name}</span><b>{integer(s.count)}</b></li>)}</ul>
          :<p className="fx-empty-small">Nenhum lead no período.</p>}
      </div>
      <div className="fx-ace-step" aria-label="Conversão">
        <span className="fx-ace-kicker">2 · Conversão</span>
        <strong className="fx-ace-big">{rate(c.saleRate)}</strong><span className="fx-ace-unit">dos leads compraram ({integer(c.sold)})</span>
        <ul className="fx-ace-list">
          <li><span>Agendaram</span><b>{integer(c.scheduled)} · {rate(c.scheduleRate)}</b></li>
          <li><span>Compareceram</span><b>{integer(c.attended)} · {rate(c.attendanceRate)}</b></li>
          <li><span>Faltaram</span><b className={c.noShow?'fx-ace-warn':''}>{integer(c.noShow)} · {rate(c.noShowRate)}</b></li>
          <li><span>Vendido</span><b>{currency(c.revenue)}</b></li>
        </ul>
      </div>
      <div className="fx-ace-step" aria-label="Expansão">
        <span className="fx-ace-kicker">3 · Expansão</span>
        <strong className="fx-ace-big">{integer(e.repeatCustomers)}</strong><span className="fx-ace-unit">{e.repeatCustomers===1?'cliente comprou de novo':'clientes compraram de novo'}</span>
        <ul className="fx-ace-list">
          <li><span>Recompra</span><b>{currency(e.repeatRevenue)}</b></li>
          <li><span>Clientes no período</span><b>{integer(e.customers)}{e.customers?' · '+rate(e.repeatRate)+' voltaram':''}</b></li>
          {referralsReady&&<li><span>Leads por indicação</span><b>{integer(e.referred)} · {rate(e.referredShare)}</b></li>}
        </ul>
      </div>
    </div>
    <p className="fx-boxfoot fx-boxfoot--note">Conversão conta só agendamentos e vendas vinculados ao lead; agendamento cancelado não entra. Recompra = cliente com mais de uma venda e a nova compra no período.</p>
  </section>;
}

const currency=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(Number(n)||0);
const decimal=n=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false}).format(Number(n)||0);
const APPT_STATUS={scheduled:'Agendado',confirmed:'Confirmado',completed:'Compareceu',cancelled:'Cancelado',canceled:'Cancelado',no_show:'Não compareceu'};
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
    const sales=data.sales.filter(s=>daysPeriod(s.sale_date||s.created_at,period));
    const grouped=new Map();
    leads.forEach(l=>{const key=l.source||'Não informada';grouped.set(key,(grouped.get(key)||0)+1)});
    // Indicações dos leads do período; a venda conta mesmo que tenha saído depois (vínculo pelo lead).
    const referrals=referralRanking({leads,sales:data.sales,contacts:data.contacts});
    return {leads,appointments,sales,sources:[...grouped.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8),
      funnel:sourceFunnel(data,{days:period}),
      revenue:sales.reduce((total,s)=>total+Number(s.value||0),0),referrals,ace:aceSummary(data,period),
      referredLeads:referrals.reduce((t,r)=>t+r.leads,0)};
  },[data,period]);
  const rows=[
    // Antes a coluna "Valor" recebia a origem do lead e o tipo do agendamento; valor saía com ponto (1500.5).
    ['Tipo','Registro','Status','Origem/Tipo','Valor (R$)','Data'],
    ...view.sales.map(s=>['Venda',s.id,'Registrada','',decimal(s.value),when(s.sale_date||s.created_at)]),
    ...view.leads.map(l=>['Lead',[l.contact?.first_name,l.contact?.last_name].filter(Boolean).join(' ')||l.id,l.status||'',l.source||'Não informada','',when(l.created_at)]),
    ...view.appointments.map(a=>['Agendamento',a.title||a.id,APPT_STATUS[a.status]||stageName(a.status),a.type||'','',when(a.start_at||a.created_at)])
  ];
  function exportReport(){
    if(readonly)return;
    if(rows.length<2){setCsvMessage('Nenhum registro no período para exportar.');return}
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
    <AcePanel ace={view.ace} referralsReady={Boolean(data.referrals_ready)}/>
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
    {data.referrals_ready&&<section className="fx-box" aria-label="Quem mais indica">
      <div className="fx-boxhead"><h2>Quem mais indica</h2><span className="fx-boxmeta">{integer(view.referredLeads)} de {integer(view.leads.length)} {view.referredLeads===1?'lead veio':'leads vieram'} de indicação</span></div>
      {view.referrals.length?<ol className="fx-bars">{view.referrals.slice(0,10).map(r=><li key={r.contact_id}>
          <span className="fx-bars-name">{r.name}<small className="fx-bars-sub"> · {integer(r.converted)} {r.converted===1?'virou venda':'viraram venda'}{r.value>0?' · '+currency(r.value):''}</small></span>
          <strong aria-label={integer(r.leads)+' indicações'}>{integer(r.leads)}</strong>
          <span className="fx-stage-bar"><span style={{width:Math.max(2,100*r.leads/Math.max(view.referrals[0].leads,1))+'%'}}/></span>
        </li>)}</ol>
        :<p className="fx-empty-small">Nenhuma indicação registrada no período. Na ficha do lead, use "Indicado por" para registrar quem trouxe o cliente.</p>}
    </section>}
    <p className="fx-note">Para períodos mais longos ou relatórios financeiros completos, será necessária uma consulta paginada no servidor.</p>
  </div>;
}
export function PremiumSettings({profile,session,role,organization,onTheme,dark,canManageTeam=false}){
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
        <p className="fx-boxfoot fx-boxfoot--note"><LockKeyhole size={14}/> {canManageTeam?'Você gerencia a equipe desta empresa logo abaixo.':'Seu acesso é definido pelo administrador da empresa.'} Para trocar a senha, use "Esqueci minha senha" na tela de login.</p>
      </section>
    </div>
    {canManageTeam&&organization?.id&&<NexusTeam organizationId={organization.id}/>}
    <NexusCrmSettings organizationId={organization?.id}/>
    {canManageTeam&&organization?.id&&<NexusLeadCapture organizationId={organization.id}/>}
  </div>;
}
