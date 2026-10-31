'use client';
import {useMemo,useState} from 'react';
import Link from 'next/link';
import {
  ArrowRight,BarChart3,BriefcaseBusiness,CalendarDays,CheckCircle2,
  Clock3,ContactRound,Download,FileSpreadsheet,Layers3,LockKeyhole,
  Moon,ShieldCheck,Sun,TrendingUp,UsersRound,Wallet
} from 'lucide-react';

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
function Tag({children}){return <span className="v4-report-tag">{children}</span>}
function InfoTile({title,value,icon:Icon,info}){return <div className="v4-report-tile"><span><Icon size={19}/></span><small>{title}</small><strong>{value}</strong><p>{info}</p></div>}
function Empty({children}){return <div className="v4-report-empty"><BarChart3 size={23}/><span>{children}</span></div>}
export function PremiumReports({data,counts,orgName,readonly}){
  const [period,setPeriod]=useState(30);
  const [csvMessage,setCsvMessage]=useState('');
  const view=useMemo(()=>{
    const leads=data.leads.filter(l=>daysPeriod(l.created_at,period));
    const appointments=data.appointments.filter(a=>daysPeriod(a.created_at,period));
    const sales=data.sales.filter(s=>daysPeriod(s.created_at,period));
    const grouped=new Map();
    leads.forEach(l=>{const key=l.source||'Não informada';grouped.set(key,(grouped.get(key)||0)+1)});
    return {leads,appointments,sales,sources:[...grouped.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8),
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
  const most=Math.max(...view.sources.map(x=>x[1]),1);
  return <div className="v4-report-screen">
    <header className="v4-report-header"><div><span className="v4-report-overline">Resultados comerciais</span><h1>Relatórios</h1><p>Analise os resultados reais da operação e exporte registros para acompanhamento.</p></div>
      <div className="v4-report-actions"><div className="nxp-switch">{[7,30,90].map(n=><button type="button" key={n} className={n===period?'active':''} onClick={()=>{setPeriod(n);setCsvMessage('')}}>{n} dias</button>)}</div>
      {!readonly&&<button type="button" onClick={exportReport} className="v4-export"><Download size={16}/> Exportar CSV</button>}</div>
    </header>
    {csvMessage&&<div role="status" className="v4-report-success"><CheckCircle2 size={17}/>{csvMessage}<button type="button" onClick={()=>setCsvMessage('')}>Fechar</button></div>}
    <div className="v4-report-tiles">
      <InfoTile title="Leads captados" value={integer(view.leads.length)} icon={UsersRound} info="Até 250 registros carregados"/>
      <InfoTile title="Agendamentos" value={integer(view.appointments.length)} icon={CalendarDays} info="Criados no período"/>
      <InfoTile title="Vendas" value={integer(view.sales.length)} icon={TrendingUp} info="Vendas registradas"/>
      <InfoTile title="Faturamento" value={currency(view.revenue)} icon={Wallet} info="Soma das vendas registradas"/>
    </div>
    <div className="v4-report-sections">
      <section className="v4-report-panel"><div className="v4-report-panel-title"><div><span className="v4-report-overline">ORIGEM DE LEADS</span><h2>Canais com mais registros</h2></div><Tag>{period} dias</Tag></div>
        <div className="v4-source-list">{view.sources.map(([name,value],i)=><div className="v4-source-row" key={name}><span>{i+1}. {name}</span><strong>{value}</strong><div className="v4-source-track"><span style={{width:Math.max(1,100*value/most)+'%'}}/></div></div>)}
          {!view.sources.length&&<Empty>Os canais serão exibidos quando houver leads no período.</Empty>}</div>
      </section>
      <section className="v4-report-panel"><div className="v4-report-panel-title"><div><span className="v4-report-overline">CONTROLE</span><h2>Resumo operacional</h2></div></div>
        <div className="v4-report-detail"><span>Empresa selecionada</span><strong>{orgName}</strong></div>
        <div className="v4-report-detail"><span>Total de contatos cadastrados</span><strong>{integer(counts.contacts)}</strong></div>
        <div className="v4-report-detail"><span>Total de leads no banco</span><strong>{integer(counts.leads)}</strong></div>
        <div className="v4-report-detail"><span>Total de tarefas no banco</span><strong>{integer(counts.tasks)}</strong></div>
        <div className="v4-report-detail"><span>Total de agendamentos no banco</span><strong>{integer(counts.appointments)}</strong></div>
        <Link href="/leads" className="v4-report-link">Abrir funil de leads <ArrowRight size={16}/></Link>
      </section>
    </div>
    <p className="v4-report-disclaimer">Relatório baseado nos últimos 250 registros carregados por módulo. Para períodos mais longos ou relatórios financeiros completos, será necessária uma consulta paginada no servidor. Nenhum valor foi inventado.</p>
  </div>;
}
export function PremiumSettings({profile,session,role,organization,onTheme,dark}){
  const [message,setMessage]=useState('');
  const organizationName=organization?.name||'Empresa não selecionada';
  return <div className="v4-report-screen">
    <header className="v4-report-header"><div><span className="v4-report-overline">NEXUS / PREFERÊNCIAS</span><h1>Configurações</h1><p>Controle a aparência do seu espaço de trabalho e confira as permissões da sua conta.</p></div></header>
    {message&&<div className="v4-report-success" role="status"><CheckCircle2 size={17}/>{message}<button type="button" onClick={()=>setMessage('')}>Fechar</button></div>}
    <div className="v4-report-sections">
      <section className="v4-report-panel"><div className="v4-report-panel-title"><div><span className="v4-report-overline">PERSONALIZAÇÃO</span><h2>Aparência da plataforma</h2></div><Tag>Salvo neste navegador</Tag></div>
      <p className="v4-settings-description">Escolha entre o tema claro do Glassy V4 e sua versão noturna. Sua preferência permanece salva neste navegador.</p>
      <div className="v4-theme-buttons">
        <button type="button" className={!dark?'selected':''} onClick={()=>{if(dark)onTheme();setMessage('Tema claro selecionado.')}}><Sun size={19}/><span><strong>Modo claro</strong><small>Branco, azul-gelo e transparências</small></span>{!dark&&<CheckCircle2 size={17}/>}</button>
        <button type="button" className={dark?'selected':''} onClick={()=>{if(!dark)onTheme();setMessage('Tema escuro selecionado.')}}><Moon size={19}/><span><strong>Modo escuro</strong><small>Azul-marinho e teal</small></span>{dark&&<CheckCircle2 size={17}/>}</button>
      </div>
      </section>
      <section className="v4-report-panel"><div className="v4-report-panel-title"><div><span className="v4-report-overline">CONTROLE DE ACESSO</span><h2>Conta e permissões</h2></div><ShieldCheck size={19}/></div>
        <div className="v4-report-detail"><span>Nome</span><strong>{profile?.full_name||'Não informado'}</strong></div>
        <div className="v4-report-detail"><span>E-mail</span><strong>{session?.email||'—'}</strong></div>
        <div className="v4-report-detail"><span>Empresa</span><strong>{organizationName}</strong></div>
        <div className="v4-report-detail"><span>Perfil</span><strong>{role||'Membro'}</strong></div>
        <div className="v4-report-note"><LockKeyhole size={18}/><span>Permissões e informações de cadastro são administradas pelo Super Admin. A alteração de senha usa o fluxo de recuperação do login.</span></div>
        <Link href="/minha-area" className="v4-report-link">Ver meu perfil <ArrowRight size={16}/></Link>
      </section>
    </div>
  </div>;
}
