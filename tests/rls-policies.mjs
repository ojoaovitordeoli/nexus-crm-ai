// npm run test:rls — Postgres em memória (PGlite). Não conecta ao Supabase.
// Reproduz as funções/políticas reais do Supabase (07/11/2026) e testa a migração P0.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
const root=new URL('..',import.meta.url).pathname;
const migrationPath=root+'supabase/20261107_p0_rls_role_hardening.sql';
const rollbackPath=root+'supabase/20261107_p0_rls_role_hardening_rollback.sql';
const origPoliciesPath=root+'tests/fixtures/rls-production-policies-20261107.sql';
const db=new PGlite();
const orgTables=['activities','ad_metrics','ai_conversations','ai_summaries','appointments','campaigns','contacts','conversations','files','leads','messages','notes','sales','tags','tasks','audit_logs','pipelines','automation_flows','custom_fields'];
let base=`
create role anon nologin; create role authenticated nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon, authenticated;
create table public.organizations(id uuid primary key, name text, slug text, plan text, user_limit int, lead_limit int, modules jsonb, status text default 'active');
create table public.profiles(id uuid primary key, full_name text, is_super_admin boolean default false, status text default 'active', updated_at timestamptz);
create table public.organization_members(id uuid primary key default gen_random_uuid(), organization_id uuid, user_id uuid, role text, status text default 'active');
${orgTables.map(t=>`create table public.${t}(id uuid primary key default gen_random_uuid(), organization_id uuid, title text);`).join('\n')}
create table public.pipeline_stages(id uuid primary key default gen_random_uuid(), pipeline_id uuid, name text);
create table public.automation_nodes(id uuid primary key default gen_random_uuid(), flow_id uuid);
create table public.lead_stage_history(id uuid primary key default gen_random_uuid(), lead_id uuid, to_stage_id uuid);
create table public.lead_tags(lead_id uuid, tag_id uuid);
create table public.custom_field_values(id uuid primary key default gen_random_uuid(), custom_field_id uuid, value text);
create function public.is_org_member(org_id uuid) returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select exists (select 1 from public.organization_members om where om.organization_id = org_id and om.user_id = auth.uid() and om.status = 'active'); $$;
create function public.is_org_admin(org_id uuid) returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select exists (select 1 from public.organization_members om where om.organization_id = org_id and om.user_id = auth.uid() and om.status = 'active' and om.role in ('AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER')); $$;
create function public.is_super_admin() returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true); $$;
create function public.get_user_orgs() returns table(organization_id uuid) language sql stable security definer set search_path to 'public','pg_temp' as $$
  select om.organization_id from public.organization_members om where om.user_id = auth.uid() and om.status='active'; $$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$ begin return new; end; $$;
create function public.rls_auto_enable() returns event_trigger language plpgsql security definer set search_path to 'pg_catalog' as $$ begin end; $$;
create function public.admin_create_organization(p_name text, p_plan text, p_slug text) returns uuid language plpgsql security definer set search_path to '' as $$ begin return null; end; $$;
create function public.update_updated_at_column() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
`;
const all=['organizations','profiles','organization_members',...orgTables,'pipeline_stages','automation_nodes','lead_stage_history','lead_tags','custom_field_values'];
base+=all.map(t=>`alter table public.${t} enable row level security; grant select,insert,update,delete on public.${t} to authenticated;`).join('\n');
// leitura (inalterada pela migração) para conseguir observar resultados
base+=orgTables.map(t=>`\ncreate policy members_read_${t} on public.${t} for select to authenticated using (is_org_member(organization_id) or is_super_admin());`).join('');
base+=`
create policy members_read_org_memberships on public.organization_members for select to authenticated using (user_id = auth.uid() or is_org_member(organization_id) or is_super_admin());
create policy members_read_organizations on public.organizations for select to authenticated using (is_org_member(id) or is_super_admin());
create policy users_read_own_profile on public.profiles for select to authenticated using (auth.uid() = id or is_super_admin());
create policy users_update_own_profile on public.profiles for update to authenticated using ((auth.uid() = id) or is_super_admin())
  with check (((auth.uid() = id) and (not (is_super_admin is distinct from (select p.is_super_admin from profiles p where p.id = auth.uid())))) or is_super_admin());
create policy members_read_pipeline_stages on public.pipeline_stages for select to authenticated using (exists (select 1 from pipelines p where p.id = pipeline_id and (is_org_member(p.organization_id) or is_super_admin())));
create policy members_read_lead_history on public.lead_stage_history for select to authenticated using (exists (select 1 from leads l where l.id = lead_id and (is_org_member(l.organization_id) or is_super_admin())));
`;
base+=readFileSync(origPoliciesPath,'utf8');

const U={super:'00000000-0000-4000-8000-000000000001',orgAdminA:'00000000-0000-4000-8000-00000000000a',managerA:'00000000-0000-4000-8000-00000000000b',
  sellerA:'00000000-0000-4000-8000-00000000000c',viewerA:'00000000-0000-4000-8000-00000000000d',managerB:'00000000-0000-4000-8000-00000000000e',
  suspended:'00000000-0000-4000-8000-00000000000f',outsider:'00000000-0000-4000-8000-000000000010'};
const A='aaaaaaaa-0000-4000-8000-000000000000',B='bbbbbbbb-0000-4000-8000-000000000000';
const seed=`
insert into organizations(id,name,slug,plan,status) values ('${A}','Ótica A','a','pro','active'),('${B}','Clínica B','b','pro','active');
insert into profiles(id,full_name,is_super_admin,status) values
 ('${U.super}','Super',true,'active'),('${U.orgAdminA}','AdmA',false,'active'),('${U.managerA}','GerA',false,'active'),
 ('${U.sellerA}','VendA',false,'active'),('${U.viewerA}','LeitA',false,'active'),('${U.managerB}','GerB',false,'active'),
 ('${U.suspended}','Susp',false,'suspended'),('${U.outsider}','Fora',false,'active');
insert into organization_members(organization_id,user_id,role) values
 ('${A}','${U.orgAdminA}','ORGANIZATION_ADMIN'),('${A}','${U.managerA}','MANAGER'),('${A}','${U.sellerA}','SELLER'),
 ('${A}','${U.viewerA}','VIEWER'),('${B}','${U.managerB}','MANAGER'),('${A}','${U.suspended}','SELLER');
insert into leads(id,organization_id,title) values ('11111111-0000-4000-8000-000000000000','${A}','Lead A'),('22222222-0000-4000-8000-000000000000','${B}','Lead B');
insert into pipelines(id,organization_id,title) values ('33333333-0000-4000-8000-000000000000','${A}','Funil A');
insert into pipeline_stages(id,pipeline_id,name) values ('44444444-0000-4000-8000-000000000000','33333333-0000-4000-8000-000000000000','Novo');
`;
async function as(user,sql){
  // transação descartável: o papel e o JWT simulado valem só dentro dela
  await db.exec(`begin; select set_config('request.jwt.claim.sub','${user||''}',true); set local role authenticated;`);
  try{const r=await db.query(sql);return {ok:true,rows:r.rows,affected:r.affectedRows??0}}
  catch(e){return {ok:false,error:e.message}}
  finally{await db.exec('rollback;')}
}
const cases=[
  // [descrição, usuário, sql, esperado: 'allow'|'deny']
  ['VIEWER não cria tarefa',U.viewerA,`insert into tasks(organization_id,title) values ('${A}','x')`,'deny'],
  ['VIEWER não altera lead',U.viewerA,`update leads set title='hack' where organization_id='${A}'`,'deny'],
  ['VIEWER não registra venda',U.viewerA,`insert into sales(organization_id,title) values ('${A}','1')`,'deny'],
  ['SELLER cria tarefa na própria empresa',U.sellerA,`insert into tasks(organization_id,title) values ('${A}','ok')`,'allow'],
  ['SELLER altera lead da própria empresa',U.sellerA,`update leads set title='ok' where organization_id='${A}'`,'allow'],
  ['SELLER registra histórico de etapa',U.sellerA,`insert into lead_stage_history(lead_id,to_stage_id) values ('11111111-0000-4000-8000-000000000000','44444444-0000-4000-8000-000000000000')`,'allow'],
  ['VIEWER não registra histórico de etapa',U.viewerA,`insert into lead_stage_history(lead_id) values ('11111111-0000-4000-8000-000000000000')`,'deny'],
  ['SELLER não cria tarefa em outra empresa',U.sellerA,`insert into tasks(organization_id,title) values ('${B}','x')`,'deny'],
  ['Gerente B não altera lead da empresa A',U.managerB,`update leads set title='x' where organization_id='${A}'`,'deny'],
  ['SELLER não altera estrutura do funil',U.sellerA,`insert into pipeline_stages(pipeline_id,name) values ('33333333-0000-4000-8000-000000000000','x')`,'deny'],
  ['MANAGER altera estrutura do funil',U.managerA,`insert into pipeline_stages(pipeline_id,name) values ('33333333-0000-4000-8000-000000000000','Retorno')`,'allow'],
  ['MANAGER não se promove a ORGANIZATION_ADMIN',U.managerA,`update organization_members set role='ORGANIZATION_ADMIN' where user_id='${U.managerA}'`,'deny'],
  ['MANAGER não adiciona membros',U.managerA,`insert into organization_members(organization_id,user_id,role) values ('${A}','${U.outsider}','AGENCY_ADMIN')`,'deny'],
  ['ORG_ADMIN adiciona vendedor',U.orgAdminA,`insert into organization_members(organization_id,user_id,role) values ('${A}','${U.outsider}','SELLER')`,'allow'],
  ['ORG_ADMIN não concede AGENCY_ADMIN',U.orgAdminA,`update organization_members set role='AGENCY_ADMIN' where user_id='${U.sellerA}'`,'deny'],
  ['ORG_ADMIN não altera o próprio vínculo',U.orgAdminA,`update organization_members set role='AGENCY_ADMIN' where user_id='${U.orgAdminA}'`,'deny'],
  ['ORG_ADMIN não altera plano/limites da empresa',U.orgAdminA,`update organizations set plan='enterprise', lead_limit=999999 where id='${A}'`,'deny'],
  ['Super Admin altera plano da empresa',U.super,`update organizations set plan='enterprise' where id='${A}'`,'allow'],
  ['Usuário suspenso não se reativa',U.suspended,`update profiles set status='active' where id='${U.suspended}'`,'deny'],
  ['Usuário altera o próprio nome',U.sellerA,`update profiles set full_name='Vendedor A' where id='${U.sellerA}'`,'allow'],
  ['Usuário não se torna super admin',U.sellerA,`update profiles set is_super_admin=true where id='${U.sellerA}'`,'deny'],
  ['Membro não forja auditoria',U.sellerA,`insert into audit_logs(organization_id,title) values ('${A}','forjado')`,'deny'],
  ['VIEWER continua lendo leads da empresa',U.viewerA,`select count(*)::int n from leads`,'read1'],
  ['Gerente B não lê leads da empresa A',U.managerB,`select count(*)::int n from leads where organization_id='${A}'`,'read0'],
];
async function run(label){
  const results=[];
  for(const [name,user,sql,expect] of cases){
    const r=await as(user,sql);
    let got;
    if(expect.startsWith('read'))got=r.ok?'read'+r.rows[0].n:'error';
    else got=r.ok&&r.affected>0?'allow':'deny';
    results.push({name,expect,got,pass:got===expect,detail:r.error||''});
  }
  const failed=results.filter(x=>!x.pass);
  console.log(`\n== ${label}: ${results.length-failed.length}/${results.length} conforme esperado pela migração`);
  for(const x of results)console.log((x.pass?'  ok   ':'  FAIL ')+x.name+' → '+x.got+(x.pass?'':' (esperado '+x.expect+')'));
  return failed.length;
}
await db.exec(base);await db.exec(seed);
const before=await run('ANTES (políticas atuais de produção)');
await db.exec(readFileSync(migrationPath,'utf8'));
const after=await run('DEPOIS da migração');
await db.exec(readFileSync(rollbackPath,'utf8'));
const rolled=await run('APÓS ROLLBACK');
await db.exec(readFileSync(migrationPath,'utf8'));
const reapplied=await run('REAPLICADA após rollback');
console.log(`\nResumo: antes=${before} divergências (vulnerabilidades); depois=${after}; rollback=${rolled} (deve igualar o antes); reaplicada=${reapplied}`);
process.exit(after===0&&reapplied===0&&rolled===before?0:1);
