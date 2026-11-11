import test from 'node:test';
import assert from 'node:assert/strict';
import {codeLabel,matchesSearch,simplify,whatsappUrl} from '../lib/lead-view.mjs';
import {csvField,leadCsvRows,contactCsvRows,toCsv,fileSlug} from '../lib/csv.mjs';

test('busca ignora acentos e maiúsculas',()=>{
  assert.equal(simplify('  JOÃO   Conceição '),'joao conceicao');
  assert.equal(matchesSearch('joao',['João Silva']),true);
  assert.equal(matchesSearch('CONCEIÇÃO',['Maria Conceicao']),true);
  assert.equal(matchesSearch('pedro',['João Silva']),false);
  assert.equal(matchesSearch('',['qualquer']),true);
});

test('busca por telefone usa só os dígitos, com ou sem DDI',()=>{
  const phones=['(11) 98765-4321'];
  assert.equal(matchesSearch('11987654321',[],phones),true);
  assert.equal(matchesSearch('98765-4321',[],phones),true);
  assert.equal(matchesSearch('+55 11 98765 4321',[],phones),true);
  assert.equal(matchesSearch('5511987654321',[],['11987654321']),true);
  assert.equal(matchesSearch('11999990000',[],phones),false);
  // texto com números não vira busca de telefone
  assert.equal(matchesSearch('rua 123',[],['11123456789']),false);
});

test('WhatsApp: DDI, zero de discagem e números inválidos',()=>{
  assert.equal(whatsappUrl('(11) 98765-4321'),'https://wa.me/5511987654321');
  assert.equal(whatsappUrl('5511987654321'),'https://wa.me/5511987654321');
  assert.equal(whatsappUrl('0 11 98765-4321'),'https://wa.me/5511987654321');
  assert.equal(whatsappUrl('011 3265-4321'),'https://wa.me/551132654321');
  assert.equal(whatsappUrl('+1 (415) 555-1234'),'https://wa.me/14155551234');
  assert.equal(whatsappUrl('00 351 912 345 678'),'https://wa.me/351912345678');
  for(const bad of ['', null, undefined, '12345', '9876-5432', 'abc', '+0 11 1234', '1234567890123456'])
    assert.equal(whatsappUrl(bad),'',String(bad));
});

test('códigos do banco aparecem em português',()=>{
  assert.equal(codeLabel('active'),'Ativo');
  assert.equal(codeLabel('WON'),'Ganho');
  assert.equal(codeLabel('hot'),'Quente');
  assert.equal(codeLabel('in_progress'),'Em andamento');
  assert.equal(codeLabel('aguardando_retorno'),'Aguardando retorno');
  assert.equal(codeLabel(null),'Não informado');
  assert.equal(codeLabel('', 'Sem etapa'),'Sem etapa');
});

test('CSV: BOM, separador ;, aspas, vírgulas, acentos e quebra de linha',()=>{
  const csv=toCsv([['Nome','Obs'],['José "Zé", da Silva','linha1\r\nlinha2']]);
  assert.equal(csv.charCodeAt(0),0xfeff);
  assert.equal(csv.slice(1),'"Nome";"Obs"\r\n"José ""Zé"", da Silva";"linha1\nlinha2"');
});

test('CSV neutraliza fórmulas (CSV injection)',()=>{
  for(const v of ['=HYPERLINK("x")','+1+1','-2+3','@SUM(A1)','\t=1',' =1'])
    assert.ok(csvField(v).startsWith('"\''),v);
  assert.equal(csvField('Normal'),'"Normal"');
  assert.equal(csvField(null),'""');
});

test('CSV de leads traduz status e temperatura e formata a data',()=>{
  const rows=leadCsvRows([
    {contact:{first_name:'Ana',last_name:'Lima',whatsapp:'11987654321'},source:'Meta',status:'active',temperature:'hot',created_at:'2026-11-05T12:00:00Z'},
    {contact:null,status:null,created_at:'lixo'}
  ],l=>l.source?'Novo lead':'');
  assert.deepEqual(rows[0],['Nome','Telefone','Origem','Etapa','Status','Temperatura','Cadastro']);
  assert.deepEqual(rows[1],['Ana Lima','11987654321','Meta','Novo lead','Ativo','Quente','05/11/2026']);
  assert.deepEqual(rows[2],['Contato sem nome','','','','','','']);
});

test('CSV de contatos e nome de arquivo sem acento',()=>{
  assert.deepEqual(contactCsvRows([{first_name:'Zé',whatsapp:null,created_at:'2026-01-02'}])[1],['Zé','','02/01/2026']);
  assert.equal(fileSlug('Ótica São João!'),'otica-sao-joao');
  assert.equal(fileSlug(''),'empresa');
});
