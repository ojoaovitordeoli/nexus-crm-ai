'use client';
import {useMemo,useState} from 'react';
import NexusCrmSettings from './NexusCrmSettings';
import Link from 'next/link';
import {CheckCircle2,Download,LockKeyhole,Moon,Sun} from 'lucide-react';

const currency=n=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:2}).format(Number(n)||0);
const decimal=n=>new Intl.NumberFormat('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2,useGrouping:false}).format(Number(n)||0);
const APPT_STATUS={scheduled:'Agendado',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado',canceled:'Cancelado',no_show:'Não compareceu'};
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
    return {leads,appointments,sales,sources:[...grouped.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8),
      revenue:sales.reduce((total,s)=>total+Number(s.value||0),0)};
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
  const most=Math.max(...view.sources.map(x=>x[1]),1);
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
    <div className="fx-two">
      <section className="fx-box"><div className="fx-boxhead"><h2>Origem dos leads</h2><span className="fx-groupcount">{view.sources.length}</span></div>
        {view.sources.length?<ol className="fx-bars">{view.sources.map(([name,value])=><li key={name}><span className="fx-bars-name">{name}</span><strong>{value}</strong><span className="fx-stage-bar"><span style={{width:Math.max(2,100*value/most)+'%'}}/></span></li>)}</ol>
          :<p className="fx-empty-small">Sem leads no período.</p>}
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
    </div>
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
