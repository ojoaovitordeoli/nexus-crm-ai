// Migração 20261116 (indicação) em Postgres local (PGlite): coluna opcional, trava entre empresas,
// proibição de auto-indicação, exclusão do indicador e rollback. Não conecta ao Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';

const file=name=>readFileSync(fileURLToPath(new URL('../supabase/'+name,import.meta.url)),'utf8');
const A='aaaaaaaa-0000-4000-8000-000000000000',B='bbbbbbbb-0000-4000-8000-000000000000';
const ANA='a1000000-0000-4000-8000-000000000001',CAIO='a2000000-0000-4000-8000-000000000002';
const BRUNO='b1000000-0000-4000-8000-000000000001';
const LEAD='c1000000-0000-4000-8000-000000000001';
// Esquema mínimo com as colunas que a migração usa (o banco real tem mais).
const base=`
create role anon nologin; create role authenticated nologin;
create table public.organizations(id uuid primary key, name text);
create table public.contacts(id uuid primary key, organization_id uuid not null references public.organizations(id), first_name text);
create table public.leads(id uuid primary key, organization_id uuid not null references public.organizations(id),
  contact_id uuid references public.contacts(id), source text);
insert into organizations values ('${A}','Ótica A'),('${B}','Clínica B');
insert into contacts values ('${ANA}','${A}','Ana'),('${CAIO}','${A}','Caio'),('${BRUNO}','${B}','Bruno');
insert into leads values ('${LEAD}','${A}','${CAIO}','Instagram');
`;
async function fresh(){const db=new PGlite();await db.exec(base);await db.exec(file('20261116_leads_indicacao.sql'));return db}

test('lead existente segue intacto e a indicação começa vazia',async()=>{
  const db=await fresh();
  const r=await db.query(`select source,referred_by_contact_id from leads where id='${LEAD}'`);
  assert.deepEqual(r.rows[0],{source:'Instagram',referred_by_contact_id:null});
});

test('indicação por contato da mesma empresa é aceita (update e insert)',async()=>{
  const db=await fresh();
  await db.exec(`update leads set referred_by_contact_id='${ANA}' where id='${LEAD}'`);
  await db.exec(`insert into leads values ('c2000000-0000-4000-8000-000000000002','${A}','${ANA}','Indicação','${CAIO}')`);
  const r=await db.query(`select count(*)::int n from leads where referred_by_contact_id is not null`);
  assert.equal(r.rows[0].n,2);
});

test('contato de OUTRA empresa não pode ser o indicador',async()=>{
  const db=await fresh();
  await assert.rejects(db.exec(`update leads set referred_by_contact_id='${BRUNO}' where id='${LEAD}'`),/outra organização/);
});

test('o contato não pode indicar a si mesmo',async()=>{
  const db=await fresh();
  await assert.rejects(db.exec(`update leads set referred_by_contact_id='${CAIO}' where id='${LEAD}'`),/a si mesmo/);
});

test('mover o lead para outra empresa com indicador antigo é barrado',async()=>{
  const db=await fresh();
  await db.exec(`update leads set referred_by_contact_id='${ANA}' where id='${LEAD}'`);
  await assert.rejects(db.exec(`update leads set organization_id='${B}', contact_id='${BRUNO}' where id='${LEAD}'`),/outra organização/);
});

test('excluir o contato indicador só limpa a indicação (lead fica)',async()=>{
  const db=await fresh();
  await db.exec(`update leads set referred_by_contact_id='${ANA}' where id='${LEAD}'`);
  await db.exec(`delete from contacts where id='${ANA}'`);
  const r=await db.query(`select referred_by_contact_id from leads where id='${LEAD}'`);
  assert.equal(r.rows[0].referred_by_contact_id,null);
});

test('função da trava não pode ser chamada por anon/authenticated',async()=>{
  const db=await fresh();
  const r=await db.query(`select has_function_privilege('anon','public.leads_referral_guard()','execute') a,
    has_function_privilege('authenticated','public.leads_referral_guard()','execute') b`);
  assert.deepEqual(r.rows[0],{a:false,b:false});
});

test('rollback remove coluna, índice, gatilho e função sem tocar no resto do lead',async()=>{
  const db=await fresh();
  await db.exec(`update leads set referred_by_contact_id='${ANA}' where id='${LEAD}'`);
  await db.exec(file('20261116_leads_indicacao_rollback.sql'));
  const col=await db.query(`select count(*)::int n from information_schema.columns where table_name='leads' and column_name='referred_by_contact_id'`);
  const fn=await db.query(`select count(*)::int n from pg_proc where proname='leads_referral_guard'`);
  const lead=await db.query(`select source from leads where id='${LEAD}'`);
  assert.equal(col.rows[0].n,0);assert.equal(fn.rows[0].n,0);assert.equal(lead.rows[0].source,'Instagram');
  await db.exec(file('20261116_leads_indicacao.sql')); // reaplicar depois do rollback funciona
});
