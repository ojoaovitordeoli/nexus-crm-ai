import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeLeadSearch,getSnapshotCoverage} from '../lib/dashboard-snapshot.mjs';

test('a busca do dashboard ignora acentos e maiúsculas',()=>{
  assert.equal(normalizeLeadSearch('JOÃO ÁLVARES'),normalizeLeadSearch('joao alvares'));
  assert.ok(normalizeLeadSearch('Maria Silva 48999991111 Instagram').includes(normalizeLeadSearch('SILVA')));
  assert.equal(normalizeLeadSearch(undefined),'');
});

test('identifica amostra de registros independentemente por módulo',()=>{
  const counts={leads:300,sales:3,tasks:2};
  const data={leads:[{id:1}],sales:[{id:2},{id:3},{id:4}],tasks:[{id:5},{id:6}]};
  assert.deepEqual(getSnapshotCoverage(counts,data),{leads:true,sales:false,tasks:false});
});

test('não classifica dados completos como amostra nem interpreta falta de dados como total',()=>{
  assert.deepEqual(getSnapshotCoverage({leads:1,sales:0,tasks:0},{leads:[{id:1}],sales:[],tasks:[]}),{leads:false,sales:false,tasks:false});
  assert.deepEqual(getSnapshotCoverage(),{leads:false,sales:false,tasks:false});
});
