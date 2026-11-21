import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceFunnel,daysLate,lateLabel} from '../lib/sales-attribution.mjs';

const now=Date.parse('2026-11-09T12:00:00Z');
const d=days=>new Date(now-days*86400000).toISOString();

test('origem é medida até a venda, só por vínculo lead_id',()=>{
  const leads=[
    {id:'a',source:'Meta Ads',created_at:d(2)},
    {id:'b',source:'Meta Ads',created_at:d(3)},
    {id:'c',source:'Meta Ads',created_at:d(4)},
    {id:'g',source:'Google',created_at:d(5)},
    {id:'old',source:'Google',created_at:d(90)}
  ];
  const appointments=[
    {lead_id:'a',status:'scheduled'},{lead_id:'a',status:'confirmed'}, // mesmo lead conta uma vez
    {lead_id:'b',status:'cancelled'},                                  // cancelado não conta
    {lead_id:'g',status:'completed'},
    {lead_id:'old',status:'completed'}                                 // fora da coorte
  ];
  const sales=[
    {lead_id:'g',value:900,created_at:d(1)},
    {lead_id:'a',value:150,created_at:d(1)},
    {lead_id:'a',value:50,created_at:d(1)},                            // 2 vendas, 1 lead convertido
    {lead_id:null,value:400,created_at:d(1)},                          // sem vínculo: à parte
    {lead_id:'old',value:999,created_at:d(1)}                          // lead fora do período
  ];
  const r=sourceFunnel({leads,appointments,sales},{days:30,now});
  assert.deepEqual(r.rows.map(x=>[x.source,x.leads,x.withAppointment,x.withSale,x.sales,x.revenue]),[
    ['Google',1,1,1,1,900],
    ['Meta Ads',3,1,1,2,200]
  ]);
  const meta=r.rows.find(x=>x.source==='Meta Ads');
  assert.equal(meta.saleRate,33.3);
  assert.equal(meta.appointmentRate,33.3);
  assert.equal(r.unattributedSales,1);
  assert.equal(r.unattributedRevenue,400);
  assert.equal(r.totals.leads,4);
  assert.equal(r.totals.saleRate,50);
});

test('origem vazia vira "Não informada" e período vazio não divide por zero',()=>{
  const r=sourceFunnel({leads:[{id:'x',source:'  ',created_at:d(1)}]},{days:7,now});
  assert.equal(r.rows[0].source,'Não informada');
  assert.equal(r.rows[0].saleRate,0);
  const empty=sourceFunnel({},{days:7,now});
  assert.deepEqual(empty.rows,[]);
  assert.equal(empty.totals.saleRate,null);
});

test('atraso conta dias de calendário, sem efeito de fuso',()=>{
  assert.equal(daysLate('2026-11-08','2026-11-09'),1);
  assert.equal(daysLate('2026-10-31','2026-11-09'),9);
  assert.equal(daysLate('2026-11-09','2026-11-09'),0);
  assert.equal(daysLate('2026-11-12','2026-11-09'),0);
  assert.equal(daysLate('',  '2026-11-09'),0);
  assert.equal(lateLabel(1),'Vencida há 1 dia');
  assert.equal(lateLabel(4),'Vencida há 4 dias');
  assert.equal(lateLabel(0),'');
});
