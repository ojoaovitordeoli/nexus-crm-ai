import test from 'node:test';
import assert from 'node:assert/strict';
import {canDeleteRecord,canEditRecord,canEditSale,contactDeleteBlock} from '../lib/record-rules.mjs';

test('excluir é só da gestão',()=>{
  for(const r of ['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER'])assert.equal(canDeleteRecord(r),true,r);
  for(const r of ['SDR','SELLER','VIEWER',''])assert.equal(canDeleteRecord(r),false,r);
});
test('editar é de quem escreve',()=>{
  assert.equal(canEditRecord('SELLER'),true);assert.equal(canEditRecord('VIEWER'),false);
});
test('venda: vendedor corrige só a própria; gestão qualquer uma',()=>{
  assert.equal(canEditSale({role:'SELLER',actorId:'a',sellerId:'a'}),true);
  assert.equal(canEditSale({role:'SELLER',actorId:'a',sellerId:'b'}),false);
  assert.equal(canEditSale({role:'MANAGER',actorId:'a',sellerId:'b'}),true);
  assert.equal(canEditSale({role:'VIEWER',actorId:'a',sellerId:'a'}),false);
});
test('contato com lead aberto não vai para a lixeira',()=>{
  assert.match(contactDeleteBlock(2),/2 atendimento/);assert.equal(contactDeleteBlock(0),'');
});
