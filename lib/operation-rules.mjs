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
