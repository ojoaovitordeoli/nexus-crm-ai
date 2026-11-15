import test from 'node:test';
import assert from 'node:assert/strict';
import {canSeeProspecting,changeStatus,generateIngestToken,hashIngestToken,ingestAlerts,listForMember,
  normalizePhone,parseIngestBody,readIngestToken,revokeAll,rotateToken,validateAlert,whatsAppLink} from '../lib/prospecting-alerts.mjs';

// Store em memória com o mesmo contrato do Supabase: tudo filtrado por organization_id.
function memoryStore(){
  const tokens=[],alerts=[],audits=[];let n=0;
  const uuid=()=>'00000000-0000-4000-8000-'+String(++n).padStart(12,'0');
  return {tokens,alerts,audits,
    async findActiveToken(hash){const t=tokens.find(x=>x.token_hash===hash&&!x.revoked_at);return t?{id:t.id,organization_id:t.organization_id}:null},
    async touchToken(id){tokens.find(t=>t.id===id).last_used_at=new Date().toISOString()},
    async insertAlerts(org,tokenId,rows){let inserted=0;for(const r of rows){
      if(alerts.some(a=>a.organization_id===org&&a.source===r.source&&a.external_id===r.external_id))continue;
      alerts.push({...r,id:uuid(),organization_id:org,token_id:tokenId,status:'novo'});inserted++}return {inserted}},
    async listAlerts(org,{status,channel}){return alerts.filter(a=>a.organization_id===org
      &&(status==='all'||(status==='open'?['novo','em_atendimento'].includes(a.status):a.status===status))
      &&(channel==='all'||a.channel===channel))},
    async updateAlertStatus(org,id,patch){const a=alerts.find(x=>x.organization_id===org&&x.id===id);if(!a)return null;Object.assign(a,patch);return a},
    async listTokens(org){return tokens.filter(t=>t.organization_id===org&&!t.revoked_at)},
    async createToken(org,row){tokens.push({...row,id:uuid(),organization_id:org,revoked_at:null})},
    async revokeTokens(org){tokens.filter(t=>t.organization_id===org).forEach(t=>{t.revoked_at=t.revoked_at||'now'})},
    async audit(e){audits.push(e)}};
}
const A='aaaaaaaa-0000-4000-8000-000000000000',B='bbbbbbbb-0000-4000-8000-000000000000';
const ADMIN={isSuperAdmin:false,role:'ORGANIZATION_ADMIN'},SUPER={isSuperAdmin:true,role:'AGENCY_ADMIN'};
const alert=(over={})=>({source:'harvey_email',kind:'interesse',external_id:'msg-1',company_name:'Ótica Centro',contact_name:'Ana',contact_email:'ana@exemplo.com.br',contact_phone:'(11) 98888-7777',message:'Quero saber o preço',occurred_at:'2026-11-14T10:00:00Z',...over});

test('somente Admin da empresa, Admin da agência e Super Admin veem a prospecção',()=>{
  assert.equal(canSeeProspecting(ADMIN),true);
  assert.equal(canSeeProspecting(SUPER),true);
  assert.equal(canSeeProspecting({role:'AGENCY_ADMIN'}),true);
  for(const role of ['MANAGER','SDR','SELLER','VIEWER','',undefined])assert.equal(canSeeProspecting({role}),false,role);
});

test('token: formato estrito, hash SHA-256 e nunca o texto puro',()=>{
  const t=generateIngestToken();
  assert.match(t.token,/^nxp_[A-Za-z0-9_-]{43}$/);
  assert.equal(t.hash,hashIngestToken(t.token));assert.match(t.hash,/^[0-9a-f]{64}$/);
  assert.notEqual(t.hash,t.token);assert.equal(t.hint,t.token.slice(-6));
  assert.equal(readIngestToken('Bearer '+t.token),t.token);
  for(const bad of ['',null,t.token,'Basic '+t.token,'Bearer nxp_curto','Bearer '+t.token+'x'])assert.equal(readIngestToken(bad),null);
  assert.notEqual(generateIngestToken().token,t.token);
});

test('telefone e link do WhatsApp',()=>{
  assert.equal(normalizePhone('(11) 98888-7777'),'5511988887777');
  assert.equal(normalizePhone('+55 11 98888-7777'),'5511988887777');
  assert.equal(normalizePhone('123'),null);
  assert.equal(whatsAppLink('11988887777'),'https://wa.me/5511988887777');
  assert.equal(whatsAppLink(''),null);
});

test('validação do aviso recusa dados incompletos ou forjados',()=>{
  const now=new Date('2026-11-15T00:00:00Z');
  assert.equal(validateAlert(alert(),{now}).ok,true);
  assert.equal(validateAlert(alert({source:'outro'}),{now}).ok,false);
  assert.equal(validateAlert(alert({kind:'x'}),{now}).ok,false);
  assert.equal(validateAlert(alert({external_id:' '}),{now}).ok,false);
  assert.equal(validateAlert(alert({contact_email:'sem-arroba'}),{now}).ok,false);
  assert.equal(validateAlert(alert({contact_phone:'12'}),{now}).ok,false);
  assert.equal(validateAlert(alert({occurred_at:'2027-01-01T00:00:00Z'}),{now}).ok,false);
  assert.equal(validateAlert({source:'harvey_email',kind:'interesse',external_id:'x'},{now}).ok,false);
  const v=validateAlert(alert({status:'resolvido',organization_id:B,message:'a'.repeat(5000)}),{now}).value;
  assert.equal(v.channel,'email');assert.equal(v.message_excerpt.length,2000);
  assert.equal('status' in v,false);assert.equal('organization_id' in v,false);
  assert.equal(validateAlert(alert({source:'whatsapp_agent',kind:'venda'}),{now}).value.channel,'whatsapp');
  assert.equal(parseIngestBody({alerts:Array(51).fill(alert())}).ok,false);
  assert.equal(parseIngestBody([]).ok,false);
});

test('entrada: token de uma empresa grava só nela, ignora organization_id do corpo e não duplica',async()=>{
  const store=memoryStore();
  const ra=await rotateToken({store,access:ADMIN,orgId:A,actorId:'u-a'});
  const rb=await rotateToken({store,access:ADMIN,orgId:B,actorId:'u-b'});
  assert.equal(store.tokens.some(t=>t.token_hash===ra.body.token),false,'texto puro não é guardado');
  const now=new Date('2026-11-15T00:00:00Z');
  const r1=await ingestAlerts({store,authorization:'Bearer '+ra.body.token,body:alert({organization_id:B}),now});
  assert.equal(r1.status,200);assert.equal(r1.body.created,1);
  const r2=await ingestAlerts({store,authorization:'Bearer '+ra.body.token,body:{alerts:[alert(),alert({external_id:'msg-2',kind:'pergunta'})]},now});
  assert.deepEqual([r2.body.created,r2.body.duplicates],[1,1]);
  assert.equal(store.alerts.every(a=>a.organization_id===A),true);
  // Mesmo id externo na empresa B é outro registro (não colide com A).
  const r3=await ingestAlerts({store,authorization:'Bearer '+rb.body.token,body:alert(),now});
  assert.equal(r3.body.created,1);
  assert.equal(store.alerts.filter(a=>a.organization_id===B).length,1);
});

test('entrada recusa token ausente, inválido ou revogado',async()=>{
  const store=memoryStore();
  const r=await rotateToken({store,access:ADMIN,orgId:A,actorId:'u'});
  assert.equal((await ingestAlerts({store,authorization:'',body:alert()})).status,401);
  assert.equal((await ingestAlerts({store,authorization:'Bearer '+generateIngestToken().token,body:alert()})).status,401);
  await rotateToken({store,access:ADMIN,orgId:A,actorId:'u'});
  assert.equal((await ingestAlerts({store,authorization:'Bearer '+r.body.token,body:alert()})).status,401,'token antigo revogado ao gerar outro');
  const novo=store.tokens.find(t=>!t.revoked_at);assert.ok(novo);
  await revokeAll({store,access:ADMIN,orgId:A,actorId:'u'});
  assert.equal(store.tokens.every(t=>t.revoked_at),true);
  assert.equal(store.alerts.length,0);
});

test('leitura e tratamento: acesso cruzado entre empresas e papéis sem permissão são negados',async()=>{
  const store=memoryStore();
  const ta=(await rotateToken({store,access:ADMIN,orgId:A,actorId:'u'})).body.token;
  await ingestAlerts({store,authorization:'Bearer '+ta,body:alert(),now:new Date('2026-11-15T00:00:00Z')});
  const id=store.alerts[0].id,filters={status:'open',channel:'all'};
  const own=await listForMember({store,access:ADMIN,orgId:A,filters});
  assert.equal(own.status,200);assert.equal(own.body.alerts.length,1);
  const item=own.body.alerts[0];
  assert.equal(item.whatsapp_url,'https://wa.me/5511988887777');assert.equal(item.channel,'email');
  assert.equal('token_id' in item||'organization_id' in item,false);
  assert.equal(own.body.connection.active,true);assert.equal('token_hash' in own.body.connection,false);
  // Admin da empresa B não enxerga nem altera o aviso de A.
  assert.equal((await listForMember({store,access:ADMIN,orgId:B,filters})).body.alerts.length,0);
  assert.equal((await changeStatus({store,access:ADMIN,orgId:B,actorId:'b',alertId:id,status:'resolvido'})).status,404);
  assert.equal(store.alerts[0].status,'novo');
  for(const role of ['MANAGER','SELLER','VIEWER','SDR']){
    const access={isSuperAdmin:false,role};
    assert.equal((await listForMember({store,access,orgId:A,filters})).status,403,role);
    assert.equal((await changeStatus({store,access,orgId:A,actorId:'x',alertId:id,status:'resolvido'})).status,403,role);
    assert.equal((await rotateToken({store,access,orgId:A,actorId:'x'})).status,403,role);
    assert.equal((await revokeAll({store,access,orgId:A,actorId:'x'})).status,403,role);
  }
  const ok=await changeStatus({store,access:SUPER,orgId:A,actorId:'s',alertId:id,status:'em_atendimento'});
  assert.equal(ok.status,200);assert.equal(store.alerts[0].handled_by,'s');
  assert.equal((await changeStatus({store,access:ADMIN,orgId:A,actorId:'a',alertId:id,status:'xpto'})).status,400);
  assert.equal((await changeStatus({store,access:ADMIN,orgId:A,actorId:'a',alertId:id,status:'resolvido'})).status,200);
  assert.equal((await listForMember({store,access:ADMIN,orgId:A,filters})).body.alerts.length,0,'resolvido sai de "em aberto"');
  assert.equal(store.audits.filter(a=>a.action==='prospecting_alert.status').length,2);
});
