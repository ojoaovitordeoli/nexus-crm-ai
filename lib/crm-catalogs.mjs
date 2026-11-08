// Regras puras dos cadastros do funil (motivos de perda, origens, categorias, setores,
// campos extras e campos obrigatórios por etapa). Sem rede nem banco: testado em
// tests/crm-catalogs.test.mjs e usado por app/api/crm-settings/route.js.

export const CATALOGS={
  lost_reasons:{table:'lost_reasons',column:'reason',label:'Motivos de perda',singular:'motivo de perda'},
  lead_origins:{table:'lead_origins',column:'name',label:'Origens de clientes',singular:'origem'},
  contact_categories:{table:'contact_categories',column:'name',label:'Categorias de clientes',singular:'categoria'},
  company_sectors:{table:'company_sectors',column:'name',label:'Setores',singular:'setor'}
};
export const CATALOG_KINDS=Object.keys(CATALOGS);
export const FIELD_TYPES=['text','number','currency','checkbox','select','multiselect','date','phone','email'];
export const FIELD_ENTITIES=['lead','contact'];
export const CORE_REQUIREMENTS=['source','estimated_value','products','lost_reason','closed_at'];

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isId=v=>uuid.test(String(v||''));
const clean=(v,max)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
export const sameName=(a,b)=>clean(a,200).toLocaleLowerCase('pt-BR')===clean(b,200).toLocaleLowerCase('pt-BR');

// Configurar cadastros muda a operação da empresa toda: somente gestão.
export const canConfigureCrm=role=>['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER'].includes(role);

export function validateCatalogName(kind,name,existing=[]){
  if(!CATALOGS[kind])return {error:'Cadastro inválido.'};
  const value=clean(name,120);
  if(!value)return {error:'Informe um nome.'};
  if(existing.some(x=>sameName(x,value)))return {error:'Já existe um item com esse nome.'};
  return {value};
}

export function validateField(input){
  const name=clean(input?.name,80);
  const type=String(input?.type||'');
  const entity=String(input?.entity_type||'lead');
  if(name.length<2)return {error:'Informe o nome do campo.'};
  if(!FIELD_TYPES.includes(type))return {error:'Tipo de campo inválido.'};
  if(!FIELD_ENTITIES.includes(entity))return {error:'O campo deve ser do negócio ou da pessoa.'};
  const raw=Array.isArray(input?.options)?input.options:String(input?.options||'').split(/\n|;/);
  const options=[...new Set(raw.map(o=>clean(o,80)).filter(Boolean))].slice(0,50);
  if((type==='select'||type==='multiselect')&&options.length<2)return {error:'Lista precisa de pelo menos duas opções.'};
  return {data:{name,type,entity_type:entity,options:type==='select'||type==='multiselect'?options:[],key:fieldKey(name)}};
}
export function fieldKey(name){
  return clean(name,80).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'').slice(0,60)||'campo';
}

// Lista de requisitos de uma etapa: aceita só campos-base conhecidos e campos extras da empresa.
export function validateRequirements(list,allowedFieldIds=[]){
  const allowed=new Set(allowedFieldIds);
  const seen=new Set();const out=[];
  for(const item of Array.isArray(list)?list:[]){
    const core=item?.core_field?String(item.core_field):null;
    const cf=item?.custom_field_id?String(item.custom_field_id):null;
    if(Boolean(core)===Boolean(cf))return {error:'Cada campo obrigatório precisa ser um campo-base ou um campo extra.'};
    if(core&&!CORE_REQUIREMENTS.includes(core))return {error:'Campo-base inválido.'};
    if(cf&&(!isId(cf)||!allowed.has(cf)))return {error:'Campo extra não pertence à empresa.'};
    const key=core?'core:'+core:'cf:'+cf;
    if(seen.has(key))continue;seen.add(key);
    out.push({core_field:core,custom_field_id:cf,question:clean(item?.question,240)||null,position:out.length});
  }
  if(out.length>20)return {error:'Máximo de 20 campos obrigatórios por etapa.'};
  return {data:out};
}

// Modelo lido da configuração do Agendor (Litoral Sul Premium, 07/11/2026).
// Só nomes de cadastro e estrutura do funil: nenhum dado de cliente.
const yes=['Sim','Não'];
export const AGENDOR_TEMPLATE={
  name:'Proteção veicular (modelo Agendor)',
  catalogs:{
    lost_reasons:['Contato inválido','Desistência','Modelo sem tabela','Não houve perda','Parou de responder','Prazo','Preço','Realização de vistoria','Região não atendida','Reprovado pela diretoria','Serviço','Syngoo','Veículo irregular'],
    lead_origins:['Associado adição','Associado substituição','Cancelados','Inadimplente','Inativo','Indicação','Ligação','Meta (Meta Ads)','Meta (Orgânico)','Outdoor','Rádio','Retorno de contato','Site (Google Ads)','Terceiro (Eventos)','Visita ao físico','Voluntários'],
    contact_categories:['Apresentação das redes sociais','Não realizado','Realizado'],
    company_sectors:['Comércio atacadista','Comércio varejista','Exportadora','Importadora','Indústria em geral','Indústria fabricante de máquinas','Prestadora de serviços']
  },
  fields:[
    {name:'Vistoria/análise já liberada',type:'select',entity_type:'lead',options:yes},
    {name:'Já estava em negociação?',type:'select',entity_type:'lead',options:yes},
    {name:'Recebeu a oferta?',type:'select',entity_type:'lead',options:yes},
    {name:'A promoção influenciou?',type:'select',entity_type:'lead',options:yes},
    {name:'Envio mensagem de boas-vindas',type:'select',entity_type:'lead',options:yes},
    {name:'Msg não pagantes boleto at.',type:'select',entity_type:'lead',options:yes},
    {name:'Data de env. msg pós 7D',type:'date',entity_type:'lead'},
    {name:'Data do boleto de at. enviado',type:'date',entity_type:'lead'},
    {name:'Hora do boleto de at. enviado',type:'text',entity_type:'lead'},
    {name:'Enviar a mensagem at. boleto',type:'select',entity_type:'lead',options:yes},
    {name:'Vencimento do boleto de at.',type:'date',entity_type:'lead'},
    {name:'Contatos realizados',type:'number',entity_type:'lead'},
    {name:'CPF',type:'text',entity_type:'contact'},
    {name:'Modelo do veículo',type:'text',entity_type:'contact'},
    {name:'Ano do veículo',type:'number',entity_type:'contact'},
    {name:'Placa do veículo',type:'text',entity_type:'contact'}
  ],
  stages:[
    {name:'Aprendizado e descoberta',idle_days:1,color:'#5f00e6',requires:[{core:'source'}]},
    {name:'Negociação',idle_days:5,color:'#7a2cf0',requires:[{core:'estimated_value'},{core:'products'},{field:'Vistoria/análise já liberada'}]},
    {name:'Vistoria / envio do boleto',idle_days:1,color:'#9457f3',requires:[{field:'Já estava em negociação?'},{field:'Recebeu a oferta?'},{field:'A promoção influenciou?'}]},
    {name:'Boas-vindas (ativo)',idle_days:1,color:'#16a34a',is_won:true,requires:[{field:'Envio mensagem de boas-vindas'}]},
    {name:'Expirado (não pago)',idle_days:1,color:'#dc2626',is_lost:true,requires:[{field:'Msg não pagantes boleto at.'},{core:'lost_reason'}]},
    {name:'Pós-venda D+7',idle_days:7,color:'#0f766e',is_won:true,requires:[{field:'Data de env. msg pós 7D'}]}
  ]
};

// Itens do modelo que ainda não existem na empresa (comparação sem acento/maiúscula de forma simples).
export function missingNames(wanted,existing){
  return wanted.filter(w=>!existing.some(e=>sameName(e,w)));
}
