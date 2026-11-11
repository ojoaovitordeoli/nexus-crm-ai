import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBRL,dueDayKey,dueDate,authErrorMessage,contactSearchTerm} from '../lib/shell-rules.mjs';

test('valor de venda aceita o formato brasileiro com vírgula e milhar',()=>{
  assert.equal(parseBRL('1500'),1500);
  assert.equal(parseBRL('1500,50'),1500.5);
  assert.equal(parseBRL('1.500,50'),1500.5);
  assert.equal(parseBRL('R$ 1.234.567,89'),1234567.89);
  assert.equal(parseBRL('1.500'),1500); // antes virava 1,5
  assert.equal(parseBRL('99,9'),99.9);
  assert.equal(parseBRL('1500.75'),1500.75);
});

test('valor de venda rejeita lixo e formatos ambíguos',()=>{
  for(const bad of ['','abc','1,2,3','1.5.0,00','12,345','-10','1e3','10,','R$']){
    assert.ok(Number.isNaN(parseBRL(bad)),bad);
  }
});

test('prazo de tarefa é data de calendário, sem deslocamento de fuso',()=>{
  assert.equal(dueDayKey('2026-11-09'),'2026-11-09');
  assert.equal(dueDayKey('2026-11-09T00:00:00+00:00'),'2026-11-09');
  assert.equal(dueDayKey('2026-11-09T00:00:00Z'),'2026-11-09');
  assert.equal(dueDayKey('2026-11-09 00:00:00+00'),'2026-11-09');
  assert.equal(dueDayKey(''),'');
  assert.equal(dueDayKey('lixo'),'');
  assert.equal(dueDate('2026-11-09T00:00:00Z').getDate(),9);
  assert.equal(dueDate(null),null);
});

test('mensagens de autenticação aparecem em português',()=>{
  assert.equal(authErrorMessage({message:'Invalid login credentials'}),'E-mail ou senha incorretos.');
  assert.match(authErrorMessage({message:'Auth session missing!'}),/link de recuperação expirou/);
  assert.match(authErrorMessage({message:'For security purposes, you can only request this after 39 seconds.'}),/Aguarde/);
  assert.match(authErrorMessage({message:'New password should be different from the old password.'}),/diferente/);
  assert.equal(authErrorMessage({message:'Outro erro'}),'Outro erro');
  assert.ok(authErrorMessage(null).length>0);
});

test('busca por contato sem nome usa telefone ou abre sem filtro',()=>{
  assert.equal(contactSearchTerm({first_name:'Ana',last_name:'Souza'}),'Ana Souza');
  assert.equal(contactSearchTerm({whatsapp:'48999990000'}),'48999990000');
  assert.equal(contactSearchTerm(null),'');
});
