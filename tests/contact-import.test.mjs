import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCsv,buildContacts,normalizePhone,mapHeaders,pickSheet,rowsToCsv} from '../lib/contact-import.mjs';

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
  assert.deepEqual(r.contacts[0],{first_name:'Ana',last_name:'Maria Silva',whatsapp:'48999991111',email:null,source:null,city:null,state:null,zip_code:null,company:null,priority:null,segment:null,note:null});
  assert.equal(r.duplicates,1);
  assert.deepEqual(r.invalid.map(i=>i.line),[4,5,6]);
});
test('sem coluna de nome explica o problema',()=>{
  assert.match(buildContacts(parseCsv('telefone\n48999991111\n')).error,/coluna de nome/);
});

test('planilha de empresas: Razão/Fantasia, UF, CEP e colunas extras viram anotação',()=>{
  const r=buildContacts([['Razão','Fantasia','Telefone 1','Telefone 2','E-mail','Cidade','UF','CEP','SÓCIO','Segmento provável (inferido pelo nome)','Serviço inicial sugerido','Prioridade inicial (heurística)'],
    ['AGROFER PNEUS LTDA','AGROFER PNEUS','49999129464','000000000000','X@Y.COM','ABELARDO LUZ','SC','89.830-000','OLIDES','Agro','Captação','A — testar primeiro'],
    ['VINCULO ADMINISTRACAO DE BENS LTDA','','1932322992','','','CAMPINAS','SP','','','Holding','x','C — validar antes']]);
  assert.equal(r.contacts.length,2);
  const [a,b]=r.contacts;
  assert.equal(a.first_name,'Agrofer Pneus');assert.equal(a.company,'Agrofer Pneus LTDA');
  assert.equal(a.city,'Abelardo Luz');assert.equal(a.state,'SC');assert.equal(a.zip_code,'89830000');
  assert.equal(a.email,'x@y.com');assert.equal(a.priority,'A');assert.equal(a.segment,'Agro');
  assert.match(a.note,/Sócio\(s\): OLIDES/);assert.doesNotMatch(a.note,/Telefone 2/);
  assert.equal(b.first_name,'Vinculo Administracao de Bens LTDA');assert.equal(b.priority,'C');
});
test('nome de pessoa continua dividido em nome e sobrenome',()=>{
  const r=buildContacts([['Nome','WhatsApp'],['Maria Souza','48999991111']]);
  assert.equal(r.contacts[0].first_name,'Maria');assert.equal(r.contacts[0].last_name,'Souza');
});
test('pickSheet ignora aba de instruções e acha a de dados; rowsToCsv escapa',()=>{
  const s=pickSheet([{sheet:'COMECE AQUI',data:[['JV'],['Objetivo','x']]},{sheet:'Dados',data:[['Razão','Telefone 1'],['A;B "C"','4899']]}]);
  assert.equal(s.sheet,'Dados');
  const csv=rowsToCsv(s.data);assert.equal(parseCsv(csv)[1][0],'A;B "C"');
});
test('coluna "Número" do endereço não é confundida com telefone',()=>{
  const r=buildContacts([['Razão','Endereço','Número','Telefone 1'],['ACME LTDA','RUA X','123','48999990000']]);
  assert.equal(r.contacts[0].whatsapp,'48999990000');
  const only=buildContacts([['Nome','Número'],['Ana','48999990000']]);
  assert.equal(only.contacts[0].whatsapp,'48999990000');
});
