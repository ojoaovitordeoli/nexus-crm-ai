import test from 'node:test';
import assert from 'node:assert/strict';
import {captureLead,captureStatus,generateCaptureToken,hashCaptureToken,qualify,readCaptureToken,revokeCaptureTokens,
  rotateCaptureToken,validateCapture} from '../lib/lead-capture.mjs';

// Store em memória com duas empresas (A com funil, B sem funil).
function memoryStore(){
  const A='org-a',B='org-b';
  const db={tokens:[],contacts:[],leads:[],notes:[],audit:[],history:[],
    pipelines:{[A]:{pipeline_id:'pipe-a',stage_id:'stage-a1'},[B]:null}};
  let n=0;const id=p=>p+'-'+(++n);
  const store={
    async findActiveToken(hash){const t=db.tokens.find(x=>x.token_hash===hash&&!x.revoked_at);return t?{id:t.id,organization_id:t.organization_id}:null},
    async touchToken(tid){const t=db.tokens.find(x=>x.id===tid);if(t)t.last_used_at='agora'},
    async findContact(org,{whatsapp,email,instagram}){
      return db.contacts.find(c=>c.organization_id===org&&((whatsapp&&(c.whatsapp===whatsapp||'55'+c.whatsapp===whatsapp))||(email&&c.email===email)||(instagram&&c.instagram===instagram)))||null},
    async fillContact(org,cid,patch){const c=db.contacts.find(x=>x.id===cid&&x.organization_id===org);if(c&&!c.instagram)Object.assign(c,patch)},
    async createContact(org,row){const c={id:id('ct'),organization_id:org,...row};db.contacts.push(c);return {id:c.id}},
    async findOpenLead(org,cid){return db.leads.find(l=>l.organization_id===org&&l.contact_id===cid&&!l.closed_at)||null},
    async firstStage(org){return db.pipelines[org]},
    async createLead(org,row){const l={id:id('ld'),organization_id:org,...row};db.leads.push(l);return {id:l.id}},
    async updateLead(org,lid,patch){const l=db.leads.find(x=>x.id===lid&&x.organization_id===org);Object.assign(l,patch)},
    async addNote(org,row){db.notes.push({organization_id:org,...row})},
    async logStage(lid,sid){db.history.push({lid,sid})},
    async audit(e){db.audit.push(e)},
    async listTokens(org){return db.tokens.filter(t=>t.organization_id===org&&!t.revoked_at)},
    async createToken(org,row){db.tokens.push({id:id('tk'),organization_id:org,...row})},
    async revokeTokens(org){for(const t of db.tokens)if(t.organization_id===org&&!t.revoked_at)t.revoked_at='agora'},
  };
  return {store,db,A,B};
}
const ADMIN={role:'ORGANIZATION_ADMIN'},SELLER={role:'SELLER'};
async function withToken(org){
  const m=memoryStore();const r=await rotateCaptureToken({store:m.store,access:ADMIN,orgId:org||m.A,actorId:'u1'});
  return {...m,token:r.body.token,auth:'Bearer '+r.body.token};
}

test('chave: formato estrito, só o hash é guardado e aparece uma vez',async()=>{
  const t=generateCaptureToken();
  assert.match(t.token,/^nxl_[A-Za-z0-9_-]{43}$/);
  assert.equal(readCaptureToken('Bearer '+t.token),t.token);
  assert.equal(readCaptureToken('Bearer nxp_'+'a'.repeat(43)),null);
  assert.equal(readCaptureToken(t.token),null);
  const m=await withToken();
  assert.equal(m.db.tokens.length,1);
  assert.equal(m.db.tokens[0].token_hash,hashCaptureToken(m.token));
  assert.equal(JSON.stringify(m.db).includes(m.token),false);
});

test('só admin gera, vê e revoga a chave',async()=>{
  const m=memoryStore();
  assert.equal((await rotateCaptureToken({store:m.store,access:SELLER,orgId:m.A,actorId:'u'})).status,403);
  assert.equal((await captureStatus({store:m.store,access:SELLER,orgId:m.A})).status,403);
  assert.equal((await revokeCaptureTokens({store:m.store,access:SELLER,orgId:m.A,actorId:'u'})).status,403);
  assert.equal((await captureStatus({store:m.store,access:ADMIN,orgId:m.A})).body.active,false);
});

test('qualificação: quente, morno e frio pela regra; temperatura do formulário vale',()=>{
  const v=b=>validateCapture(b).value;
  assert.deepEqual(qualify(v({whatsapp:'48999991111',answers:{urgencia:'Esta semana'},message:'Quero fazer o exame de vista'})).temperature,'hot');
  assert.equal(qualify(v({whatsapp:'48999991111',answers:{urgencia:'Este mês'}})).temperature,'warm');
  assert.equal(qualify(v({email:'a@b.co'})).temperature,'cold');
  const f=qualify(v({email:'a@b.co',temperature:'quente'}));
  assert.equal(f.temperature,'hot');assert.match(f.reasons.join(),/enviada pelo formulário/);
  assert.match(validateCapture({email:'a@b.co',temperature:'fervendo'}).error,/quente, morno ou frio/);
  assert.match(validateCapture({name:'Sem contato'}).error,/whatsapp, email ou instagram/);
});

test('cria contato e lead na 1ª etapa com UTM/anúncio, nota com o porquê e trilha',async()=>{
  const m=await withToken();
  const r=await captureLead({store:m.store,authorization:m.auth,body:{
    name:'Ana Souza',whatsapp:'(48) 99999-1111',email:'Ana@Example.com',organization_id:m.B,
    utm_source:'instagram',utm_campaign:'exame-gratis',ad_name:'Video 01',answers:{urgencia:'hoje',interesse:'Óculos de grau'}}});
  assert.equal(r.status,201);assert.equal(r.body.temperature,'hot');
  const lead=m.db.leads[0];
  assert.equal(lead.organization_id,m.A); // a empresa vem da chave, não do corpo
  assert.equal(lead.pipeline_stage_id,'stage-a1');
  assert.equal(lead.utm_campaign,'exame-gratis');assert.equal(lead.ad_name,'Video 01');
  assert.equal(m.db.contacts[0].whatsapp,'5548999991111');assert.equal(m.db.contacts[0].email,'ana@example.com');
  assert.match(m.db.notes[0].content,/Quente \(\d+\/100\)/);assert.match(m.db.notes[0].content,/interesse: Óculos de grau/);
  assert.equal(m.db.history.length,1);
});

test('mesmo contato com atendimento aberto: não duplica, registra e só esquenta',async()=>{
  const m=await withToken();
  await captureLead({store:m.store,authorization:m.auth,body:{whatsapp:'48999991111'}});
  assert.equal(m.db.leads[0].temperature,'cold');
  const r=await captureLead({store:m.store,authorization:m.auth,body:{whatsapp:'5548999991111',answers:{urgencia:'agora'},message:'Preciso urgente de lentes novas'}});
  assert.equal(r.body.status,'existing');assert.equal(m.db.leads.length,1);assert.equal(m.db.contacts.length,1);
  assert.equal(m.db.leads[0].temperature,'hot');
  await captureLead({store:m.store,authorization:m.auth,body:{whatsapp:'48999991111',temperature:'frio'}});
  assert.equal(m.db.leads[0].temperature,'hot'); // nunca esfria sozinho
  assert.equal(m.db.notes.length,3);
});

test('chave revogada, ausente ou errada não cria nada; empresa sem funil recebe 409',async()=>{
  const m=await withToken();
  assert.equal((await captureLead({store:m.store,authorization:'',body:{email:'a@b.co'}})).status,401);
  assert.equal((await captureLead({store:m.store,authorization:'Bearer nxl_'+'x'.repeat(43),body:{email:'a@b.co'}})).status,401);
  await revokeCaptureTokens({store:m.store,access:ADMIN,orgId:m.A,actorId:'u1'});
  assert.equal((await captureLead({store:m.store,authorization:m.auth,body:{email:'a@b.co'}})).status,401);
  assert.equal(m.db.leads.length,0);
  const b=await rotateCaptureToken({store:m.store,access:ADMIN,orgId:m.B,actorId:'u2'});
  const r=await captureLead({store:m.store,authorization:'Bearer '+b.body.token,body:{email:'a@b.co'}});
  assert.equal(r.status,409);
});

test('Instagram: comenta a palavra cria lead só com o @, sem duplicar e completando contato existente',async()=>{
  const m=await withToken();
  assert.match(validateCapture({instagram:'nome com espaço'}).error,/instagram inválido/);
  const r=await captureLead({store:m.store,authorization:m.auth,body:{instagram:'@Otica.Visao',keyword:'EXAME',post_url:'https://www.instagram.com/p/X1/',source:'Instagram: comentou EXAME'}});
  assert.equal(r.status,201);
  assert.equal(m.db.contacts[0].instagram,'otica.visao');
  assert.equal(m.db.contacts[0].first_name,'@otica.visao');
  assert.equal(r.body.temperature,'cold'); // 10 (Instagram) + 15 (comentou) = 25
  assert.match(m.db.notes[0].content,/Instagram: @otica\.visao \(https:\/\/www\.instagram\.com\/otica\.visao\/\) · comentou "EXAME"/);
  // mesma pessoa manda depois o WhatsApp pelo direct: mesmo lead, esquenta
  const r2=await captureLead({store:m.store,authorization:m.auth,body:{instagram:'otica.visao',whatsapp:'48999990000',answers:{urgencia:'hoje'}}});
  assert.equal(r2.body.status,'existing');assert.equal(m.db.leads.length,1);assert.equal(m.db.leads[0].temperature,'hot');
  // contato que já existia pelo WhatsApp ganha o @
  const m2=await withToken();
  await captureLead({store:m2.store,authorization:m2.auth,body:{whatsapp:'48911112222'}});
  await captureLead({store:m2.store,authorization:m2.auth,body:{whatsapp:'48911112222',instagram:'cliente.antigo'}});
  assert.equal(m2.db.contacts.length,1);assert.equal(m2.db.contacts[0].instagram,'cliente.antigo');
});
