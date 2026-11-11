import test from 'node:test';
import assert from 'node:assert/strict';
import {buildLeadTimeline,canManagePipeline,canWriteOperation,READ_ACTIONS} from '../lib/operation-rules.mjs';

test('VIEWER e papéis desconhecidos não escrevem; papéis operacionais escrevem',()=>{
  for(const role of ['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER','SDR','SELLER'])assert.equal(canWriteOperation(role),true,role);
  for(const role of ['VIEWER','',undefined,null,'admin','SUPER_ADMIN'])assert.equal(canWriteOperation(role),false,String(role));
});

test('somente gestão altera a estrutura do funil',()=>{
  assert.deepEqual(['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER','SDR','SELLER','VIEWER'].map(canManagePipeline),
    [true,true,true,false,false,false]);
});

test('linha do tempo é a única ação POST liberada para leitura',()=>{
  assert.deepEqual([...READ_ACTIONS],['lead_timeline']);
});

test('linha do tempo usa apenas registros vinculados, ordenados do mais recente',()=>{
  const stages=[{id:'s1',name:'Novo Lead'},{id:'s2',name:'Agendamento'}];
  const events=buildLeadTimeline({
    lead:{id:'l1',source:'Instagram',created_at:'2026-11-01T10:00:00Z'},
    history:[{id:'h1',from_stage_id:'s1',to_stage_id:'s2',changed_at:'2026-11-03T10:00:00Z'},
      {id:'h0',from_stage_id:null,to_stage_id:'s1',changed_at:'2026-11-01T11:00:00Z'}],
    tasks:[{id:'t1',title:'Ligar',status:'pending',due_date:'2026-11-05',created_at:'2026-11-02T10:00:00Z'}],
    appointments:[{id:'a1',title:'Exame',status:'no_show',start_at:'2026-11-04T13:00:00Z'}],
    sales:[{id:'v1',value:1500,sale_date:'2026-11-06T10:00:00Z',created_at:'2026-11-06T10:05:00Z'}],
    notes:[{id:'n1',content:'Prefere manhã',created_at:'2026-11-02T09:00:00Z'}],
    stages
  });
  assert.deepEqual(events.map(e=>e.kind),['sale','appointment','stage_changed','task','note','stage_changed','lead_created']);
  assert.equal(events.find(e=>e.id==='stage-h1').detail,'Novo Lead → Agendamento');
  assert.equal(events.find(e=>e.id==='stage-h0').detail,'Definida como Novo Lead');
  assert.equal(events.find(e=>e.kind==='appointment').detail,'não compareceu');
  assert.match(events.find(e=>e.kind==='task').detail,/pendente · prazo 05\/11\/2026/);
  assert.match(events.find(e=>e.kind==='sale').detail,/1\.500,00/);
});

test('registros sem data válida são ignorados em vez de inventar horário',()=>{
  const events=buildLeadTimeline({lead:{id:'l1',created_at:'inválida'},tasks:[{id:'t',title:'x',created_at:null}],
    history:[{id:'h',to_stage_id:'zz',changed_at:'2026-11-01T00:00:00Z'}]});
  assert.equal(events.length,1);
  assert.equal(events[0].detail,'Definida como etapa removida');
});

import {safeCalendarDate,parseDateTime,localDateISO,addDaysISO,planPipelineStages} from '../lib/operation-rules.mjs';

test('data de tarefa só aceita dia de calendário existente',()=>{
  assert.equal(safeCalendarDate('2026-11-10'),'2026-11-10');
  assert.equal(safeCalendarDate('2028-02-29'),'2028-02-29');
  for(const bad of ['2026-02-31','2026-13-01','2026-00-10','10/11/2026','',null,undefined,'0001-01-01'])
    assert.equal(safeCalendarDate(bad),null,String(bad));
});

test('agendamento não aceita null/número (new Date(null) seria 1970)',()=>{
  assert.equal(parseDateTime('2026-11-10T13:00:00.000Z'),'2026-11-10T13:00:00.000Z');
  for(const bad of [null,0,12345,true,'', 'amanhã','2026-99-99T10:00'])assert.equal(parseDateTime(bad),null,String(bad));
});

test('data local usa o fuso de Brasília, não UTC',()=>{
  // 23h30 de 10/11 em Brasília = 02h30 UTC de 11/11.
  assert.equal(localDateISO(new Date('2026-11-11T02:30:00Z')),'2026-11-10');
  assert.equal(addDaysISO('2026-11-30',1),'2026-12-01');
  assert.equal(addDaysISO('2026-11-10',0),'2026-11-10');
});

test('etapas com id de outro funil ou repetido viram etapas novas',()=>{
  const known=new Set(['a']);
  const out=planPipelineStages([{id:'a',name:'A'},{id:'a',name:'A2'},{id:'x',name:'X'},{id:null,name:'N'}],known);
  assert.deepEqual(out.map(s=>s.id),['a',null,null,null]);
  assert.deepEqual(planPipelineStages([{id:'z'}],new Set()).map(s=>s.id),[null]);
});
