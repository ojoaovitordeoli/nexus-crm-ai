'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  ArrowDownUp,ArrowRight,ArrowUpRight,CalendarPlus,Check,ChevronDown,
  ChevronLeft,ChevronRight,Clock3,Download,Filter,Layers3,
  MessageCircle,MoreHorizontal,PanelRightClose,Search,Settings2,ShieldCheck,
  UserRound,Users,X
} from 'lucide-react';
import {exportFilteredLeads} from '../lib/exportFilteredLeads';

const nameOf=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim()||'Contato sem nome';
const simplify=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const fmt=v=>new Intl.NumberFormat('pt-BR').format(Number(v)||0);
const date=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'Não informado';
const since=v=>v&&!Number.isNaN(Date.parse(v))?new Intl.RelativeTimeFormat('pt-BR',{numeric:'auto'}).format(Math.round((new Date(v).getTime()-Date.now())/86400000),'day'):'Sem data';
const label=s=>({new:'Novo',open:'Aberto',pending:'Pendente',won:'Ganho',lost:'Perdido',qualified:'Qualificado',hot:'Quente',warm:'Morno',cold:'Frio'})[String(s||'').toLowerCase()]||String(s||'Não informado').replaceAll('_',' ');
const validPhone=phone=>{
  const digits=String(phone||'').replace(/\D/g,'');
  return digits.length>=10&&digits.length<=13?'https://wa.me/'+(digits.length<=11?'55'+digits:digits):'';
};
const sortFn=(a,b,order)=>order==='name'?nameOf(a.contact).localeCompare(nameOf(b.contact),'pt-BR'):
  order==='oldest'?new Date(a.created_at||0)-new Date(b.created_at||0):
  new Date(b.created_at||0)-new Date(a.created_at||0);
function Avatar({person,large=false}){
  const initials=person.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();
  return <span className={'nx13-avatar'+(large?' nx13-avatar-large':'')} aria-hidden="true">{initials||'?'}</span>;
}
function Detail({lead,stages,readonly,busy,onStageChange,onOperation,onReload,onClose}) {
  const person=nameOf(lead.contact),phone=lead.contact?.whatsapp||'',whatsapp=validPhone(phone);
  const [tab,setTab]=useState('detalhes'),[note,setNote]=useState(''),[due,setDue]=useState(''),[priority,setPriority]=useState('medium');
  const [saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const selectedStage=stages.find(s=>s.id===lead.pipeline_stage_id);
  useEffect(()=>{setTab('detalhes');setNote('');setDue('');setPriority('medium');setMessage('');setError('')},[lead.id]);
  async function createFollowup(e){
    e.preventDefault();
    if(saving||readonly||!onOperation||!note.trim())return;
    setSaving(true);setError('');setMessage('');
    try{
      const res=await onOperation({action:'task_create',title:(note.trim()+' — '+person).slice(0,190),priority,due_date:due||null});
      await onReload?.();
      setMessage(res?.message||'Tarefa criada.');setNote('');setDue('');setPriority('medium');
    }catch(err){setError(err.message||'Falha ao criar tarefa.')}finally{setSaving(false)}
  }
  return <section className="nx13-detail" id="nx13-detail" aria-label={'Ficha de '+person}>
    <div className="nx13-detail-breadcrumb"><span>Registro do CRM</span><button type="button" onClick={onClose} title="Fechar ficha" aria-label="Fechar ficha"><PanelRightClose size={18}/></button></div>
    <div className="nx13-person">
      <Avatar person={person} large/>
      <div><span className="nx13-overline">CONTATO</span><h2>{person}</h2><p>{phone||'Telefone não informado'}</p></div>
    </div>
    <div className="nx13-actionbar">
      {whatsapp?<a href={whatsapp} target="_blank" rel="noopener noreferrer" className="nx13-action-primary"><MessageCircle size={17}/> WhatsApp <ArrowUpRight size={14}/></a>:
        <span className="nx13-action-disabled">WhatsApp indisponível</span>}
      <button type="button" onClick={()=>setTab('retorno')} className="nx13-action-muted"><CalendarPlus size={17}/> Criar retorno</button>
    </div>
    <div className="nx13-detail-tabs" role="tablist" aria-label="Informações do contato">
      {[['detalhes','Informações'],['retorno','Retorno'],['atividade','Atividade']].map(([id,l])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'is-active':''} type="button" onClick={()=>setTab(id)}>{l}</button>)}
    </div>
    <div className="nx13-detail-body">
      {message&&<div role="status" className="nx13-feedback success"><Check size={16}/>{message}</div>}
      {error&&<div role="alert" className="nx13-feedback error">{error}</div>}
      {tab==='detalhes'&&<div role="tabpanel">
        <div className="nx13-detail-group">
          <h3>Negócio</h3>
          <label htmlFor="nx13-stage" className="nx13-field-label">Etapa do funil</label>
          <div className="nx13-stage-select">
            <select id="nx13-stage" value={lead.pipeline_stage_id||''} disabled={readonly||busy||!stages.length} onChange={e=>onStageChange(lead,e.target.value)}>
              {!lead.pipeline_stage_id&&<option value="">Sem etapa definida</option>}
              {stages.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
            </select><ChevronDown size={16}/>
          </div>
          {!stages.length&&<p className="nx13-muted">Configure um funil para mover este registro entre etapas.</p>}
          {[
            ['Origem',lead.source||'Não informada'],['Temperatura',label(lead.temperature)],
            ['Status',label(lead.status)],['Cadastro',date(lead.created_at)]
          ].map(([k,v])=><div className="nx13-keyval" key={k}><span>{k}</span><strong>{v}</strong></div>)}
        </div>
        <div className="nx13-detail-group">
          <h3>Contato</h3>
          <div className="nx13-keyval"><span>Nome</span><strong>{person}</strong></div>
          <div className="nx13-keyval"><span>WhatsApp</span><strong>{phone||'Não informado'}</strong></div>
          <div className="nx13-keyval"><span>Empresa</span><strong>Empresa selecionada</strong></div>
        </div>
      </div>}
      {tab==='retorno'&&<div role="tabpanel" className="nx13-followup">
        <h3>Novo retorno</h3><p>Crie uma tarefa para a equipe acompanhar este contato.</p>
        <form onSubmit={createFollowup}>
          <label>O que precisa ser feito?<textarea rows={3} value={note} required maxLength={150} onChange={e=>setNote(e.target.value)} placeholder={'Ex.: Confirmar proposta com '+person}/></label>
          <div className="nx13-fieldgrid">
            <label>Data<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
            <label>Prioridade<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Baixa</option><option value="medium">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
          </div>
          <button type="submit" disabled={readonly||saving||!note.trim()} className="nx13-submit">{saving?'Salvando...':'Adicionar tarefa'} <ArrowRight size={16}/></button>
        </form>
        <p className="nx13-disclosure">A tarefa é salva na empresa atual. O nome do contato é incluído no título; a vinculação direta entre registros ainda não está disponível.</p>
      </div>}
      {tab==='atividade'&&<div role="tabpanel" className="nx13-eventlog">
        <h3>Informações registradas</h3>
        <div className="nx13-event"><span/><div><strong>Etapa atual</strong><small>{selectedStage?.name||label(lead.status)}</small></div></div>
        <div className="nx13-event"><span/><div><strong>Contato cadastrado</strong><small>{date(lead.created_at)}</small></div></div>
        <p>Eventos de atendimento, mensagens e mudanças anteriores não são exibidos sem um histórico persistente verificado.</p>
      </div>}
    </div>
    <div className="nx13-detail-foot"><ShieldCheck size={15}/> Dados da empresa selecionada</div>
  </section>;
}
export default function NexusOpportunityDesk({
 leads=[],count=0,organizationName,readonly=false,stages=[],onOperation,onReload,onShowBoard,onConfigure
}){
  const [search,setSearch]=useState(''),[stageFilter,setStageFilter]=useState('all'),[presence,setPresence]=useState('all'),[order,setOrder]=useState('recent');
  const [selectedId,setSelectedId]=useState(null),[closed,setClosed]=useState(false),[busy,setBusy]=useState(''),[problem,setProblem]=useState(''),[notice,setNotice]=useState('');
  const [localStages,setLocalStages]=useState({});
  const listRef=useRef(null);
  useEffect(()=>{const query=new URLSearchParams(window.location.search).get('q');if(query)setSearch(query)},[]);
  const staged=useMemo(()=>leads.map(l=>({...l,pipeline_stage_id:localStages[l.id]||l.pipeline_stage_id})),[leads,localStages]);
  const stageOf=lead=>stages.find(s=>s.id===lead.pipeline_stage_id)?.name||label(lead.status);
  const filtered=useMemo(()=>staged.filter(l=>{
    const term=simplify([nameOf(l.contact),l.contact?.whatsapp,l.source,stageOf(l)].join(' '));
    return (!search||term.includes(simplify(search)))&&
      (stageFilter==='all'||(stageFilter==='none'?!l.pipeline_stage_id:l.pipeline_stage_id===stageFilter))&&
      (presence==='all'||(presence==='yes'?Boolean(validPhone(l.contact?.whatsapp)):!validPhone(l.contact?.whatsapp)));
  }).sort((a,b)=>sortFn(a,b,order)),[staged,search,stageFilter,presence,order,stages]);
  const selected=filtered.find(l=>l.id===selectedId)||filtered[0]||null;
  const changeStage=async (lead,next)=>{
    if(!next||!onOperation||readonly||busy||lead.pipeline_stage_id===next)return;
    setProblem('');setNotice('');setBusy(lead.id);
    setLocalStages(p=>({...p,[lead.id]:next}));
    try{const result=await onOperation({action:'lead_stage',id:lead.id,stage_id:next});await onReload?.();setNotice(result?.message||'Etapa atualizada.')}
    catch(e){setLocalStages(p=>({...p,[lead.id]:lead.pipeline_stage_id}));setProblem(e.message||'Não foi possível mover o lead.')}
    finally{setBusy('')}
  };
  const exportList=()=>{exportFilteredLeads(filtered,stageOf,organizationName);setNotice('CSV dos registros carregados e filtrados gerado.')};
  const select=id=>{setSelectedId(id);setClosed(false);
    if(window.matchMedia('(max-width: 880px)').matches)window.requestAnimationFrame(()=>document.getElementById('nx13-detail')?.scrollIntoView({behavior:'smooth',block:'start'}));
  };
  const onKeys=event=>{
    if(!['ArrowDown','ArrowUp'].includes(event.key)||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;
    if(!filtered.length)return;
    event.preventDefault();
    const idx=filtered.findIndex(l=>l.id===selected?.id);
    const to=Math.max(0,Math.min(filtered.length-1,idx+(event.key==='ArrowDown'?1:-1)));
    setSelectedId(filtered[to].id);setClosed(false);
    listRef.current?.querySelectorAll('[data-lead-row]')?.[to]?.focus();
  };
  const total=Number(count||0),partial=total>leads.length;
  return <div className="nx13-workspace">
    <header className="nx13-header">
      <div className="nx13-header-title"><div className="nx13-crumb">CRM <ChevronRight size={13}/> {organizationName||'Empresa'} <ChevronRight size={13}/> Leads</div>
        <div className="nx13-titleline"><h1>Leads</h1><span className="nx13-count">{fmt(total)}</span></div><p>Contatos, oportunidades e próximos passos em uma só tela.</p>
      </div>
      <div className="nx13-header-actions">
        <button type="button" onClick={exportList} disabled={!filtered.length} className="nx13-softbutton"><Download size={16}/> Exportar</button>
        {!readonly&&<button type="button" onClick={onConfigure} className="nx13-softbutton"><Settings2 size={16}/> Configurar funil</button>}
      </div>
    </header>
    <div className="nx13-layout">
      <section className="nx13-collection" aria-label="Lista de leads">
        <div className="nx13-toolbar">
          <div className="nx13-viewline"><span className="nx13-view-label">Oportunidades</span><span className="nx13-count-small">{fmt(filtered.length)} exibidos</span>
            <button type="button" className="nx13-viewbutton" onClick={onShowBoard}><Layers3 size={16}/> Quadro <ArrowUpRight size={13}/></button></div>
          <label className="nx13-search"><Search size={17}/><input type="search" aria-label="Pesquisar leads" placeholder="Buscar contato, telefone ou origem" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Limpar busca" onClick={()=>setSearch('')}><X size={14}/></button>}</label>
          <div className="nx13-filterline">
            <label><Filter size={14}/><select aria-label="Filtrar por etapa" value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="all">Todas as etapas</option><option value="none">Sem etapa</option>{stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={13}/></label>
            <label><select value={presence} aria-label="Filtrar por WhatsApp" onChange={e=>setPresence(e.target.value)}><option value="all">Todos os contatos</option><option value="yes">Com WhatsApp</option><option value="no">Sem WhatsApp</option></select><ChevronDown size={13}/></label>
            <label className="nx13-sort"><ArrowDownUp size={14}/><select aria-label="Ordenar leads" value={order} onChange={e=>setOrder(e.target.value)}><option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option><option value="name">Nome A–Z</option></select></label>
          </div>
        </div>
        {problem&&<div role="alert" className="nx13-list-feedback error">{problem}</div>}
        {notice&&<div role="status" className="nx13-list-feedback success"><Check size={14}/>{notice}<button type="button" aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={14}/></button></div>}
        <div className="nx13-list" ref={listRef} onKeyDown={onKeys}>
          {filtered.length?filtered.map(lead=>{
            const person=nameOf(lead.contact),active=lead.id===selected?.id&&!closed,phone=Boolean(validPhone(lead.contact?.whatsapp));
            return <button key={lead.id} type="button" data-lead-row="true" aria-current={active?'true':undefined}
                className={'nx13-listrow'+(active?' is-selected':'')} onClick={()=>select(lead.id)}>
              <Avatar person={person}/>
              <span className="nx13-listrow-info"><strong>{person}</strong><small>{lead.source||'Origem não informada'} <span className="nx13-dot">·</span> {since(lead.created_at)}</small></span>
              <span className="nx13-listrow-meta"><span className={'nx13-pip'+(!lead.pipeline_stage_id?' nx13-pip-empty':'')}>{stageOf(lead)}</span>{phone&&<MessageCircle size={13}/>}</span>
              <ChevronRight size={16} className="nx13-listrow-chevron"/>
            </button>;
          }):<div className="nx13-empty"><Users size={24}/><strong>Nenhum lead encontrado</strong><p>Altere a busca ou os filtros.</p><button type="button" onClick={()=>{setSearch('');setStageFilter('all');setPresence('all')}}>Limpar filtros</button></div>}
        </div>
        <footer className="nx13-collection-foot">{partial?'Até 250 registros recentes carregados.':'Registros carregados na empresa.'} {readonly?'Acesso somente leitura.':'Selecione um contato para atender.'}</footer>
      </section>
      {selected&&!closed?<Detail key={selected.id} lead={selected} stages={stages} readonly={readonly} busy={Boolean(busy)} onStageChange={changeStage} onOperation={onOperation} onReload={onReload} onClose={()=>setClosed(true)}/>:
        <div className="nx13-nodetail"><div><UserRound size={27}/><h2>{filtered.length?'Ficha recolhida':'Sem registros'}</h2><p>{filtered.length?'Selecione um contato para abrir a ficha.':'Os próximos leads aparecerão nesta lista.'}</p></div></div>}
    </div>
  </div>;
}
