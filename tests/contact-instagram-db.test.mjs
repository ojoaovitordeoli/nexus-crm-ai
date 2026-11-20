// Migração V47 (Instagram no contato) em PGlite: formato, único por empresa entre contatos ativos e rollback.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';

const file=name=>readFileSync(fileURLToPath(new URL('../supabase/'+name,import.meta.url)),'utf8');
const A='aaaaaaaa-0000-4000-8000-000000000000',B='bbbbbbbb-0000-4000-8000-000000000000';
const base=`create table public.organizations(id uuid primary key);
create table public.contacts(id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
  first_name text, deleted_at timestamptz);
insert into organizations values ('${A}'),('${B}');
insert into contacts(organization_id,first_name) values ('${A}','Antigo');`;
async function fresh(){const db=new PGlite();await db.exec(base);await db.exec(file('20261117_contato_instagram.sql'));return db}

test('contato antigo fica intacto e o @ começa vazio',async()=>{
  const db=await fresh();
  const r=await db.query(`select first_name,instagram from contacts`);
  assert.deepEqual(r.rows[0],{first_name:'Antigo',instagram:null});
});
test('formato: só minúsculas, números, ponto e _ (sem @)',async()=>{
  const db=await fresh();
  await db.exec(`insert into contacts(organization_id,instagram) values ('${A}','otica.visao')`);
  for(const bad of ['@otica','Otica','com espaço','x'.repeat(31)])
    await assert.rejects(db.exec(`insert into contacts(organization_id,instagram) values ('${A}','${bad}')`),/check/);
});
test('mesmo @ não duplica na empresa; em outra empresa ou após excluir, pode',async()=>{
  const db=await fresh();
  await db.exec(`insert into contacts(organization_id,instagram) values ('${A}','otica.visao')`);
  await assert.rejects(db.exec(`insert into contacts(organization_id,instagram) values ('${A}','otica.visao')`),/duplicate key/);
  await db.exec(`insert into contacts(organization_id,instagram) values ('${B}','otica.visao')`);
  await db.exec(`update contacts set deleted_at=now() where organization_id='${A}' and instagram='otica.visao'`);
  await db.exec(`insert into contacts(organization_id,instagram) values ('${A}','otica.visao')`);
});
test('rollback remove a coluna e pode reaplicar',async()=>{
  const db=await fresh();
  await db.exec(file('20261117_contato_instagram_rollback.sql'));
  const r=await db.query(`select count(*)::int n from information_schema.columns where table_name='contacts' and column_name='instagram'`);
  assert.equal(r.rows[0].n,0);
  await db.exec(file('20261117_contato_instagram.sql'));
});
