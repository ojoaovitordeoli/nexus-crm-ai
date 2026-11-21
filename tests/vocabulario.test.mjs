import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {detectarRamo, vocabulario, instrucaoVocabulario, ramoValido, RAMOS} from '../lib/vocabulario.mjs';
import {toolNamesFor} from '../lib/assistant/rules.mjs';

test('texto livre do ramo é reconhecido; o que não der vira geral', () => {
  assert.equal(detectarRamo('Ótica Visão'), 'otica');
  assert.equal(detectarRamo('Clínica de fisioterapia'), 'clinica');
  assert.equal(detectarRamo('odontologia'), 'odontologia');
  assert.equal(detectarRamo('Proteção veicular / associação'), 'geral');
  assert.equal(detectarRamo('agency'), 'geral');
  assert.equal(detectarRamo(null), 'geral');
});

test('vocabulário sempre completo e com as palavras do ramo', () => {
  const c = vocabulario('clinica');
  assert.equal(c.clientes, 'pacientes'); assert.equal(c.agendamentos, 'consultas');
  for (const k of Object.keys(RAMOS)) for (const campo of ['cliente', 'clientes', 'agendamento', 'agendamentos', 'venda', 'vendas', 'rotulo']) assert.ok(vocabulario(k)[campo], k + '.' + campo);
  assert.equal(vocabulario('otica').sugestoes.length >= 3, true);
});

test('instrução para o assistente só existe quando há ramo', () => {
  assert.equal(instrucaoVocabulario(vocabulario('')), '');
  assert.match(instrucaoVocabulario(vocabulario('otica')), /exames de vista/);
});

test('ramo para salvar só vem da lista fixa', () => {
  assert.equal(ramoValido('Ótica'), 'otica');
  assert.equal(ramoValido("otica'; drop table organizations; --"), null);
});

test('só gerente/admin pode propor o ramo', () => {
  assert.equal(toolNamesFor('MANAGER').includes('propor_ramo'), true);
  assert.equal(toolNamesFor('SELLER').includes('propor_ramo'), false);
  assert.equal(toolNamesFor('VIEWER').includes('propor_ramo'), false);
});

const file = name => readFileSync(fileURLToPath(new URL('../supabase/' + name, import.meta.url)), 'utf8');
test('migração V53: on_home começa falso, respeita o RLS da V51 e tem rollback', async () => {
  const A = 'aaaaaaaa-0000-4000-8000-000000000000', ANA = 'a1a1a1a1-0000-4000-8000-000000000000', BETO = 'b2b2b2b2-0000-4000-8000-000000000000';
  const db = new PGlite();
  await db.exec(`create role authenticated nologin; create role anon nologin; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth to authenticated; grant usage on schema public to authenticated;
    create table public.organizations(id uuid primary key);
    create table public.organization_members(organization_id uuid, user_id uuid, role text, status text default 'active');
    create function public.is_org_member(org_id uuid) returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
      select exists (select 1 from public.organization_members om where om.organization_id = org_id and om.user_id = auth.uid() and om.status = 'active'); $$;
    insert into organizations values ('${A}'); insert into auth.users values ('${ANA}'),('${BETO}');
    insert into organization_members values ('${A}','${ANA}','SELLER','active'),('${A}','${BETO}','SELLER','active');`);
  await db.exec(file('20261121_v51_minhas_telas.sql'));
  await db.exec(`insert into user_views(organization_id,user_id,name,spec) values ('${A}','${BETO}','Do Beto','{"tipo":"lista"}')`);
  await db.exec(file('20261121_v53_telas_na_inicial.sql'));
  assert.equal((await db.query(`select on_home from user_views`)).rows[0].on_home, false);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${ANA}',false); update user_views set on_home=true; reset role;`);
  assert.equal((await db.query(`select on_home from user_views`)).rows[0].on_home, false, 'Ana não fixa tela do Beto');
  await db.exec(file('20261121_v53_telas_na_inicial_rollback.sql'));
  assert.equal((await db.query(`select count(*)::int n from information_schema.columns where table_name='user_views' and column_name='on_home'`)).rows[0].n, 0);
});
