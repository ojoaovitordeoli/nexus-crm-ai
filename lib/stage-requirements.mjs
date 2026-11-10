// Regras puras dos requisitos obrigatórios de etapa (funis múltiplos).
// Usadas pela API (validação de verdade) e pelos testes. A interface apenas
// coleta as respostas; quem decide se o lead pode entrar na etapa é o servidor.

export const CORE_FIELDS={
  source:{label:'Origem do lead',type:'text'},
  estimated_value:{label:'Valor total',type:'currency'},
  products:{label:'Produtos e serviços',type:'products'},
  lost_reason:{label:'Motivo da perda',type:'lost_reason'},
  closed_at:{label:'Data de conclusão',type:'date'}
};
export const CUSTOM_TYPES=['text','number','currency','checkbox','select','multiselect','date','phone','email'];

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isDate=v=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(v||'')))return false;
  const d=new Date(String(v)+'T00:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===String(v);
};
const list=v=>Array.isArray(v)?v:[];
// Aceita "1234.56", "1234,56" e "1.234,56" (digitação pt-BR); recusa ambíguos como "1,234.5".
export function parseDecimal(raw){
  let t=String(raw??'').trim().replace(/^R\$\s*/i,'').replace(/\s/g,'');
  if(!t)return NaN;
  if(t.includes(',')){
    if(/\.\d*,/.test(t)||/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t))t=t.replace(/\.(?=\d{3}(\D|$))/g,'');
    if(t.includes('.'))return NaN;
    t=t.replace(',','.');
  }
  return /^-?\d+(\.\d+)?$/.test(t)?Number(t):NaN;
}
// Coluna timestamp (ex.: closed_at) chega como "2026-11-05T00:00:00+00:00": vale a data.
const dateOnly=v=>{const t=String(v??'').trim();return /^\d{4}-\d{2}-\d{2}T/.test(t)?t.slice(0,10):t};

export const requirementKey=req=>req.core_field?'core:'+req.core_field:'cf:'+req.custom_field_id;

// Monta a descrição que a interface usa para desenhar o formulário.
export function describeRequirement(req,field){
  if(req.core_field){
    const meta=CORE_FIELDS[req.core_field];
    if(!meta)return null;
    return {key:requirementKey(req),kind:'core',field:req.core_field,label:req.question||meta.label,type:meta.type,options:[]};
  }
  if(!field)return null;
  const type=CUSTOM_TYPES.includes(field.type)?field.type:'text';
  return {key:requirementKey(req),kind:'custom',field:field.id,label:req.question||field.name,type,
    options:list(field.options).map(x=>String(x)).filter(Boolean)};
}

// Normaliza uma resposta. Retorna {ok:true,value} ou {ok:false}.
// "Vazio" (string vazia, null, checkbox desmarcado, lista vazia) é ok:true,value:null,
// e a obrigatoriedade é decidida depois em evaluateRequirements.
export function normalizeAnswer(req,raw,ctx={}){
  const empty={ok:true,value:null};
  if(raw===undefined||raw===null)return empty;
  switch(req.type){
    case 'text':{const v=String(raw).trim().slice(0,500);return v?{ok:true,value:v}:empty}
    case 'phone':{
      const v=String(raw).replace(/\D/g,'');
      if(!v)return empty;
      return v.length>=10&&v.length<=13?{ok:true,value:v}:{ok:false};
    }
    case 'number':case 'currency':{
      if(String(raw).trim()==='')return empty;
      const n=parseDecimal(raw);
      if(!Number.isFinite(n)||n<0||n>100000000)return {ok:false};
      if(req.type==='currency'&&n===0)return empty;
      return {ok:true,value:n};
    }
    case 'checkbox':return raw===true||raw==='true'?{ok:true,value:true}:empty;
    case 'date':{const v=dateOnly(raw);if(v==='')return empty;return isDate(v)?{ok:true,value:v}:{ok:false}}
    case 'email':{
      const v=String(raw).trim().toLowerCase().slice(0,254);
      if(!v)return empty;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)?{ok:true,value:v}:{ok:false};
    }
    case 'select':{
      const v=String(raw).trim();
      if(!v)return empty;
      return !req.options.length||req.options.includes(v)?{ok:true,value:v}:{ok:false};
    }
    case 'multiselect':{
      const values=[...new Set(list(raw).map(x=>String(x).trim()).filter(Boolean))];
      if(!values.length)return empty;
      return values.every(v=>!req.options.length||req.options.includes(v))?{ok:true,value:values}:{ok:false};
    }
    case 'lost_reason':{
      const v=String(raw).trim().slice(0,240);
      if(!v)return empty;
      const allowed=list(ctx.lostReasons);
      return !allowed.length||allowed.includes(v)?{ok:true,value:v}:{ok:false};
    }
    case 'products':{
      const rows=list(raw).slice(0,50).map(x=>({product_id:String(x?.product_id||''),quantity:Number(x?.quantity??1)}));
      if(!rows.length)return empty;
      const allowed=new Set(list(ctx.productIds));
      const ok=rows.every(r=>uuid.test(r.product_id)&&(!allowed.size||allowed.has(r.product_id))&&Number.isFinite(r.quantity)&&r.quantity>0&&r.quantity<=100000);
      if(!ok)return {ok:false};
      const merged=new Map();
      for(const r of rows)merged.set(r.product_id,(merged.get(r.product_id)||0)+r.quantity);
      return {ok:true,value:[...merged].map(([product_id,quantity])=>({product_id,quantity}))};
    }
    default:return {ok:false};
  }
}

export const isFilled=value=>Array.isArray(value)?value.length>0:value!==null&&value!==undefined&&value!==''&&value!==false;

// requirements: descrições (describeRequirement); current: {key:valor salvo}; answers: {key:valor enviado}
// Retorna {missing:[labels], invalid:[labels], changes:[{req,value}]}
export function evaluateRequirements(requirements,current={},answers={},ctx={}){
  const missing=[];const invalid=[];const changes=[];
  for(const req of requirements){
    const sent=Object.prototype.hasOwnProperty.call(answers||{},req.key);
    let value=current[req.key];
    if(sent){
      const normalized=normalizeAnswer(req,answers[req.key],ctx);
      if(!normalized.ok){invalid.push(req.label);continue}
      value=normalized.value;
      changes.push({req,value});
    }
    if(!isFilled(value))missing.push(req.label);
  }
  return {missing,invalid,changes};
}

// Status do lead derivado da etapa de destino.
export const statusForStage=stage=>stage?.is_won?'won':stage?.is_lost?'lost':'active';
