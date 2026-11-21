// Migração V42 (captura de leads) em Postgres local (PGlite): tabela só do servidor, formato do hash e rollback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';

const file=name=>readFileSync(fileURLToPath(new URL('../supabase/'+name,import.meta.url)),'utf8');
const A='aaaaaaaa-0000-4000-8000-000000000000';
const base=`
create role anon nologin; create role authenticated nologin; create role service_role nologin;
create schema auth; create table auth.users(id uuid primary key);
create table public.organizations(id uuid primary key, name text, status text default 'active');
grant usage on schema public to anon, authenticated;
alter default privileges in schema public grant select,insert,update,delete on tables to anon, authenticated;
insert into organizations(id,name) values ('${A}','Ótica A');
`;
async function fresh(){const db=new PGlite();await db.exec(base);await db.exec(file('20261116_captura_leads.sql'));return db}
async function as(db,role,sql){
  await db.exec(`begin; set local role ${role};`);
  try{await db.query(sql);return {ok:true}}catch(e){return {ok:false,error:e.message}}finally{await db.exec('rollback;')}
}

test('chaves de captura: anon e authenticated não leem nem gravam',async()=>{
  const db=await fresh();
  await db.exec(`insert into lead_capture_tokens(organization_id,token_hash,token_hint) values ('${A}','${'a'.repeat(64)}','abc123')`);
  for(const role of ['anon','authenticated'])
    for(const sql of ['select * from lead_capture_tokens',`update lead_capture_tokens set revoked_at=now()`,`delete from lead_capture_tokens`]){
      const r=await as(db,role,sql);assert.equal(r.ok,false,role+': '+sql);assert.match(r.error,/permission denied/);
    }
  const rls=await db.query(`select relrowsecurity from pg_class where relname='lead_capture_tokens'`);
  assert.equal(rls.rows[0].relrowsecurity,true);
});

test('só hash SHA-256 é aceito e cada hash é único',async()=>{
  const db=await fresh();
  await assert.rejects(db.exec(`insert into lead_capture_tokens(organization_id,token_hash,token_hint) values ('${A}','nxl_textoaberto','abc123')`),/check/);
  await db.exec(`insert into lead_capture_tokens(organization_id,token_hash,token_hint) values ('${A}','${'b'.repeat(64)}','abc123')`);
  await assert.rejects(db.exec(`insert into lead_capture_tokens(organization_id,token_hash,token_hint) values ('${A}','${'b'.repeat(64)}','zzz999')`),/duplicate key/);
});

test('rollback remove a tabela e pode ser reaplicado',async()=>{
  const db=await fresh();
  await db.exec(file('20261116_captura_leads_rollback.sql'));
  const r=await db.query(`select count(*)::int n from pg_class where relname='lead_capture_tokens'`);
  assert.equal(r.rows[0].n,0);
  await db.exec(file('20261116_captura_leads.sql'));
});
