// Importação de contatos por planilha (CSV).
// Ideia inspirada no Atomic CRM (marmelab/atomic-crm, licença MIT); código próprio do NEXUS.
// Roda igual no navegador (prévia) e no servidor (fonte de verdade).

export const IMPORT_LIMIT=2000;

/** Lê CSV exportado do Excel/Google Planilhas (vírgula ou ponto e vírgula, aspas, BOM). */
export function parseCsv(text){
  let src=String(text??'');
  if(src.charCodeAt(0)===0xFEFF)src=src.slice(1);
  const firstLine=src.split(/\r?\n/,1)[0]||'';
  const count=ch=>{let n=0,q=false;for(const c of firstLine){if(c==='"')q=!q;else if(c===ch&&!q)n++}return n};
  const sep=count(';')>count(',')?';':(count('\t')>count(',')?'\t':',');
  const rows=[];let row=[],cell='',quoted=false;
  for(let i=0;i<src.length;i++){
    const c=src[i];
    if(quoted){
      if(c==='"'&&src[i+1]==='"'){cell+='"';i++}
      else if(c==='"')quoted=false;
      else cell+=c;
    }else if(c==='"')quoted=true;
    else if(c===sep){row.push(cell);cell=''}
    else if(c==='\n'||c==='\r'){
      if(c==='\r'&&src[i+1]==='\n')i++;
      row.push(cell);cell='';
      if(row.some(v=>v.trim()!==''))rows.push(row);
      row=[];
    }else cell+=c;
  }
  row.push(cell);
  if(row.some(v=>v.trim()!==''))rows.push(row);
  return rows;
}

const strip=s=>String(s??'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
const HEADERS={
  name:['nome','nome completo','name','full name','cliente','contato','paciente','fantasia','nome fantasia'],
  first_name:['primeiro nome','first name','first_name'],
  last_name:['sobrenome','last name','last_name','ultimo nome'],
  company:['empresa','razao','razao social','company','companhia'],
  whatsapp:['whatsapp','whats','celular','telefone 1','telefone1','telefone','fone','phone','mobile','tel','contato telefone','numero de telefone','numero'],
  email:['email','e-mail','e mail','mail'],
  source:['origem','fonte','source','canal'],
  city:['cidade','city','municipio'],
  state:['uf','estado','state'],
  zip_code:['cep','zip','zip code']
};
// Colunas extras viram anotação no lead (o cabeçalho só precisa começar com estas palavras).
const NOTE_FIELDS=[
  ['priority','prioridade','Prioridade'],
  ['segment','segmento','Segmento'],
  ['service','servico','Serviço sugerido'],
  ['partner','socio','Sócio(s)'],
  ['phone2','telefone 2','Telefone 2'],
  ['notes','observ','Observações'],
  ['notes2','anotac','Anotações']
];
/** Descobre qual coluna é qual a partir do cabeçalho. */
export function mapHeaders(header=[]){
  // Para cada campo vale o apelido que vem primeiro na lista (ex.: "Telefone 1" ganha de "Número",
  // que em planilha de empresa costuma ser o número do endereço).
  const keys=header.map(strip);const map={};const used=new Set();
  for(const [field,names] of Object.entries(HEADERS)){
    for(const n of names){const i=keys.findIndex((k,j)=>k===n&&!used.has(j));if(i>=0){map[field]=i;used.add(i);break}}
  }
  for(const [field,prefix] of NOTE_FIELDS){
    const i=keys.findIndex((k,j)=>k.startsWith(prefix)&&!used.has(j));if(i>=0){map[field]=i;used.add(i)}
  }
  return map;
}

// "AGROFER PNEUS LTDA" -> "Agrofer Pneus LTDA" (só mexe em texto todo em maiúsculas).
export function niceCase(v){
  const t=String(v??'').trim().replace(/\s+/g,' ');
  if(!t||t!==t.toUpperCase()||!/[A-ZÀ-Ú]/.test(t))return t;
  return t.toLowerCase().replace(/(^|[\s\-/(])([a-zà-ú])/g,(m,a,b)=>a+b.toUpperCase())
    .replace(/\b(Ltda|Me|Eireli|Epp)\b/g,w=>w.toUpperCase()).replace(/\bS\/a\b/g,'S/A')
    .replace(/(\s)(De|Da|Do|Dos|Das|E)(?=\s)/g,(m,a,b)=>a+b.toLowerCase());
}

export function normalizePhone(v){
  let d=String(v??'').replace(/\D/g,'');
  if(!d)return '';
  if(d.length===13&&d.startsWith('55'))d=d.slice(2);
  else if(d.length===12&&d.startsWith('55'))d=d.slice(2);
  return d.length===10||d.length===11?d:null; // null = inválido
}

/**
 * Converte linhas em contatos válidos.
 * Retorna {contacts, invalid:[{line,reason}], duplicates:number, mapped}.
 */
export function buildContacts(rows){
  if(!Array.isArray(rows)||rows.length<2)return {contacts:[],invalid:[],duplicates:0,mapped:{},error:'A planilha precisa de um cabeçalho e ao menos uma linha.'};
  const mapped=mapHeaders(rows[0]);
  if(mapped.name===undefined&&mapped.first_name===undefined&&mapped.company===undefined)
    return {contacts:[],invalid:[],duplicates:0,mapped,error:'Não encontrei a coluna de nome. Use um cabeçalho como "Nome" ou "Empresa".'};
  const contacts=[],invalid=[],seen=new Set();let duplicates=0;
  const get=(r,k)=>mapped[k]===undefined?'':String(r[mapped[k]]??'').trim();
  // Nome de pessoa é dividido em nome/sobrenome; nome de empresa fica inteiro.
  const personName=mapped.name!==undefined&&!['fantasia','nome fantasia'].includes(strip(rows[0][mapped.name]));
  rows.slice(1,IMPORT_LIMIT+1).forEach((r,idx)=>{
    const line=idx+2;
    const company=niceCase(get(r,'company')).slice(0,200);
    let first=get(r,'first_name'),last=get(r,'last_name');
    if(!first){
      const full=niceCase(get(r,'name'))||company;
      if(personName&&get(r,'name')){const parts=full.split(/\s+/).filter(Boolean);first=parts.shift()||'';if(!last)last=parts.join(' ')}
      else first=full;
    }
    first=first.slice(0,130);last=last.slice(0,130);
    if(first.length<2){invalid.push({line,reason:'Sem nome'});return}
    const rawPhone=get(r,'whatsapp');
    const whatsapp=normalizePhone(rawPhone);
    if(whatsapp===null){invalid.push({line,reason:'Telefone inválido: '+rawPhone.slice(0,30)});return}
    const email=get(r,'email').toLowerCase().slice(0,200);
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){invalid.push({line,reason:'E-mail inválido'});return}
    if(whatsapp){if(seen.has(whatsapp)){duplicates++;return}seen.add(whatsapp)}
    const extra={};
    for(const [field,,label] of NOTE_FIELDS){
      let v=get(r,field);
      if(field==='phone2'&&/^0*$/.test(v.replace(/\D/g,'')))v='';
      if(v)extra[field]={label,value:v.slice(0,400)};
    }
    const priority=(extra.priority?.value.match(/^[A-Ca-c](?=\b|\s|—|-)/)?.[0]||'').toUpperCase()||null;
    const note=Object.values(extra).map(x=>x.label+': '+x.value).join('\n')||null;
    contacts.push({first_name:first,last_name:last||null,whatsapp:whatsapp||null,email:email||null,
      source:get(r,'source').slice(0,120)||null,city:niceCase(get(r,'city')).slice(0,120)||null,
      state:get(r,'state').slice(0,40)||null,zip_code:get(r,'zip_code').replace(/\D/g,'').slice(0,12)||null,
      company:company||null,priority,segment:extra.segment?.value.slice(0,120)||null,note});
  });
  return {contacts,invalid,duplicates,mapped,truncated:rows.length-1>IMPORT_LIMIT};
}

/** Converte linhas (ex.: lidas de um .xlsx) em CSV com ponto e vírgula, para o servidor reler. */
export function rowsToCsv(rows){
  const cell=v=>{const t=v==null?'':String(v);return /[";\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t};
  return rows.map(r=>r.map(cell).join(';')).join('\n');
}

/** Numa planilha com várias abas, escolhe a primeira que tem coluna de nome/empresa e de telefone. */
export function pickSheet(sheets=[]){
  for(const s of sheets){
    const rows=s?.data||[];const m=mapHeaders(rows[0]||[]);
    if((m.name!==undefined||m.company!==undefined||m.first_name!==undefined)&&m.whatsapp!==undefined&&rows.length>1)return s;
  }
  return sheets.find(s=>(s?.data||[]).length>1)||null;
}
