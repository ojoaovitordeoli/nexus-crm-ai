import test from 'node:test';
import assert from 'node:assert/strict';
import {CATALOGS,AGENDOR_TEMPLATE,canConfigureCrm,validateCatalogName,validateField,validateRequirements,missingNames,fieldKey} from '../lib/crm-catalogs.mjs';

const CF='e7d8957c-461e-439d-a50b-b771d028cc73';
const OTHER='a1d8957c-461e-439d-a50b-b771d028cc73';

test('somente gestão configura cadastros do CRM',()=>{
 for(const r of ['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER'])assert.equal(canConfigureCrm(r),true);
 for(const r of ['SELLER','SDR','VIEWER','',null,'admin'])assert.equal(canConfigureCrm(r),false);
});
test('nome de cadastro é limpo, obrigatório e sem duplicata (ignora maiúsculas)',()=>{
 assert.deepEqual(validateCatalogName('lost_reasons','  Preço  ',[]),{value:'Preço'});
 assert.ok(validateCatalogName('lost_reasons','preço',['Preço']).error);
 assert.ok(validateCatalogName('lost_reasons','   ',[]).error);
 assert.ok(validateCatalogName('tabela_qualquer','X',[]).error,'tipo desconhecido');
});
test('campo extra valida tipo, entidade e opções',()=>{
 assert.equal(validateField({name:'Placa',type:'text',entity_type:'contact'}).data.key,'placa');
 assert.ok(validateField({name:'X',type:'text'}).error,'nome curto');
 assert.ok(validateField({name:'Campo',type:'script'}).error,'tipo inválido');
 assert.ok(validateField({name:'Campo',type:'text',entity_type:'company'}).error,'entidade inválida');
 assert.ok(validateField({name:'Lista',type:'select',options:'Só uma'}).error);
 assert.deepEqual(validateField({name:'Lista',type:'select',options:'Sim; Não; Sim'}).data.options,['Sim','Não']);
 assert.equal(fieldKey('Já estava em negociação?'),'ja_estava_em_negociacao');
});
test('requisitos de etapa aceitam só campos-base e campos da própria empresa',()=>{
 const ok=validateRequirements([{core_field:'source'},{custom_field_id:CF,question:'Liberada?'},{core_field:'source'}],[CF]);
 assert.equal(ok.data.length,2,'duplicata removida');
 assert.equal(ok.data[1].position,1);
 assert.ok(validateRequirements([{custom_field_id:OTHER}],[CF]).error,'campo de outra empresa');
 assert.ok(validateRequirements([{core_field:'senha'}],[]).error);
 assert.ok(validateRequirements([{core_field:'source',custom_field_id:CF}],[CF]).error,'os dois ao mesmo tempo');
 assert.deepEqual(validateRequirements([],[]).data,[]);
});
test('modelo Agendor é coerente: listas completas e requisitos apontam para campos do modelo',()=>{
 const t=AGENDOR_TEMPLATE;
 assert.equal(t.catalogs.lost_reasons.length,13);
 assert.equal(t.catalogs.lead_origins.length,16);
 assert.equal(t.catalogs.contact_categories.length,3);
 assert.equal(t.catalogs.company_sectors.length,7);
 for(const k of Object.keys(t.catalogs))assert.ok(CATALOGS[k],k);
 assert.equal(t.stages.length,6);
 const names=new Set(t.fields.map(f=>f.name));
 for(const s of t.stages)for(const r of s.requires){
  if(r.field)assert.ok(names.has(r.field),r.field);
  else assert.ok(['source','estimated_value','products','lost_reason','closed_at'].includes(r.core));
 }
 for(const f of t.fields)assert.ok(validateField(f).data,f.name);
});
test('aplicar o modelo só cria o que falta',()=>{
 assert.deepEqual(missingNames(['Preço','Prazo','Serviço'],['preço','Outro']),['Prazo','Serviço']);
});
