// Regras puras da API de operação. Sem acesso a rede ou banco: tudo aqui é testável
// em tests/operation-rules.test.mjs e reutilizado por app/api/operation/route.js.

export const KNOWN_ROLES=['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER','SDR','SELLER','VIEWER'];

// Escrita operacional (tarefa, contato, etapa, venda, agenda). VIEWER apenas lê;
// papel desconhecido é tratado como sem permissão (falha fechada).
export const canWriteOperation=role=>KNOWN_ROLES.includes(role)&&role!=='VIEWER';

// Estrutura do funil afeta toda a empresa: somente gestão.
export const canManagePipeline=role=>['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER'].includes(role);

// Ações que só leem dados e, portanto, são permitidas ao VIEWER.
export const READ_ACTIONS=new Set(['lead_timeline']);

// Data de calendário AAAA-MM-DD que existe de verdade (rejeita 2026-02-31, 2026-13-01).
export function safeCalendarDate(value){
  const s=String(value??'');
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if(!m)return null;
  const [y,mo,d]=[Number(m[1]),Number(m[2]),Number(m[3])];
  if(y<1900||y>2200)return null;
  const dt=new Date(Date.UTC(y,mo-1,d));
  return dt.getUTCFullYear()===y&&dt.getUTCMonth()===mo-1&&dt.getUTCDate()===d?s:null;
}

// Data/hora vinda do cliente: somente texto ISO/compatível. null, número ou booleano não
// viram 1970-01-01 (new Date(null) é válido em JS e criaria agendamento em 1970).
export function parseDateTime(value){
  if(typeof value!=='string'||value.trim().length<10||value.length>40)return null;
  const d=new Date(value);
  if(!Number.isFinite(d.getTime()))return null;
  const y=d.getUTCFullYear();
  return y>=1900&&y<=2200?d.toISOString():null;
}

// Data local (AAAA-MM-DD) no fuso da operação. toISOString() usa UTC: depois das 21h em
// Brasília já seria "amanhã", gerando prazos e atrasos com um dia de diferença.
export function localDateISO(date=new Date(),timeZone='America/Sao_Paulo'){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const get=t=>parts.find(p=>p.type===t)?.value;
  return get('year')+'-'+get('month')+'-'+get('day');
}
export function addDaysISO(isoDate,days){
  const d=new Date(isoDate+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+Number(days||0));
  return d.toISOString().slice(0,10);
}

// Prepara as etapas enviadas pelo editor de funil. Ids repetidos (ou de outro funil, quando
// knownIds é informado) viram etapas novas em vez de serem descartados silenciosamente.
export function planPipelineStages(stages,knownIds=null){
  const seen=new Set();
  return stages.map(stage=>{
    let id=stage.id||null;
    if(id&&(seen.has(id)||(knownIds&&!knownIds.has(id))))id=null;
    if(id)seen.add(id);
    return {...stage,id};
  });
}

const stageName=(stages,id)=>stages.find(s=>s.id===id)?.name||null;
const validTime=v=>v&&Number.isFinite(Date.parse(v));
const TASK_STATUS={pending:'pendente',in_progress:'em andamento',completed:'concluída',cancelled:'cancelada'};
const APPOINTMENT_STATUS={scheduled:'agendado',confirmed:'confirmado',completed:'compareceu',cancelled:'cancelado',no_show:'não compareceu'};
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);

/**
 * Monta a linha do tempo do lead apenas com registros persistidos e vinculados por
 * chave estrangeira (lead_id). Nada é inferido a partir de texto/título.
 */
export function buildLeadTimeline({lead,history=[],tasks=[],appointments=[],sales=[],notes=[],stages=[]}){
  const events=[];
  if(lead&&validTime(lead.created_at))events.push({
    id:'lead-'+lead.id,kind:'lead_created',at:lead.created_at,
    title:'Lead cadastrado',detail:lead.source?('Origem: '+lead.source):'Origem não informada'
  });
  for(const h of history){
    if(!validTime(h.changed_at))continue;
    const from=stageName(stages,h.from_stage_id),to=stageName(stages,h.to_stage_id)||'etapa removida';
    events.push({id:'stage-'+h.id,kind:'stage_changed',at:h.changed_at,
      title:'Etapa alterada',detail:(from?from+' → ':'Definida como ')+to});
  }
  for(const t of tasks){
    if(!validTime(t.created_at))continue;
    events.push({id:'task-'+t.id,kind:'task',at:t.created_at,title:'Retorno: '+t.title,
      detail:[TASK_STATUS[t.status]||t.status,t.due_date?('prazo '+t.due_date.split('-').reverse().join('/')):null].filter(Boolean).join(' · ')});
  }
  for(const a of appointments){
    if(!validTime(a.start_at))continue;
    events.push({id:'appt-'+a.id,kind:'appointment',at:a.start_at,title:'Agendamento: '+a.title,
      detail:APPOINTMENT_STATUS[a.status]||a.status||'agendado'});
  }
  for(const s of sales){
    const at=validTime(s.sale_date)?s.sale_date:s.created_at;
    if(!validTime(at))continue;
    events.push({id:'sale-'+s.id,kind:'sale',at,title:'Venda registrada',detail:brl(s.value)});
  }
  for(const n of notes){
    if(!validTime(n.created_at))continue;
    events.push({id:'note-'+n.id,kind:'note',at:n.created_at,title:'Nota',detail:String(n.content||'').slice(0,280)});
  }
  return events.sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}
