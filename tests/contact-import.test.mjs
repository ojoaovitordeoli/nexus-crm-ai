import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,buildContacts,normalizePhone,mapHeaders} from '../lib/contact-import.mjs';

test('CSV do Excel brasileiro (ponto e vírgula, BOM, aspas)',()=>{
  const rows=parseCsv('﻿Nome;Celular;E-mail\r\n"Silva, Ana";(48) 99999-1111;ana@x.com\r\nJoão Souza;48 3333-4444;\r\n');
  assert.deepEqual(rows,[['Nome','Celular','E-mail'],['Silva, Ana','(48) 99999-1111','ana@x.com'],['João Souza','48 3333-4444','']]);
});
test('CSV com vírgula e quebra de linha dentro de aspas',()=>{
  const rows=parseCsv('name,phone\n"Ana\nMaria",5548999991111\n');
  assert.equal(rows[1][0],'Ana\nMaria');assert.equal(rows[1][1],'5548999991111');
});
test('cabeçalhos em português e inglês, com acento',()=>{
  assert.deepEqual(mapHeaders(['Nome Completo','Telefone','Origem','Município']),{name:0,whatsapp:1,source:2,city:3});
});
test('telefone: aceita 55, recusa curto',()=>{
  assert.equal(normalizePhone('+55 (48) 99999-1111'),'48999991111');
  assert.equal(normalizePhone('99999-1111'),null);
  assert.equal(normalizePhone(''),'');
});
test('monta contatos, separa nome, ignora duplicado e aponta linha inválida',()=>{
  const r=buildContacts(parseCsv('Nome;WhatsApp;Email\nAna Maria Silva;48999991111;\nBia;48999991111;\nX;48988887777;\nCarlos;123;\nDani;;dani@\n'));
  assert.equal(r.contacts.length,1);
  assert.deepEqual(r.contacts[0],{first_name:'Ana',last_name:'Maria Silva',whatsapp:'48999991111',email:null,source:null,city:null});
  assert.equal(r.duplicates,1);
  assert.deepEqual(r.invalid.map(i=>i.line),[4,5,6]);
});
test('sem coluna de nome explica o problema',()=>{
  assert.match(buildContacts(parseCsv('telefone\n48999991111\n')).error,/coluna de nome/);
});
