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

test('WhatsApp inbox read is denied to viewers and unknown roles',async()=>{
 const {readWhatsAppRole}=await import('../lib/workflow-security.mjs');
 for(const r of ['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER','SDR','SELLER'])assert.equal(readWhatsAppRole(r),true,r);
 for(const r of ['VIEWER','',null,undefined,'admin','SUPER_ADMIN'])assert.equal(readWhatsAppRole(r),false,String(r));
});
test('Brazilian phone matching tolerates country code, formatting and 9th digit',async()=>{
 const {samePhone,phoneMatchKeys}=await import('../lib/workflow-security.mjs');
 assert.equal(samePhone('5511987654321','(11) 98765-4321'),true);
 assert.equal(samePhone('551187654321','11 98765-4321'),true);
 assert.equal(samePhone('5511987654321','+55 11 8765-4321'),true);
 assert.equal(samePhone('5511987654321','5521987654321'),false,'DDD diferente');
 assert.equal(samePhone('5511987654321','5511987654320'),false);
 assert.equal(samePhone('1133334444','11 93333-4444'),false,'fixo não ganha 9º dígito');
 assert.deepEqual(phoneMatchKeys(''),[]);
 assert.deepEqual(phoneMatchKeys('123'),[]);
});

test('erro de esquema ausente é reconhecido (RPC/tabela não instalada)',async()=>{
  const {isMissingSchema}=await import('../lib/workflow-security.mjs');
  assert.equal(isMissingSchema({code:'PGRST202',message:'Could not find the function'}),true);
  assert.equal(isMissingSchema({code:'42P01'}),true);
  assert.equal(isMissingSchema({message:'Could not find the function public.admin_manage_organization in the schema cache'}),true);
  assert.equal(isMissingSchema({code:'23505',message:'duplicate key'}),false);
  assert.equal(isMissingSchema(null),false);
});

test('erros do Supabase Auth ao criar usuário viram português com status certo',async()=>{
  const {authCreateUserError}=await import('../lib/workflow-security.mjs');
  assert.deepEqual(authCreateUserError({code:'email_exists',message:'A user with this email address has already been registered'}).status,409);
  assert.match(authCreateUserError({message:'A user with this email address has already been registered'}).message,/Já existe/);
  assert.equal(authCreateUserError({code:'weak_password',message:'Password should be stronger'}).status,400);
  const other=authCreateUserError({code:'unexpected_failure',message:'Database error saving new user'});
  assert.equal(other.status,500);assert.doesNotMatch(other.message,/Database/);
});
