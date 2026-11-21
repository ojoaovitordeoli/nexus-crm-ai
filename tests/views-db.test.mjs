// Migração V51 (Minhas telas) em PGlite: cada pessoa só vê e mexe nas próprias telas, só na empresa em que é membro ativo.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';

const file = name => readFileSync(fileURLToPath(new URL('../supabase/' + name, import.meta.url)), 'utf8');
const ORG_A = 'aaaaaaaa-0000-4000-8000-000000000000', ORG_B = 'bbbbbbbb-0000-4000-8000-000000000000';
const ANA = 'a1a1a1a1-0000-4000-8000-000000000000', BETO = 'b2b2b2b2-0000-4000-8000-000000000000', EX = 'c3c3c3c3-0000-4000-8000-000000000000';
const base = `
create role authenticated nologin; create role anon nologin;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant usage on schema public to authenticated, anon;
create table public.organizations(id uuid primary key);
create table public.organization_members(organization_id uuid, user_id uuid, role text, status text default 'active');
create function public.is_org_member(org_id uuid) returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select exists (select 1 from public.organization_members om where om.organization_id = org_id and om.user_id = auth.uid() and om.status = 'active'); $$;
insert into organizations values ('${ORG_A}'),('${ORG_B}');
insert into auth.users values ('${ANA}'),('${BETO}'),('${EX}');
insert into organization_members values ('${ORG_A}','${ANA}','SELLER','active'),('${ORG_A}','${BETO}','MANAGER','active'),('${ORG_B}','${BETO}','SELLER','active'),('${ORG_A}','${EX}','SELLER','inactive');`;

async function fresh() {
  const db = new PGlite(); await db.exec(base); await db.exec(file('20261121_v51_minhas_telas.sql'));
  await db.exec(`insert into user_views(organization_id,user_id,name,spec) values
    ('${ORG_A}','${ANA}','Leads quentes','{"tipo":"lista"}'),('${ORG_A}','${BETO}','Vendas do Beto','{"tipo":"numero"}'),
    ('${ORG_B}','${BETO}','Beto na empresa B','{"tipo":"lista"}'),('${ORG_A}','${EX}','Do ex-funcionário','{"tipo":"lista"}')`);
  return db;
}
async function como(db, uid, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`);
  try { return await db.query(sql); } finally { await db.exec(`reset role;`); }
}

test('cada pessoa vê só as próprias telas', async () => {
  const db = await fresh();
  const ana = await como(db, ANA, `select name from user_views order by name`);
  assert.deepEqual(ana.rows.map(r => r.name), ['Leads quentes']);
  const beto = await como(db, BETO, `select name from user_views order by name`);
  assert.deepEqual(beto.rows.map(r => r.name), ['Beto na empresa B', 'Vendas do Beto']);
});

test('membro inativo perde acesso às próprias telas', async () => {
  const db = await fresh();
  const r = await como(db, EX, `select name from user_views`);
  assert.equal(r.rows.length, 0);
});

test('não dá para criar tela em nome de outra pessoa nem em empresa de que não é membro', async () => {
  const db = await fresh();
  await assert.rejects(como(db, ANA, `insert into user_views(organization_id,user_id,name,spec) values ('${ORG_A}','${BETO}','x','{}')`), /row-level security/);
  await assert.rejects(como(db, ANA, `insert into user_views(organization_id,user_id,name,spec) values ('${ORG_B}','${ANA}','x','{}')`), /row-level security/);
  await como(db, ANA, `insert into user_views(organization_id,user_id,name,spec) values ('${ORG_A}','${ANA}','Minha nova','{"tipo":"grafico"}')`);
});

test('não dá para apagar nem renomear a tela de outra pessoa', async () => {
  const db = await fresh();
  await como(db, ANA, `delete from user_views where name='Vendas do Beto'`);
  await como(db, ANA, `update user_views set name='hack' where name='Vendas do Beto'`);
  const r = await db.query(`select name from user_views where user_id='${BETO}' and organization_id='${ORG_A}'`);
  assert.deepEqual(r.rows.map(x => x.name), ['Vendas do Beto']);
});

test('receita precisa ser objeto e nome tem limite', async () => {
  const db = await fresh();
  await assert.rejects(db.exec(`insert into user_views(organization_id,user_id,name,spec) values ('${ORG_A}','${ANA}','x','[1,2]')`), /check/);
  await assert.rejects(db.exec(`insert into user_views(organization_id,user_id,name,spec) values ('${ORG_A}','${ANA}','${'x'.repeat(81)}','{}')`), /check/);
});

test('anônimo não lê nada', async () => {
  const db = await fresh();
  await db.exec(`set role anon;`);
  await assert.rejects(db.query(`select * from user_views`), /permission denied/);
  await db.exec(`reset role;`);
});

test('rollback remove a tabela e pode reaplicar', async () => {
  const db = await fresh();
  await db.exec(file('20261121_v51_minhas_telas_rollback.sql'));
  const r = await db.query(`select count(*)::int n from information_schema.tables where table_name='user_views'`);
  assert.equal(r.rows[0].n, 0);
  await db.exec(file('20261121_v51_minhas_telas.sql'));
});
