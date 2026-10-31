'use client';

import {useEffect,useRef,useState} from 'react';
import {
  ArrowRight,CalendarPlus,Check,ChevronDown,Clock3,ExternalLink,
  Mail,MessageCircle,Phone,ShieldCheck,UserRound,X
} from 'lucide-react';

const formatDate=v=>v&&!Number.isNaN(Date.parse(v))?new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}):'Não informado';
const label=v=>{
  const mapped={new:'Novo',open:'Aberto',pending:'Pendente',qualified:'Qualificado',contacted:'Contatado',
    won:'Ganho',lost:'Perdido',warm:'Morno',hot:'Quente',cold:'Frio'};
  return mapped[String(v||'').toLowerCase()]||String(v||'Não informado').replaceAll('_',' ');
};
const fullName=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim()||'Contato sem nome';
const phoneLink=value=>{
  const digits=String(value||'').replace(/\D/g,'');
  if(digits.length<10||digits.length>13)return '';
  return 'https://wa.me/'+(digits.length<=11?'55'+digits:digits);
};
function SummaryRow({title,value}){
  return <div className="v11-detail-row"><span>{title}</span><strong>{value||'Não informado'}</strong></div>;
}
export default function NexusLeadDetail({lead,stages=[],readonly=false,pending=false,onStageChange,onOperation,onReload,onClose}){
  const root=useRef(null);
  const opener=useRef(null);
  const closeRef=useRef(onClose);
  closeRef.current=onClose;
  const [tab,setTab]=useState('resumo');
  const [due,setDue]=useState('');
  const [priority,setPriority]=useState('medium');
  const [taskTitle,setTaskTitle]=useState('Retornar para '+fullName(lead?.contact));
  const [submitting,setSubmitting]=useState(false);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const name=fullName(lead?.contact);
  const active=Boolean(lead);
  const wa=phoneLink(lead?.contact?.whatsapp);
  const selectedStage=stages.find(s=>s.id===lead?.pipeline_stage_id);
  useEffect(()=>{
    if(!active)return;
    opener.current=document.activeElement;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    root.current?.focus();
    const key=e=>{
      if(e.key==='Escape'){e.preventDefault();closeRef.current?.();return}
      if(e.key!=='Tab'||!root.current)return;
      const selectors='a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])';
      const items=[...root.current.querySelectorAll(selectors)].filter(x=>x.getClientRects().length>0);
      if(!items.length){e.preventDefault();return}
      const first=items[0],last=items[items.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
    };
    document.addEventListener('keydown',key);
    return ()=>{document.removeEventListener('keydown',key);document.body.style.overflow=previousOverflow;opener.current?.focus?.()};
  },[active]);
  useEffect(()=>{setTab('resumo');setDue('');setPriority('medium');setTaskTitle('Retornar para '+fullName(lead?.contact));setMessage('');setError('')},[lead?.id]);
  if(!lead)return null;
  const firstPhone=lead.contact?.whatsapp||'Telefone não informado';
  const createTask=async e=>{
    e.preventDefault();
    if(readonly||submitting||!onOperation)return;
    const title=(taskTitle.trim()||('Retornar para '+name)).slice(0,180);
    setSubmitting(true);setError('');setMessage('');
    try{
      const result=await onOperation({action:'task_create',title,priority,due_date:due||null});
      await onReload?.();
      setTaskTitle('');setDue('');setPriority('medium');
      setMessage(result?.message||'Tarefa criada. Consulte a aba Minhas tarefas.');
    }catch(e){setError(e.message||'Não foi possível criar a tarefa.')}
    finally{setSubmitting(false)}
  };
  return <div className="v11-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <aside className="v11-detail" ref={root} tabIndex={-1} role="dialog" aria-modal="true" aria-label={'Atendimento de '+name}>
      <header className="v11-detail-top">
        <span className="v11-detail-crumb">CRM <span>/</span> Oportunidades <span>/</span> Atendimento</span>
        <button type="button" onClick={onClose} aria-label="Fechar atendimento"><X size={19}/></button>
      </header>
      <div className="v11-detail-hero">
        <span className="v11-detail-avatar">{name.split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase()}</span>
        <div><span className="v11-detail-eyebrow">CONTATO</span><h2>{name}</h2><p>{firstPhone}</p></div>
      </div>
      <div className="v11-detail-buttons">
        {wa?<a className="v11-detail-primary" href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle size={17}/> Conversar no WhatsApp <ExternalLink size={15}/></a>:
          <span className="v11-detail-unavailable"><Phone size={16}/> WhatsApp não informado</span>}
        <button type="button" onClick={()=>setTab('retorno')} className="v11-detail-secondary"><CalendarPlus size={17}/> Criar retorno</button>
      </div>
      <nav aria-label="Informações do atendimento" className="v11-detail-tabs">
        {[['resumo','Resumo'],['retorno','Próxima ação'],['atividade','Atividade']].map(([key,value])=>
          <button key={key} type="button" className={key===tab?'active':''} onClick={()=>setTab(key)} aria-current={key===tab?'page':undefined}>{value}</button>)}
      </nav>
      <div className="v11-detail-content">
        {message&&<div role="status" className="v11-detail-success"><Check size={17}/>{message}</div>}
        {error&&<div role="alert" className="v11-detail-error">{error}</div>}
        {tab==='resumo'&&<>
          <section className="v11-detail-section"><h3>Informações comerciais</h3>
            <div className="v11-detail-field"><label htmlFor="v11-stage">Etapa do funil</label>
              <div className="v11-detail-select"><select id="v11-stage" disabled={readonly||pending||!stages.length} value={lead.pipeline_stage_id||''} onChange={e=>onStageChange?.(lead,e.target.value)}>
                {!lead.pipeline_stage_id&&<option value="">Selecione a etapa</option>}
                {stages.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}
              </select><ChevronDown size={17}/></div>
              {!stages.length&&<p className="v11-detail-help">Configure as etapas do funil para habilitar alterações.</p>}
            </div>
            <SummaryRow title="Origem" value={lead.source}/>
            <SummaryRow title="Temperatura" value={label(lead.temperature)}/>
            <SummaryRow title="Criado em" value={formatDate(lead.created_at)}/>
          </section>
          <section className="v11-detail-section"><h3>Contato</h3>
            <SummaryRow title="Nome" value={name}/>
            <SummaryRow title="Telefone" value={lead.contact?.whatsapp}/>
            <SummaryRow title="E-mail" value={lead.contact?.email}/>
          </section>
        </>}
        {tab==='retorno'&&<section className="v11-detail-section">
          <h3>Agendar um retorno</h3>
          <p className="v11-detail-intro">Crie uma tarefa de acompanhamento para a equipe. Ela ficará disponível em Minhas tarefas.</p>
          <form className="v11-detail-form" onSubmit={createTask}>
            <label>O que precisa ser feito?<input maxLength={180} required value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder={'Retornar para '+name}/></label>
            <div className="v11-detail-form-grid">
              <label>Prazo<input type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>
              <label>Prioridade<select value={priority} onChange={e=>setPriority(e.target.value)}><option value="low">Baixa</option><option value="medium">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option></select></label>
            </div>
            <button className="v11-detail-save" disabled={readonly||submitting} type="submit">{submitting?'Salvando...':'Criar tarefa'} <ArrowRight size={17}/></button>
            {readonly&&<p className="v11-detail-help">Seu perfil tem acesso apenas para leitura.</p>}
          </form>
          <div className="v11-detail-integrity"><ShieldCheck size={16}/><span>Esta tarefa ainda não fica vinculada automaticamente ao lead. O nome do contato aparece no título para facilitar a identificação.</span></div>
        </section>}
        {tab==='atividade'&&<section className="v11-detail-section">
          <h3>Eventos disponíveis</h3>
          <p className="v11-detail-intro">Informações confirmadas pelo cadastro atual. Histórico completo de conversas e alterações depende de uma trilha de atividades no banco.</p>
          <div className="v11-detail-timeline">
            {selectedStage&&<div><span className="v11-detail-timeline-dot"/><strong>Etapa atual</strong><p>{selectedStage.name}</p></div>}
            <div><span className="v11-detail-timeline-dot"/><strong>Lead cadastrado</strong><p>{formatDate(lead.created_at)} · {lead.source||'Origem não informada'}</p></div>
          </div>
        </section>}
      </div>
      <footer className="v11-detail-footer"><ShieldCheck size={15}/><span>Atendimento na empresa selecionada</span></footer>
    </aside>
  </div>;
}
