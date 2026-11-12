'use client';

import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  ArrowDownUp,CalendarPlus,Check,ChevronDown,
  ChevronLeft,ChevronRight,Clock3,Download,Filter,Layers3,
  MessageCircle,MoreHorizontal,PanelRightClose,Search,Settings2,ShieldCheck,
  UserRound,Users,X
} from 'lucide-react';
import {exportFilteredLeads} from '../lib/exportFilteredLeads';
import {codeLabel,matchesSearch,whatsappUrl} from '../lib/lead-view.mjs';
import {formatPhoneBR} from '../lib/format.mjs';

const nameOf=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim()||'Contato sem nome';
const fmt=v=>new Intl.NumberFormat('pt-BR').format(Number(v)||0);
const date=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'}):'Não informado';
const dateTime=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'Sem data';
// Diferença em dias de calendário no fuso do navegador: lead de ontem às 22h é "ontem", não "hoje".
const dayStart=d=>new Date(d.getFullYear(),d.getMonth(),d.getDate()).getTime();
const since=v=>{
  if(!v||Number.isNaN(Date.parse(v)))return 'Sem data';
  const days=Math.round((dayStart(new Date(v))-dayStart(new Date()))/86400000);
  return days<-6?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.',''):new Intl.RelativeTimeFormat('pt-BR',{numeric:'auto'}).format(days,'day');
};
const label=s=>codeLabel(s);
const validPhone=whatsappUrl;
// Data inválida vira 0 para não gerar NaN no comparador (ordenação instável).
const ts=v=>{const t=Date.parse(v||'');return Number.isFinite(t)?t:0};
const sortFn=(a,b,order)=>order==='name'?nameOf(a.contact).localeCompare(nameOf(b.contact),'pt-BR',{sensitivity:'base'}):
  order==='oldest'?ts(a.created_at)-ts(b.created_at):ts(b.created_at)-ts(a.created_at);
function Avatar({person,large=false}){
  const initials=person.trim().split(/\s+/).slice(0,2).map(part=>part[0]||'').join('').toUpperCase();
  return <span className={'nx13-avatar'+(large?' nx13-avatar-large':'')} aria-hidden="true">{initials||'?'}</span>;
}
function Detail({lead,stages,transferTargets=[],organizationName,readonly,busy,onStageChange,onOperation,onReload,onClose}) {
  const person=nameOf(lead.contact),phone=lead.contact?.whatsapp||'',whatsapp=validPhone(phone);
  const [tab,setTab]=useState('detalhes'),[note,setNote]=useState(''),[due,setDue]=useState(''),[priority,setPriority]=useState('medium');
  const [saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [timeline,setTimeline]=useState({status:'idle',events:[],warnings:[],truncated:false});
  useEffect(()=>{setTab('detalhes');setNote('');setDue('');setPriority('medium');setMessage('');setError('');setTimeline({status:'idle',events:[],warnings:[],truncated:false})},[lead.id]);
  const loadTimeline=useCallback(async()=>{
    if(!onOperation)return;
    setTimeline(t=>({...t,status:'loading'}));
    try{
      const res=await onOperation({action:'lead_timeline',lead_id:lead.id});
      setTimeline({status:'ready',events:res?.events||[],warnings:res?.warnings||[],truncated:Boolean(res?.truncated)});
    }catch(err){setTimeline({status:'error',events:[],warnings:[err.message||'Falha ao carregar o histórico.'],truncated:false})}
  },[lead.id,onOperation]);
  useEffect(()=>{if(tab==='atividade'&&timeline.status==='idle')loadTimeline()},[tab,timeline.status,loadTimeline]);
  async function createFollowup(e){
    e.preventDefault();
    if(saving||readonly||!onOperation||!note.trim())return;
    setSaving(true);setError('');setMessage('');
    try{
      const res=await onOperation({action:'task_create',lead_id:lead.id,title:(note.trim()+' — '+person).slice(0,190),priority,due_date:due||null});
      await onReload?.();
      setTimeline(t=>({...t,status:'idle'}));
      setMessage(res?.message||'Tarefa criada.');setNote('');setDue('');setPriority('medium');
    }catch(err){setError(err.message||'Falha ao criar tarefa.')}finally{setSaving(false)}
  }
  return <section className="nx13-detail" id="nx13-detail" aria-label={'Ficha de '+person}>
    <div className="nx13-detail-breadcrumb"><button type="button" onClick={onClose} title="Fechar ficha" aria-label="Fechar ficha"><PanelRightClose size={18}/></button></div>
    <div className="nx13-person">
      <Avatar person={person} large/>
      <div><h2>{person}</h2><p>{formatPhoneBR(phone)||'Telefone não informado'}</p></div>
    </div>
    <div className="nx13-actionbar">
      {whatsapp?<a href={whatsapp} target="_blank" rel="noopener noreferrer" className="nx13-action-primary"><MessageCircle size={17}/> WhatsApp</a>:
        <span className="nx13-action-disabled">WhatsApp indisponível</span>}
      {!readonly&&<button type="button" onClick={()=>setTab('retorno')} className="nx13-action-muted"><CalendarPlus size={17}/> Criar retorno</button>}
    </div>
    <div className="nx13-detail-tabs" role="tablist" aria-label="Informações do contato">
      {[['detalhes','Informações'],...(readonly?[]:[['retorno','Retorno']]),['atividade','Atividade']].map(([id,l])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'is-active':''} type="button" onClick={()=>setTab(id)}>{l}</button>)}
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
              {!stages.some(s=>s.id===lead.pipeline_stage_id)&&<option value={lead.pipeline_stage_id||''}>{lead.pipeline_stage_id?'Etapa fora deste funil':'Sem etapa definida'}</option>}
              {stages.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
            </select><ChevronDown size={16}/>
          </div>
          {!stages.length&&<p className="nx13-muted">Configure um funil para mover este registro entre etapas.</p>}
          {!readonly&&transferTargets.length>0&&<>
            <label htmlFor="nx13-transfer" className="nx13-field-label" style={{marginTop:12}}>Transferir de funil</label>
            <div className="nx13-stage-select">
              <select id="nx13-transfer" value="" disabled={busy} onChange={e=>{if(e.target.value)onStageChange(lead,e.target.value,{transfer:true})}}>
                <option value="">Escolha o funil e a etapa…</option>
                {transferTargets.map(t=><optgroup key={t.pipeline.id} label={t.pipeline.name}>
                  {t.stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </optgroup>)}
              </select><ChevronDown size={16}/>
            </div>
          </>}
          {[
            ...(Number(lead.estimated_value)>0?[['Valor estimado',new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(lead.estimated_value))]]:[]),
            ['Origem',lead.source||'Não informada'],['Temperatura',label(lead.temperature)],
            ['Status',label(lead.status)],['Cadastro',date(lead.created_at)]
          ].map(([k,v])=><div className="nx13-keyval" key={k}><span>{k}</span><strong>{v}</strong></div>)}
        </div>
        <div className="nx13-detail-group">
          <h3>Contato</h3>
          <div className="nx13-keyval"><span>Nome</span><strong>{person}</strong></div>
          <div className="nx13-keyval"><span>WhatsApp</span><strong>{formatPhoneBR(phone)||'Não informado'}</strong></div>
          <div className="nx13-keyval"><span>Empresa</span><strong>{organizationName||"Não informada"}</strong></div>
        </div>
      </div>}
      {tab==='retorno'&&!readonly&&<div role="tabpanel" className="nx13-followup">
        <h3>Novo retorno</h3><p>Crie uma tarefa para a equipe acompanhar este contato.</p>
        <form onSubmit={createFollowup}>
          <label>O que precisa ser feito?<textarea rows={3} value={note} required maxLength={150} onChange={e=>setNote(e.target.value)} placeholder={'Ex.: Confirmar proposta com '+person}/></label>
          <div className="nx13-fieldgrid">
            <label>Data<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
            <label>Prioridade<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Baixa</option><option value="medium">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
          </div>
          <button type="submit" disabled={readonly||saving||!note.trim()} className="nx13-submit">{saving?'Salvando...':'Adicionar tarefa'}</button>
        </form>
        <p className="nx13-disclosure">A tarefa fica vinculada a este lead e aparece na aba Atividade. O nome do contato também vai no título para facilitar a leitura na lista de tarefas.</p>
      </div>}
      {tab==='atividade'&&<div role="tabpanel" className="nx13-eventlog" aria-busy={timeline.status==='loading'}>
        <h3>Histórico do lead</h3>
        {timeline.status==='loading'&&<p>Carregando registros vinculados…</p>}
        {timeline.status==='error'&&<div role="alert" className="nx13-feedback error">{timeline.warnings[0]} <button type="button" className="nx13-inline-retry" onClick={loadTimeline}>Tentar novamente</button></div>}
        {timeline.status==='ready'&&<>
          {timeline.events.map(ev=><div className={'nx13-event nx13-event--'+ev.kind} key={ev.id}><span/><div><strong>{ev.title}</strong><small>{dateTime(ev.at)}{ev.detail?' · '+ev.detail:''}</small></div></div>)}
          {!timeline.events.length&&<p>Nenhum registro vinculado ainda.</p>}
          {timeline.warnings.length>0&&<p role="status">Parte do histórico não pôde ser carregada: {timeline.warnings.join(' · ')}</p>}
          {timeline.truncated&&<p>Exibindo os 100 registros mais recentes de cada tipo.</p>}
          <p>Inclui mudanças de etapa, retornos, agendamentos, vendas e notas vinculados a este lead. Mensagens de WhatsApp ainda não entram neste histórico.</p>
        </>}
      </div>}
    </div>
    <div className="nx13-detail-foot"><ShieldCheck size={15}/> Dados da empresa selecionada</div>
  </section>;
}
export default function NexusOpportunityDesk({
 leads=[],count=0,organizationName,readonly=false,stages=[],onOperation,onReload,onShowBoard,onConfigure,
 onRequestStage,pipelines=[],allStages=[],pipelineBar=null,contacts=[],pipelineId='',startCreating=false
}){
  const [search,setSearch]=useState(''),[stageFilter,setStageFilter]=useState('all'),[presence,setPresence]=useState('all'),[order,setOrder]=useState('recent');
  const [selectedId,setSelectedId]=useState(null),[closed,setClosed]=useState(false),[busy,setBusy]=useState(''),[problem,setProblem]=useState(''),[notice,setNotice]=useState('');
  const [localStages,setLocalStages]=useState({});
  const listRef=useRef(null);
  const [creating,setCreating]=useState(Boolean(startCreating)),[newContactId,setNewContactId]=useState(''),[newSource,setNewSource]=useState(''),[creatingBusy,setCreatingBusy]=useState(false);
  // Contato já com atendimento aberto neste funil não aparece: a API recusaria o duplicado.
  const openByContact=useMemo(()=>new Set(leads.map(l=>l.contact?.id||l.contact_id).filter(Boolean)),[leads]);
  const availableContacts=useMemo(()=>contacts.filter(c=>!openByContact.has(c.id)),[contacts,openByContact]);
  const createLead=async e=>{
    e.preventDefault();
    if(readonly||creatingBusy||!onOperation||!newContactId)return;
    setCreatingBusy(true);setProblem('');setNotice('');
    try{
      const payload={action:'lead_create',contact_id:newContactId};
      if(pipelineId)payload.pipeline_id=pipelineId;
      if(newSource.trim())payload.source=newSource.trim().slice(0,120);
      const result=await onOperation(payload);
      setCreating(false);setNewContactId('');setNewSource('');
      setNotice(result?.message||'Lead criado.');
      await onReload?.();
    }catch(err){setProblem(err.message||'Não foi possível criar o lead.')}
    finally{setCreatingBusy(false)}
  };
  useEffect(()=>{const query=new URLSearchParams(window.location.search).get('q');if(query)setSearch(query)},[]);
  const staged=useMemo(()=>leads.map(l=>({...l,pipeline_stage_id:localStages[l.id]||l.pipeline_stage_id})),[leads,localStages]);
  // Etapa apagada ou de outro funil conta como "Sem etapa" neste funil.
  const knownStage=lead=>stages.find(s=>s.id===lead.pipeline_stage_id);
  const stageOf=lead=>knownStage(lead)?.name||(stages.length?'Sem etapa':codeLabel(lead.status,'Sem etapa'));
  // Ao trocar de funil, um filtro de etapa do funil anterior deixaria a lista vazia.
  const activeStageFilter=stageFilter==='all'||stageFilter==='none'||stages.some(s=>s.id===stageFilter)?stageFilter:'all';
  const filtered=useMemo(()=>staged.filter(l=>{
    return matchesSearch(search,[nameOf(l.contact),l.source,stageOf(l)],[l.contact?.whatsapp])&&
      (activeStageFilter==='all'||(activeStageFilter==='none'?!knownStage(l):l.pipeline_stage_id===activeStageFilter))&&
      (presence==='all'||(presence==='yes'?Boolean(validPhone(l.contact?.whatsapp)):!validPhone(l.contact?.whatsapp)));
  }).sort((a,b)=>sortFn(a,b,order)),[staged,search,activeStageFilter,presence,order,stages]);
  const selected=filtered.find(l=>l.id===selectedId)||filtered[0]||null;
  const changeStage=async (lead,next,opts={})=>{
    if(!next||!onOperation||readonly||busy||lead.pipeline_stage_id===next)return;
    setProblem('');setNotice('');setBusy(lead.id);
    const revert=()=>setLocalStages(p=>{const c={...p};delete c[lead.id];return c});
    if(!opts.transfer)setLocalStages(p=>({...p,[lead.id]:next}));
    try{
      // Com onRequestStage, a mudança passa pelos campos obrigatórios da etapa (null = cancelado).
      const result=onRequestStage?await onRequestStage(lead,next,opts):await onOperation({action:'lead_stage',id:lead.id,stage_id:next});
      if(!result){revert();return}
      await onReload?.();revert();setNotice(result?.message||'Etapa atualizada.');
    }
    catch(e){revert();setProblem(e.message||'Não foi possível mover o lead.')}
    finally{setBusy('')}
  };
  const transferTargets=useMemo(()=>pipelines.filter(p=>!stages.some(s=>s.pipeline_id===p.id)).map(p=>({
    pipeline:p,stages:allStages.filter(s=>s.pipeline_id===p.id)
  })).filter(x=>x.stages.length),[pipelines,allStages,stages]);
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
      <div className="nx13-header-title">
        <div className="nx13-titleline"><h1>Leads</h1><span className="nx13-count">{fmt(total)}</span></div>
      </div>
      <div className="nx13-header-actions">
        <button type="button" onClick={exportList} disabled={!filtered.length} className="nx13-softbutton"><Download size={16}/> Exportar</button>
        {!readonly&&onConfigure&&<button type="button" onClick={onConfigure} className="nx13-softbutton"><Settings2 size={16}/> Configurar funil</button>}
        {!readonly&&<button type="button" className="fx-btn fx-btn--primary" aria-expanded={creating} onClick={()=>{setCreating(v=>!v);setProblem('')}}>{creating?<><X size={16}/> Fechar</>:<><UserRound size={16}/> Novo lead</>}</button>}
      </div>
    </header>
    {pipelineBar}
    {!readonly&&creating&&<form className="fx-panel" onSubmit={createLead} aria-label="Novo lead">
      <label className="fx-panel-grow">Contato
        <select required value={newContactId} onChange={e=>setNewContactId(e.target.value)} aria-label="Contato do lead">
          <option value="">Selecione o contato...</option>
          {availableContacts.map(c=><option key={c.id} value={c.id}>{nameOf(c)}{c.whatsapp?' · '+formatPhoneBR(c.whatsapp):''}</option>)}
        </select>
      </label>
      <label>Origem (opcional)<input maxLength={120} placeholder="Instagram, indicação..." value={newSource} onChange={e=>setNewSource(e.target.value)} aria-label="Origem do lead"/></label>
      <button type="submit" className="fx-btn fx-btn--primary" disabled={creatingBusy||!newContactId}>{creatingBusy?'Criando...':'Criar lead'}</button>
      {!availableContacts.length&&<span className="fx-form-hint">{contacts.length?'Todos os contatos carregados já têm atendimento aberto neste funil.':'Cadastre um contato na tela Contatos para criar o lead.'}</span>}
    </form>}
    <div className="nx13-layout">
      <section className="nx13-collection" aria-label="Lista de leads">
        <div className="nx13-toolbar">
          <div className="nx13-viewline"><span className="nx13-count-small">{fmt(filtered.length)} {filtered.length===1?'exibido':'exibidos'}</span>
            <button type="button" className="nx13-viewbutton" onClick={onShowBoard}><Layers3 size={16}/> Quadro</button></div>
          <label className="nx13-search"><Search size={17}/><input type="search" aria-label="Pesquisar leads" placeholder="Buscar contato, telefone ou origem" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Limpar busca" onClick={()=>setSearch('')}><X size={14}/></button>}</label>
          <div className="nx13-filterline">
            <label><Filter size={14}/><select aria-label="Filtrar por etapa" value={activeStageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="all">Todas as etapas</option><option value="none">Sem etapa</option>{stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={13}/></label>
            <label><select value={presence} aria-label="Filtrar por WhatsApp" onChange={e=>setPresence(e.target.value)}><option value="all">Todos os contatos</option><option value="yes">Com WhatsApp</option><option value="no">Sem WhatsApp</option></select><ChevronDown size={13}/></label>
            <label className="nx13-sort"><ArrowDownUp size={14}/><select aria-label="Ordenar leads" value={order} onChange={e=>setOrder(e.target.value)}><option value="recent">Mais recentes</option><option value="oldest">Mais antigos</option><option value="name">Nome A–Z</option></select></label>
          </div>
        </div>
        {problem&&<div role="alert" className="nx13-list-feedback error">{problem}</div>}
        {notice&&<div role="status" className="nx13-list-feedback success"><Check size={14}/>{notice}<button type="button" aria-label="Fechar aviso" onClick={()=>setNotice('')}><X size={14}/></button></div>}
        {filtered.length>0&&<div className="nx13-colhead" aria-hidden="true"><span>Nome</span><span>Etapa</span><span>Origem</span><span>Cadastro</span></div>}
        <div className="nx13-list" ref={listRef} onKeyDown={onKeys}>
          {filtered.length?filtered.map(lead=>{
            const person=nameOf(lead.contact),active=lead.id===selected?.id&&!closed,phone=Boolean(validPhone(lead.contact?.whatsapp));
            return <button key={lead.id} type="button" data-lead-row="true" aria-current={active?'true':undefined}
                className={'nx13-listrow'+(active?' is-selected':'')} onClick={()=>select(lead.id)}>
              <Avatar person={person}/>
              <span className="nx13-listrow-info"><strong>{person}</strong><small>{formatPhoneBR(lead.contact?.whatsapp)||'Sem telefone'}{phone&&<MessageCircle size={12} aria-hidden="true"/>}</small></span>
              <span className="nx13-listrow-meta"><span className={'nx13-pip'+(!knownStage(lead)?' nx13-pip-empty':'')}>{stageOf(lead)}</span></span>
              <span className="nx13-col-source">{lead.source||'—'}</span>
              <span className="nx13-col-date">{since(lead.created_at)}</span>
              <ChevronRight size={16} className="nx13-listrow-chevron"/>
            </button>;
          }):<div className="nx13-empty"><Users size={24}/><strong>Nenhum lead encontrado</strong><p>Altere a busca ou os filtros.</p><button type="button" onClick={()=>{setSearch('');setStageFilter('all');setPresence('all')}}>Limpar filtros</button></div>}
        </div>
        {(partial||readonly)&&<footer className="nx13-collection-foot">{partial?'Mostrando os 250 leads mais recentes.':''}{partial&&readonly?' ':''}{readonly?'Acesso somente leitura.':''}</footer>}
      </section>
      {selected&&!closed?<Detail key={selected.id} lead={selected} organizationName={organizationName} stages={stages} transferTargets={transferTargets} readonly={readonly} busy={Boolean(busy)} onStageChange={changeStage} onOperation={onOperation} onReload={onReload} onClose={()=>setClosed(true)}/>:
        <div className="nx13-nodetail"><div><UserRound size={27}/><h2>{filtered.length?'Ficha recolhida':'Sem registros'}</h2><p>{filtered.length?'Selecione um contato para abrir a ficha.':'Os próximos leads aparecerão nesta lista.'}</p></div></div>}
    </div>
  </div>;
}
