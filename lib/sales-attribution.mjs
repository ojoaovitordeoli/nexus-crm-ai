// Atribuição por origem e contexto de tarefas.
// Regra de honestidade: só conta resultado ligado ao lead por chave estrangeira
// (appointments.lead_id, sales.lead_id, tasks.lead_id). Nada é estimado ou inferido por nome.

const DAY=86400000;
const cancelled=s=>['cancelled','canceled'].includes(String(s||'').toLowerCase());

// Coorte: leads criados no período. Agendamentos e vendas desses leads contam
// mesmo que tenham acontecido depois (é o resultado da origem, não do mês).
export function sourceFunnel({leads=[],appointments=[],sales=[]},{days=30,now=Date.now()}={}){
  const since=now-days*DAY;
  const cohort=leads.filter(l=>{const t=Date.parse(l?.created_at);return Number.isFinite(t)&&t>=since&&t<=now});
  const byLead=new Map(cohort.map(l=>[l.id,l]));
  const rows=new Map();
  const row=key=>{
    if(!rows.has(key))rows.set(key,{source:key,leads:0,withAppointment:0,withSale:0,sales:0,revenue:0});
    return rows.get(key);
  };
  const sourceOf=l=>String(l?.source||'').trim()||'Não informada';
  cohort.forEach(l=>{row(sourceOf(l)).leads+=1});

  const scheduled=new Set();
  appointments.forEach(a=>{
    if(!a?.lead_id||cancelled(a.status)||!byLead.has(a.lead_id)||scheduled.has(a.lead_id))return;
    scheduled.add(a.lead_id);
    row(sourceOf(byLead.get(a.lead_id))).withAppointment+=1;
  });

  const sold=new Set();
  let unattributedSales=0,unattributedRevenue=0;
  sales.forEach(s=>{
    const value=Number(s?.value)||0;
    const lead=s?.lead_id?byLead.get(s.lead_id):null;
    if(!lead){
      // Venda do período sem lead vinculado: aparece à parte, nunca é distribuída entre origens.
      const t=Date.parse(s?.sale_date||s?.created_at);
      if(!s?.lead_id&&Number.isFinite(t)&&t>=since&&t<=now){unattributedSales+=1;unattributedRevenue+=value}
      return;
    }
    const r=row(sourceOf(lead));
    r.sales+=1;r.revenue+=value;
    if(!sold.has(lead.id)){sold.add(lead.id);r.withSale+=1}
  });

  const pct=(part,total)=>total?Math.round(part/total*1000)/10:null;
  const list=[...rows.values()].map(r=>({
    ...r,
    appointmentRate:pct(r.withAppointment,r.leads),
    saleRate:pct(r.withSale,r.leads),
    revenuePerLead:r.leads?r.revenue/r.leads:null
  })).sort((a,b)=>b.revenue-a.revenue||b.withSale-a.withSale||b.leads-a.leads||a.source.localeCompare(b.source,'pt-BR'));
  const totals=list.reduce((t,r)=>({leads:t.leads+r.leads,withSale:t.withSale+r.withSale,revenue:t.revenue+r.revenue}),{leads:0,withSale:0,revenue:0});
  return {rows:list,totals:{...totals,saleRate:pct(totals.withSale,totals.leads)},unattributedSales,unattributedRevenue};
}

// Dias de atraso entre duas chaves AAAA-MM-DD do calendário local (sem fuso).
export function daysLate(dueKey,todayKey){
  const parse=k=>/^\d{4}-\d{2}-\d{2}$/.test(String(k||''))?Date.UTC(+k.slice(0,4),+k.slice(5,7)-1,+k.slice(8,10)):NaN;
  const due=parse(dueKey),today=parse(todayKey);
  if(!Number.isFinite(due)||!Number.isFinite(today))return 0;
  return Math.max(0,Math.round((today-due)/DAY));
}

export const lateLabel=n=>n<=0?'':n===1?'Vencida há 1 dia':'Vencida há '+n+' dias';
