import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {isUuid,safeCompare,verifyWebhookQuery,verifyWebhookSignature,extractWhatsAppEvents,manageAutomationRole,validateFollowupRule} from '../lib/workflow-security.mjs';

test('UUID validation rejects malformed identifiers',()=>{
 assert.equal(isUuid('e7d8957c-461e-439d-a50b-b771d028cc73'),true);
 assert.equal(isUuid('abc'),false);
});
test('constant-time token comparison handles valid and invalid inputs',()=>{
 assert.equal(safeCompare('secret','secret'),true);
 assert.equal(safeCompare('secret','wrong'),false);
 assert.equal(safeCompare(null,'secret'),false);
});
test('WhatsApp challenge requires subscribe and matching verify token',()=>{
 const valid='https://crm.test/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token-123&hub.challenge=987';
 assert.equal(verifyWebhookQuery(valid,'token-123'),true);
 assert.equal(verifyWebhookQuery(valid,'token-456'),false);
 assert.equal(verifyWebhookQuery(valid.replace('subscribe','unsubscribe'),'token-123'),false);
});
test('WhatsApp payload rejects spoofed signature and accepts only verified HMAC',()=>{
 const body=Buffer.from('{"object":"whatsapp_business_account"}');
 const secret='shared_app_secret';
 const signed='sha256='+createHmac('sha256',secret).update(body).digest('hex');
 assert.equal(verifyWebhookSignature(body,signed,secret),true);
 assert.equal(verifyWebhookSignature(body,signed,'another'),false);
 assert.equal(verifyWebhookSignature(body,'sha256=abcdef',secret),false);
 assert.equal(verifyWebhookSignature(body,'sha256='+('00'.repeat(32)),secret),false);
});
test('WhatsApp event extraction ignores unknown payloads and sanitizes text',()=>{
 assert.deepEqual(extractWhatsAppEvents({object:'other',entry:[]}),[]);
 const data={object:'whatsapp_business_account',entry:[{changes:[{value:{
  metadata:{phone_number_id:'1020304050607'},
  messages:[{id:'wamid.123',from:'55 (11) 98888-2222',type:'text',text:{body:'Oi!'},timestamp:'1820000000'}]
 }}]}]};
 const events=extractWhatsAppEvents(data);
 assert.equal(events.length,1);
 assert.equal(events[0].phone_number_id,'1020304050607');
 assert.equal(events[0].from,'5511988882222');
 assert.equal(events[0].text,'Oi!');
});
test('automation write permissions deny viewers and nonmanagers for management',()=>{
 assert.equal(manageAutomationRole('VIEWER'),false);
 assert.equal(manageAutomationRole('SELLER'),false);
 assert.equal(manageAutomationRole('MANAGER'),true);
});
test('followup rule validates names, stage id and timeframe',()=>{
 const stage_id='e7d8957c-461e-439d-a50b-b771d028cc73';
 const value=validateFollowupRule({name:'Follow-up',task_title:'Retornar ao cliente',stage_id,delay_days:2});
 assert.equal(value.data.delay_days,2);
 assert.equal(validateFollowupRule({name:'a',task_title:'Follow up',stage_id,delay_days:2}).error!==undefined,true);
 assert.equal(validateFollowupRule({name:'Follow up',task_title:'Call',stage_id,delay_days:31}).error!==undefined,true);
});
