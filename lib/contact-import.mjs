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
  name:['nome','nome completo','name','full name','cliente','contato','paciente'],
  first_name:['primeiro nome','first name','first_name'],
  last_name:['sobrenome','last name','last_name','ultimo nome'],
  whatsapp:['whatsapp','whats','celular','telefone','fone','phone','mobile','tel','numero','contato telefone'],
  email:['email','e-mail','e mail','mail'],
  source:['origem','fonte','source','canal'],
  city:['cidade','city','municipio']
};
/** Descobre qual coluna é qual a partir do cabeçalho. */
export function mapHeaders(header=[]){
  const map={};
  header.forEach((h,i)=>{
    const k=strip(h);
    for(const [field,names] of Object.entries(HEADERS))
      if(map[field]===undefined&&names.includes(k)){map[field]=i;break}
  });
  return map;
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
  if(mapped.name===undefined&&mapped.first_name===undefined)
    return {contacts:[],invalid:[],duplicates:0,mapped,error:'Não encontrei a coluna de nome. Use um cabeçalho como "Nome".'};
  const contacts=[],invalid=[],seen=new Set();let duplicates=0;
  const get=(r,k)=>mapped[k]===undefined?'':String(r[mapped[k]]??'').trim();
  rows.slice(1,IMPORT_LIMIT+1).forEach((r,idx)=>{
    const line=idx+2;
    let first=get(r,'first_name'),last=get(r,'last_name');
    if(!first){
      const parts=get(r,'name').split(/\s+/).filter(Boolean);
      first=parts.shift()||'';
      if(!last)last=parts.join(' ');
    }
    first=first.slice(0,130);last=last.slice(0,130);
    if(first.length<2){invalid.push({line,reason:'Sem nome'});return}
    const rawPhone=get(r,'whatsapp');
    const whatsapp=normalizePhone(rawPhone);
    if(whatsapp===null){invalid.push({line,reason:'Telefone inválido: '+rawPhone.slice(0,30)});return}
    const email=get(r,'email').slice(0,200);
    if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){invalid.push({line,reason:'E-mail inválido'});return}
    if(whatsapp){if(seen.has(whatsapp)){duplicates++;return}seen.add(whatsapp)}
    contacts.push({first_name:first,last_name:last||null,whatsapp:whatsapp||null,email:email||null,
      source:get(r,'source').slice(0,120)||null,city:get(r,'city').slice(0,120)||null});
  });
  return {contacts,invalid,duplicates,mapped,truncated:rows.length-1>IMPORT_LIMIT};
}
