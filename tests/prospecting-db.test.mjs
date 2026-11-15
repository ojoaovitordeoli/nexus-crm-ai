// Migração V34 em Postgres local (PGlite): RLS, privilégios, deduplicação, trava entre empresas e rollback.
// Não conecta ao Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';

const file=name=>readFileSync(fileURLToPath(new URL('../supabase/'+name,import.meta.url)),'utf8');
const A='aaaaaaaa-0000-4000-8000-000000000000',B='bbbbbbbb-0000-4000-8000-000000000000';
const U='00000000-0000-4000-8000-00000000000a';
const base=`
create role anon nologin; create role authenticated nologin;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table public.organizations(id uuid primary key, name text, status text default 'active');
create table public.organization_members(organization_id uuid, user_id uuid, role text, status text default 'active');
grant usage on schema public to anon, authenticated;
grant select,insert,update,delete on all tables in schema public to anon, authenticated;
alter default privileges in schema public grant select,insert,update,delete on tables to anon, authenticated;
insert into auth.users values ('${U}');
insert into organizations(id,name) values ('${A}','Ótica A'),('${B}','Clínica B');
insert into organization_members values ('${A}','${U}','ORGANIZATION_ADMIN','active');
`;
const tokenA='a'.repeat(64),tokenB='b'.repeat(64);
async function fresh(){
  const db=new PGlite();await db.exec(base);await db.exec(file('20261115_prospeccao_notificacoes.sql'));
  await db.exec(`insert into prospecting_ingest_tokens(id,organization_id,token_hash,token_hint) values
    ('10000000-0000-4000-8000-000000000000','${A}','${tokenA}','abc123'),('20000000-0000-4000-8000-000000000000','${B}','${tokenB}','def456');`);
  return db;
}
const insertAlert=(org,token,ext='m1')=>`insert into prospecting_alerts(organization_id,source,channel,kind,external_id,company_name,occurred_at,token_id)
  values ('${org}','harvey_email','email','interesse','${ext}','Ótica',now(),${token?`'${token}'`:'null'})`;
async function as(db,role,sql){
  await db.exec(`begin; select set_config('request.jwt.claim.sub','${U}',true); set local role ${role};`);
  try{const r=await db.query(sql);return {ok:true,rows:r.rows}}catch(e){return {ok:false,error:e.message}}finally{await db.exec('rollback;')}
}

test('tabelas da prospecção são somente servidor: anon e authenticated não leem nem gravam',async()=>{
  const db=await fresh();
  await db.exec(insertAlert(A,'10000000-0000-4000-8000-000000000000'));
  for(const role of ['anon','authenticated']){
    for(const sql of ['select * from prospecting_alerts','select * from prospecting_ingest_tokens',insertAlert(A,null,'x'),
      `update prospecting_alerts set status='resolvido'`,`delete from prospecting_ingest_tokens`]){
      const r=await as(db,role,sql);
      assert.equal(r.ok,false,role+': '+sql);assert.match(r.error,/permission denied/);
    }
  }
  const rls=await db.query(`select relname,relrowsecurity from pg_class where relname in ('prospecting_alerts','prospecting_ingest_tokens')`);
  assert.equal(rls.rows.every(r=>r.relrowsecurity),true);
  const pol=await db.query(`select count(*)::int n from pg_policies where tablename like 'prospecting_%'`).catch(()=>({rows:[{n:0}]}));
  assert.equal(pol.rows[0].n,0);
});

test('deduplicação por empresa + origem + id externo',async()=>{
  const db=await fresh();
  await db.exec(insertAlert(A,null));
  await assert.rejects(db.exec(insertAlert(A,null)),/duplicate key|prospecting_alerts_dedupe/);
  await db.exec(insertAlert(B,null)); // mesmo id externo em outra empresa é permitido
  const r=await db.query(`select count(*)::int n from prospecting_alerts`);assert.equal(r.rows[0].n,2);
});

test('aviso não pode apontar para token de outra empresa',async()=>{
  const db=await fresh();
  await assert.rejects(db.exec(insertAlert(A,'20000000-0000-4000-8000-000000000000')),/outra organização/);
  await db.exec(insertAlert(A,'10000000-0000-4000-8000-000000000000'));
  await assert.rejects(db.exec(`update prospecting_alerts set organization_id='${B}'`),/outra organização/);
});

test('valores inválidos são barrados pelo banco',async()=>{
  const db=await fresh();
  for(const bad of [
    insertAlert(A,null).replace("'interesse'","'xpto'"),
    insertAlert(A,null).replace("'email','interesse'","'sms','interesse'"),
    `insert into prospecting_ingest_tokens(organization_id,token_hash,token_hint) values ('${A}','nao-e-hash','abcd')`,
    `insert into prospecting_alerts(organization_id,source,channel,kind,external_id,contact_phone,occurred_at) values ('${A}','whatsapp_agent','whatsapp','venda','z','11-9999',now())`
  ])await assert.rejects(db.exec(bad));
});

test('rollback remove tudo e a migração pode ser reaplicada',async()=>{
  const db=await fresh();
  await db.exec(file('20261115_prospeccao_notificacoes_rollback.sql'));
  const r=await db.query(`select count(*)::int n from pg_class where relname like 'prospecting_%' and relkind='r'`);
  assert.equal(r.rows[0].n,0);
  await db.exec(file('20261115_prospeccao_notificacoes.sql'));
  await db.exec(file('20261115_prospeccao_notificacoes.sql')); // idempotente
  const again=await db.query(`select count(*)::int n from pg_class where relname like 'prospecting_%' and relkind='r'`);
  assert.equal(again.rows[0].n,2);
});
