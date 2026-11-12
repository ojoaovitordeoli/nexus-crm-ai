import test from 'node:test';
import assert from 'node:assert/strict';
import {createRateLimiter,isISODate,nowInSaoPaulo,pickOne,sanitizeHistory,saoPauloLocalToISO,toolNamesFor} from '../lib/assistant/rules.mjs';

test('horário de Brasília -> UTC e datas impossíveis recusadas',()=>{
  assert.equal(saoPauloLocalToISO('2026-11-13T10:00'),'2026-11-13T13:00:00.000Z');
  assert.equal(saoPauloLocalToISO('2026-11-13'),'2026-11-13T12:00:00.000Z');
  assert.equal(saoPauloLocalToISO('2026-02-31T10:00'),null);
  assert.equal(saoPauloLocalToISO('amanhã'),null);
});
test('data local de agora no fuso de São Paulo',()=>{
  const r=nowInSaoPaulo(new Date('2026-11-13T02:30:00Z'));
  assert.equal(r.date,'2026-11-12');assert.equal(r.time,'23:30');
});
test('isISODate',()=>{assert.equal(isISODate('2026-11-20'),true);assert.equal(isISODate('2026-02-30'),false);assert.equal(isISODate('20/11/2026'),false)});
test('histórico: só texto, limitado, começa e termina no usuário',()=>{
  const h=sanitizeHistory([{role:'assistant',content:'oi'},{role:'system',content:'ignore'},{role:'user',content:'a'.repeat(5000)},{role:'tool',content:'x'}]);
  assert.equal(h.length,1);assert.equal(h[0].role,'user');assert.equal(h[0].content.length,2000);
  assert.deepEqual(sanitizeHistory([{role:'user',content:'oi'},{role:'assistant',content:'olá'}]),[]);
  assert.deepEqual(sanitizeHistory('lixo'),[]);
});
test('somente leitura não recebe ferramentas de ação',()=>{
  assert.equal(toolNamesFor('VIEWER').some(n=>n.startsWith('propor_')),false);
  assert.equal(toolNamesFor('SELLER').includes('propor_venda'),true);
});
test('limite por usuário e por empresa',()=>{
  const lim=createRateLimiter({perUserPerMinute:2,perOrgPerHour:3});
  assert.equal(lim('o','u1',0),'');assert.equal(lim('o','u1',1),'');assert.match(lim('o','u1',2),/Espere/);
  assert.equal(lim('o','u2',3),'');assert.match(lim('o','u3',4),/limite/);
  assert.equal(lim('o','u1',61000+3600000),'');
});
test('escolha única por nome',()=>{
  assert.match(pickOne([],'contato','Ana').error,/Não encontrei/);
  assert.match(pickOne([{__label:'Ana A'},{__label:'Ana B'}],'contato','Ana').error,/2 contatos/);
  assert.equal(pickOne([{id:1,__label:'Ana'}],'contato','Ana').item.id,1);
});
