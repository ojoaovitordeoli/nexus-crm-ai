// Regras puras da venda completa e da meta do mês. Testadas em tests/sale-rules.test.mjs.

export const PAYMENT_METHODS={pix:'PIX',cash:'Dinheiro',credit:'Cartão de crédito',debit:'Cartão de débito',boleto:'Boleto',transfer:'Transferência'};
export const paymentLabel=v=>PAYMENT_METHODS[v]||'';

const clean=(v,max)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);

// Campos extras da venda. Só devolve as chaves que vieram no payload (assim a edição não apaga o que não mudou).
export function saleExtras(payload={},now=Date.now()){
  const out={};
  if('payment_method' in payload){
    const pm=payload.payment_method;
    if(pm===''||pm===null)out.payment_method=null;
    else if(PAYMENT_METHODS[pm])out.payment_method=pm;
    else return {error:'Forma de pagamento inválida.'};
  }
  if('product' in payload)out.product=clean(payload.product,160)||null;
  if('notes' in payload)out.notes=String(payload.notes??'').trim().slice(0,600)||null;
  if('sale_date' in payload&&payload.sale_date){
    const raw=String(payload.sale_date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(raw))return {error:'Data da venda inválida.'};
    // Meio-dia de Brasília: a data não "volta um dia" ao exibir em fuso local.
    const ms=Date.parse(raw+'T15:00:00Z');
    if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==raw)return {error:'Data da venda inválida.'};
    if(ms>now+2*86400000)return {error:'A data da venda não pode estar no futuro.'};
    if(ms<now-5*366*86400000)return {error:'Data da venda muito antiga.'};
    out.sale_date=new Date(ms).toISOString();
  }
  return {value:out};
}

// Mês comercial em horário de Brasília (UTC-3). month opcional no formato AAAA-MM.
export function monthRange(month,now=Date.now()){
  let y,m;
  if(month){
    const k=/^(\d{4})-(\d{2})$/.exec(String(month));
    if(!k||+k[2]<1||+k[2]>12)return null;
    y=+k[1];m=+k[2];
  }else{
    const br=new Date(now-3*3600000);
    y=br.getUTCFullYear();m=br.getUTCMonth()+1;
  }
  const pad=n=>String(n).padStart(2,'0');
  const last=new Date(Date.UTC(y,m,0)).getUTCDate();
  return {key:y+'-'+pad(m),start:y+'-'+pad(m)+'-01',end:y+'-'+pad(m)+'-'+pad(last),
    // Limites em UTC para filtrar sale_date: 00:00 e 24:00 de Brasília.
    fromIso:new Date(Date.UTC(y,m-1,1,3)).toISOString(),toIso:new Date(Date.UTC(y,m,1,3)).toISOString(),days:last};
}

export function parseGoalTarget(v){
  const n=Number(v);
  return Number.isFinite(n)&&n>0&&n<=1000000000?Math.round(n*100)/100:null;
}

// Progresso da meta e ritmo: compara o realizado com o esperado para o dia do mês.
export function goalProgress({target,achieved=0,range,now=Date.now()}){
  const t=Number(target);
  if(!Number.isFinite(t)||t<=0||!range)return null;
  const a=Math.max(0,Number(achieved)||0);
  const pct=Math.round(a/t*1000)/10;
  const from=Date.parse(range.fromIso),to=Date.parse(range.toIso);
  const elapsed=Math.min(1,Math.max(0,(now-from)/(to-from)));
  const expected=Math.round(elapsed*1000)/10;
  const remaining=Math.max(0,Math.round((t-a)*100)/100);
  const status=a>=t?'done':pct+5>=expected?'on_track':'behind';
  return {target:t,achieved:a,pct,expected,remaining,status};
}
