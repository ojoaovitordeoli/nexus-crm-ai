-- NEXUS V17 · P0 · Endurecimento de RLS por papel
-- Estado auditado em 07/11/2026 no projeto Supabase "CRM" (qhizuqcdxivdvjtefofz).
-- NÃO APLICADO AUTOMATICAMENTE. Aplicar somente com autorização do proprietário.
-- Rollback: supabase/20261107_p0_rls_role_hardening_rollback.sql
--
-- Problemas corrigidos (todos exploráveis direto pelo PostgREST com a chave pública
-- + JWT de um usuário logado, sem passar pela API do Next):
--  1. INSERT/UPDATE operacionais usam is_org_member(): VIEWER consegue escrever.
--  2. is_org_admin() inclui MANAGER, e organization_members permite que esse papel
--     altere a própria linha ou crie vínculos com qualquer papel (autoelevação).
--  3. organizations UPDATE liberado a admin da empresa: permite alterar plan,
--     user_limit, lead_limit, modules e status (contorno de plano/limites).
--  4. profiles UPDATE próprio só protege is_super_admin: usuário suspenso pode
--     reativar o próprio status.
--  5. audit_logs aceita INSERT de qualquer membro (trilha forjável).
--  6. is_super_admin() ignora status: super admin suspenso continua com acesso RLS.
--  7. Funções SECURITY DEFINER executáveis por anon.
--
-- A UI atual não escreve direto nessas tabelas: todas as escritas passam por
-- /api/* com service_role (que ignora RLS). Leituras do cliente não mudam.

begin;

-- ---------------------------------------------------------------- helpers
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_super_admin = true and p.status = 'active'
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = org_id and om.user_id = auth.uid()
      and om.status = 'active' and om.role = any(allowed)
  );
$$;

-- Escrita operacional: qualquer papel ativo exceto VIEWER.
create or replace function public.can_write_org(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or public.has_org_role(org_id,
    array['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER','SDR','SELLER']);
$$;

-- Estrutura (funil, automações): gestão.
create or replace function public.can_manage_org(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or public.has_org_role(org_id,
    array['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER']);
$$;

-- Equipe e acessos: administração da empresa (não inclui MANAGER).
create or replace function public.can_admin_members(org_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin() or public.has_org_role(org_id,
    array['AGENCY_ADMIN','ORGANIZATION_ADMIN']);
$$;

create or replace function public.update_updated_at_column()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

-- ------------------------------------------- 1. escrita operacional por papel
do $$
declare t text;
begin
  -- tabelas com organization_id e políticas members_insert_<t>/members_update_<t>
  foreach t in array array['activities','ad_metrics','ai_conversations','ai_summaries','appointments',
    'campaigns','contacts','conversations','files','leads','messages','notes','sales','tags','tasks']
  loop
    if exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='members_insert_'||t) then
      execute format('drop policy %I on public.%I','members_insert_'||t,t);
      execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_org(organization_id))','writers_insert_'||t,t);
    end if;
    if exists (select 1 from pg_policies where schemaname='public' and tablename=t and policyname='members_update_'||t) then
      execute format('drop policy %I on public.%I','members_update_'||t,t);
      execute format('create policy %I on public.%I for update to authenticated using (public.can_write_org(organization_id)) with check (public.can_write_org(organization_id))','writers_update_'||t,t);
    end if;
  end loop;
  -- estrutura: somente gestão
  foreach t in array array['pipelines','automation_flows']
  loop
    execute format('drop policy if exists %I on public.%I','members_insert_'||t,t);
    execute format('drop policy if exists %I on public.%I','members_update_'||t,t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_manage_org(organization_id))','managers_insert_'||t,t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_manage_org(organization_id)) with check (public.can_manage_org(organization_id))','managers_update_'||t,t);
  end loop;
end $$;

drop policy if exists members_insert_pipeline_stages on public.pipeline_stages;
drop policy if exists members_update_pipeline_stages on public.pipeline_stages;
create policy managers_insert_pipeline_stages on public.pipeline_stages for insert to authenticated
  with check (exists (select 1 from public.pipelines p where p.id = pipeline_id and public.can_manage_org(p.organization_id)));
create policy managers_update_pipeline_stages on public.pipeline_stages for update to authenticated
  using (exists (select 1 from public.pipelines p where p.id = pipeline_id and public.can_manage_org(p.organization_id)))
  with check (exists (select 1 from public.pipelines p where p.id = pipeline_id and public.can_manage_org(p.organization_id)));

drop policy if exists members_insert_automation_nodes on public.automation_nodes;
drop policy if exists members_update_automation_nodes on public.automation_nodes;
create policy managers_insert_automation_nodes on public.automation_nodes for insert to authenticated
  with check (exists (select 1 from public.automation_flows af where af.id = flow_id and public.can_manage_org(af.organization_id)));
create policy managers_update_automation_nodes on public.automation_nodes for update to authenticated
  using (exists (select 1 from public.automation_flows af where af.id = flow_id and public.can_manage_org(af.organization_id)))
  with check (exists (select 1 from public.automation_flows af where af.id = flow_id and public.can_manage_org(af.organization_id)));

drop policy if exists members_insert_lead_history on public.lead_stage_history;
create policy writers_insert_lead_history on public.lead_stage_history for insert to authenticated
  with check (exists (select 1 from public.leads l where l.id = lead_id and public.can_write_org(l.organization_id)));

drop policy if exists members_insert_lead_tags on public.lead_tags;
drop policy if exists members_delete_lead_tags on public.lead_tags;
create policy writers_insert_lead_tags on public.lead_tags for insert to authenticated
  with check (exists (select 1 from public.leads l where l.id = lead_id and public.can_write_org(l.organization_id)));
create policy writers_delete_lead_tags on public.lead_tags for delete to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and public.can_write_org(l.organization_id)));

drop policy if exists members_insert_cfv on public.custom_field_values;
drop policy if exists members_update_cfv on public.custom_field_values;
create policy writers_insert_cfv on public.custom_field_values for insert to authenticated
  with check (exists (select 1 from public.custom_fields cf where cf.id = custom_field_id and public.can_write_org(cf.organization_id)));
create policy writers_update_cfv on public.custom_field_values for update to authenticated
  using (exists (select 1 from public.custom_fields cf where cf.id = custom_field_id and public.can_write_org(cf.organization_id)))
  with check (exists (select 1 from public.custom_fields cf where cf.id = custom_field_id and public.can_write_org(cf.organization_id)));

-- ------------------------------------------------ 2. equipe sem autoelevação
drop policy if exists admins_insert_members on public.organization_members;
drop policy if exists admins_update_members on public.organization_members;
drop policy if exists admins_delete_members on public.organization_members;
create policy org_admins_insert_members on public.organization_members for insert to authenticated
  with check (public.can_admin_members(organization_id)
    and (user_id <> auth.uid() or public.is_super_admin())
    and (role <> 'AGENCY_ADMIN' or public.is_super_admin() or public.has_org_role(organization_id, array['AGENCY_ADMIN'])));
create policy org_admins_update_members on public.organization_members for update to authenticated
  using (public.can_admin_members(organization_id) and (user_id <> auth.uid() or public.is_super_admin()))
  with check (public.can_admin_members(organization_id)
    and (user_id <> auth.uid() or public.is_super_admin())
    and (role <> 'AGENCY_ADMIN' or public.is_super_admin() or public.has_org_role(organization_id, array['AGENCY_ADMIN'])));
create policy org_admins_delete_members on public.organization_members for delete to authenticated
  using (public.can_admin_members(organization_id) and (user_id <> auth.uid() or public.is_super_admin()));

-- --------------------------------------- 3. plano/limites/status da empresa
drop policy if exists superadmin_update_organizations on public.organizations;
create policy superadmin_update_organizations on public.organizations for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ------------------------------ 4. perfil: usuário não altera status/privilégio
create or replace function public.guard_profile_privileges()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- auth.uid() nulo = service_role/servidor (APIs administrativas); liberado.
  if auth.uid() is not null and not public.is_super_admin() then
    if new.status is distinct from old.status
       or new.is_super_admin is distinct from old.is_super_admin then
      raise exception 'Somente o Super Admin pode alterar status ou privilégios de perfil'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists guard_profile_privileges on public.profiles;
create trigger guard_profile_privileges before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- ---------------------------------------------- 5. trilha de auditoria íntegra
drop policy if exists members_insert_audit_logs on public.audit_logs;
-- (escrita apenas pelo servidor com service_role)

-- ------------------------------------------------ 7. superfície de RPC pública
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.is_org_admin(uuid) from public, anon;
revoke execute on function public.get_user_orgs() from public, anon;
revoke execute on function public.has_org_role(uuid, text[]) from public, anon;
revoke execute on function public.can_write_org(uuid) from public, anon;
revoke execute on function public.can_manage_org(uuid) from public, anon;
revoke execute on function public.can_admin_members(uuid) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.guard_profile_privileges() from public, anon, authenticated;
revoke execute on function public.admin_create_organization(text, text, text) from public, anon;
grant execute on function public.is_super_admin(), public.is_org_member(uuid), public.is_org_admin(uuid),
  public.get_user_orgs(), public.has_org_role(uuid, text[]), public.can_write_org(uuid),
  public.can_manage_org(uuid), public.can_admin_members(uuid),
  public.admin_create_organization(text, text, text) to authenticated;

commit;
