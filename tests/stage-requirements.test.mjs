import test from 'node:test';
import assert from 'node:assert/strict';
import {describeRequirement,evaluateRequirements,normalizeAnswer,statusForStage,requirementKey} from '../lib/stage-requirements.mjs';

const P1='3f1c2a4e-1b2c-4d3e-8f9a-0b1c2d3e4f5a';
const P2='4a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d';
const field=(id,type,options=null,name='Campo')=>({id,type,options,name});

test('core and custom requirements are described with stable keys',()=>{
  const core=describeRequirement({core_field:'source',question:'Origem do Lead'});
  assert.equal(core.key,'core:source');assert.equal(core.label,'Origem do Lead');assert.equal(core.type,'text');
  const cf=describeRequirement({custom_field_id:P1,question:null},field(P1,'select',['Sim','Não'],'Recebeu a oferta?'));
  assert.equal(cf.key,'cf:'+P1);assert.equal(cf.label,'Recebeu a oferta?');assert.deepEqual(cf.options,['Sim','Não']);
  assert.equal(requirementKey({custom_field_id:P1}),'cf:'+P1);
});
test('requirement for unknown core field or missing (other tenant) custom field is dropped',()=>{
  assert.equal(describeRequirement({core_field:'password'}),null);
  assert.equal(describeRequirement({custom_field_id:P1},undefined),null);
});
test('missing required answers block the stage change',()=>{
  const reqs=[describeRequirement({core_field:'source'}),describeRequirement({custom_field_id:P1},field(P1,'checkbox',null,'Boas-vindas enviada'))];
  const r=evaluateRequirements(reqs,{},{});
  assert.deepEqual(r.missing,['Origem do lead','Boas-vindas enviada']);
  const unchecked=evaluateRequirements(reqs,{'core:source':'Instagram'},{['cf:'+P1]:false});
  assert.deepEqual(unchecked.missing,['Boas-vindas enviada']);
});
test('stored values satisfy requirements without resending them',()=>{
  const reqs=[describeRequirement({core_field:'estimated_value'})];
  assert.deepEqual(evaluateRequirements(reqs,{'core:estimated_value':1500},{}).missing,[]);
  assert.deepEqual(evaluateRequirements(reqs,{'core:estimated_value':1500},{'core:estimated_value':''}).missing,['Valor total']);
});
test('select, multiselect and lost reason only accept configured options',()=>{
  const sel=describeRequirement({custom_field_id:P1},field(P1,'select',['Sim','Não']));
  assert.equal(normalizeAnswer(sel,'Talvez').ok,false);
  assert.deepEqual(normalizeAnswer(sel,'Sim'),{ok:true,value:'Sim'});
  const multi=describeRequirement({custom_field_id:P2},field(P2,'multiselect',['Enviado','Não enviado']));
  assert.deepEqual(normalizeAnswer(multi,['Enviado','Enviado']),{ok:true,value:['Enviado']});
  assert.equal(normalizeAnswer(multi,['<script>']).ok,false);
  const lost=describeRequirement({core_field:'lost_reason'});
  assert.equal(normalizeAnswer(lost,'Preço',{lostReasons:['Preço']}).value,'Preço');
  assert.equal(normalizeAnswer(lost,'Inventado',{lostReasons:['Preço']}).ok,false);
  const r=evaluateRequirements([sel],{},{['cf:'+P1]:'Talvez'});
  assert.deepEqual(r.invalid,['Campo']);
});
test('dates, numbers and products are validated strictly',()=>{
  const d=describeRequirement({core_field:'closed_at'});
  assert.equal(normalizeAnswer(d,'2026-02-30').ok,false);
  assert.equal(normalizeAnswer(d,'2026-11-07').value,'2026-11-07');
  const n=describeRequirement({custom_field_id:P1},field(P1,'number'));
  assert.equal(normalizeAnswer(n,'-1').ok,false);
  assert.equal(normalizeAnswer(n,'3').value,3);
  const prod=describeRequirement({core_field:'products'});
  assert.equal(normalizeAnswer(prod,[{product_id:P2,quantity:1}],{productIds:[P1]}).ok,false,'product from another company is rejected');
  assert.deepEqual(normalizeAnswer(prod,[{product_id:P1,quantity:1},{product_id:P1,quantity:2}],{productIds:[P1]}).value,[{product_id:P1,quantity:3}]);
  assert.equal(normalizeAnswer(prod,[{product_id:P1,quantity:0}],{productIds:[P1]}).ok,false);
});
test('lead status follows won/lost stages',()=>{
  assert.equal(statusForStage({is_won:true}),'won');
  assert.equal(statusForStage({is_lost:true}),'lost');
  assert.equal(statusForStage({}),'active');
});
