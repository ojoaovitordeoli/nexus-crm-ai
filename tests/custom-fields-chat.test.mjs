import test from 'node:test';
import assert from 'node:assert/strict';
import {prepararCampo, resumoCampo, campoDuplicado, mostrarValor, comoRequisito} from '../lib/custom-fields-chat.mjs';
import {normalizeAnswer} from '../lib/stage-requirements.mjs';
import {toolNamesFor} from '../lib/assistant/rules.mjs';

test('pedido em português vira campo válido', () => {
  const r = prepararCampo({nome: 'Convênio', tipo: 'lista', onde: 'contato', opcoes: ['Unimed', 'Particular', 'Unimed']});
  assert.deepEqual(r.data, {name: 'Convênio', type: 'select', entity_type: 'contact', options: ['Unimed', 'Particular'], key: 'convenio'});
  assert.match(resumoCampo(r.data), /Lista de opções.*Unimed, Particular.*contato/);
  assert.equal(prepararCampo({nome: 'Grau OD', tipo: 'numero', onde: 'lead'}).data.type, 'number');
  assert.equal(prepararCampo({nome: 'Já fez exame?', tipo: 'sim/não', onde: 'lead'}).data.type, 'checkbox');
});

test('tipo desconhecido, nome curto e lista sem opções são recusados', () => {
  assert.match(prepararCampo({nome: 'X do cliente', tipo: 'json'}).error, /Tipo inválido/);
  assert.ok(prepararCampo({nome: 'x', tipo: 'texto'}).error);
  assert.match(prepararCampo({nome: 'Convênio', tipo: 'lista', opcoes: ['Só uma']}).error, /duas opções/);
});

test('onde desconhecido cai no lead (padrão seguro)', () => {
  assert.equal(prepararCampo({nome: 'Interesse', tipo: 'texto', onde: 'organizations'}).data.entity_type, 'lead');
});

test('duplicado ignora acento e maiúscula, mas só no mesmo lugar', () => {
  const existentes = [{name: 'Convenio', entity_type: 'contact'}, {name: 'Grau OD', entity_type: 'lead'}];
  assert.equal(campoDuplicado(existentes, {name: 'CONVÊNIO', entity_type: 'contact'}), true);
  assert.equal(campoDuplicado(existentes, {name: 'Convênio', entity_type: 'lead'}), false);
});

test('valores aparecem formatados em português', () => {
  assert.equal(mostrarValor({type: 'checkbox'}, true), 'Sim');
  assert.equal(mostrarValor({type: 'currency'}, 1250.5).replace(/\s/g, ' '), 'R$ 1.250,50');
  assert.equal(mostrarValor({type: 'date'}, '2026-11-21'), '21/11/2026');
  assert.equal(mostrarValor({type: 'multiselect'}, ['A', 'B']), 'A, B');
  assert.equal(mostrarValor({type: 'text'}, null), '');
  assert.equal(mostrarValor({type: 'number'}, -1.25), '-1,25');
});

test('valor do campo passa pela mesma validação das etapas', () => {
  const lista = comoRequisito({id: 'f1', name: 'Convênio', type: 'select', options: ['Unimed', 'Particular']});
  assert.deepEqual(normalizeAnswer(lista, 'Unimed'), {ok: true, value: 'Unimed'});
  assert.equal(normalizeAnswer(lista, 'Inventado').ok, false);
  const grau = comoRequisito({id: 'f2', name: 'Grau', type: 'number', options: null});
  assert.deepEqual(normalizeAnswer(grau, '2,5'), {ok: true, value: 2.5});
  assert.deepEqual(normalizeAnswer(grau, ''), {ok: true, value: null});
  assert.deepEqual(normalizeAnswer(grau, '-1,25'), {ok: true, value: -1.25}, 'grau de miopia é negativo');
  assert.equal(normalizeAnswer(comoRequisito({id: 'f3', name: 'Entrada', type: 'currency'}), '-10').ok, false, 'dinheiro não pode ser negativo');
});

test('só gerente/admin recebe a ferramenta de criar campo', () => {
  for (const r of ['MANAGER', 'ORGANIZATION_ADMIN', 'AGENCY_ADMIN']) assert.equal(toolNamesFor(r).includes('propor_campo'), true, r);
  for (const r of ['SELLER', 'SDR', 'VIEWER', undefined]) assert.equal(toolNamesFor(r).includes('propor_campo'), false, String(r));
  assert.equal(toolNamesFor('VIEWER').includes('ver_campos'), true);
});
