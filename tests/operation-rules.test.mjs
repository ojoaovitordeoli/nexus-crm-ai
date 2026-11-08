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
