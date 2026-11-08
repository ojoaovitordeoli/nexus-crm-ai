-- Rollback de 20261107_p0_rls_role_hardening.sql
-- Restaura EXATAMENTE as políticas e funções observadas no banco em 07/11/2026
-- (DDL extraído de pg_policies/pg_proc do projeto qhizuqcdxivdvjtefofz).
-- Atenção: reabre as falhas descritas na migração. Usar só se a migração quebrar algo.
begin;
drop trigger if exists guard_profile_privileges on public.profiles;
drop function if exists public.guard_profile_privileges();
drop policy if exists writers_insert_activities on public.activities;
drop policy if exists writers_update_activities on public.activities;
drop policy if exists writers_insert_ad_metrics on public.ad_metrics;
drop policy if exists writers_update_ad_metrics on public.ad_metrics;
drop policy if exists writers_insert_ai_conversations on public.ai_conversations;
drop policy if exists writers_update_ai_conversations on public.ai_conversations;
drop policy if exists writers_insert_ai_summaries on public.ai_summaries;
drop policy if exists writers_update_ai_summaries on public.ai_summaries;
drop policy if exists writers_insert_appointments on public.appointments;
drop policy if exists writers_update_appointments on public.appointments;
drop policy if exists writers_insert_campaigns on public.campaigns;
drop policy if exists writers_update_campaigns on public.campaigns;
drop policy if exists writers_insert_contacts on public.contacts;
drop policy if exists writers_update_contacts on public.contacts;
drop policy if exists writers_insert_conversations on public.conversations;
drop policy if exists writers_update_conversations on public.conversations;
drop policy if exists writers_insert_files on public.files;
drop policy if exists writers_update_files on public.files;
drop policy if exists writers_insert_leads on public.leads;
drop policy if exists writers_update_leads on public.leads;
drop policy if exists writers_insert_messages on public.messages;
drop policy if exists writers_update_messages on public.messages;
drop policy if exists writers_insert_notes on public.notes;
drop policy if exists writers_update_notes on public.notes;
drop policy if exists writers_insert_sales on public.sales;
drop policy if exists writers_update_sales on public.sales;
drop policy if exists writers_insert_tags on public.tags;
drop policy if exists writers_update_tags on public.tags;
drop policy if exists writers_insert_tasks on public.tasks;
drop policy if exists writers_update_tasks on public.tasks;
drop policy if exists managers_insert_pipelines on public.pipelines;
drop policy if exists managers_update_pipelines on public.pipelines;
drop policy if exists managers_insert_automation_flows on public.automation_flows;
drop policy if exists managers_update_automation_flows on public.automation_flows;
drop policy if exists managers_insert_pipeline_stages on public.pipeline_stages;
drop policy if exists managers_update_pipeline_stages on public.pipeline_stages;
drop policy if exists managers_insert_automation_nodes on public.automation_nodes;
drop policy if exists managers_update_automation_nodes on public.automation_nodes;
drop policy if exists writers_insert_lead_history on public.lead_stage_history;
drop policy if exists writers_insert_lead_tags on public.lead_tags;
drop policy if exists writers_delete_lead_tags on public.lead_tags;
drop policy if exists writers_insert_cfv on public.custom_field_values;
drop policy if exists writers_update_cfv on public.custom_field_values;
drop policy if exists org_admins_insert_members on public.organization_members;
drop policy if exists org_admins_update_members on public.organization_members;
drop policy if exists org_admins_delete_members on public.organization_members;
drop policy if exists superadmin_update_organizations on public.organizations;

create policy members_insert_activities on public.activities for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_ad_metrics on public.ad_metrics for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_ai_conversations on public.ai_conversations for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_ai_conversations on public.ai_conversations for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_ai_summaries on public.ai_summaries for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_appointments on public.appointments for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_appointments on public.appointments for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_audit_logs on public.audit_logs for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_automation_flows on public.automation_flows for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_automation_flows on public.automation_flows for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_automation_nodes on public.automation_nodes for INSERT to authenticated with check ((EXISTS ( SELECT 1 FROM automation_flows af WHERE ((af.id = automation_nodes.flow_id) AND (is_org_member(af.organization_id) OR is_super_admin())))));
create policy members_update_automation_nodes on public.automation_nodes for UPDATE to authenticated using ((EXISTS ( SELECT 1 FROM automation_flows af WHERE ((af.id = automation_nodes.flow_id) AND (is_org_member(af.organization_id) OR is_super_admin()))))) with check ((EXISTS ( SELECT 1 FROM automation_flows af WHERE ((af.id = automation_nodes.flow_id) AND (is_org_member(af.organization_id) OR is_super_admin())))));
create policy members_insert_campaigns on public.campaigns for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_campaigns on public.campaigns for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_contacts on public.contacts for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_contacts on public.contacts for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_conversations on public.conversations for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_conversations on public.conversations for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_cfv on public.custom_field_values for INSERT to authenticated with check ((EXISTS ( SELECT 1 FROM custom_fields cf WHERE ((cf.id = custom_field_values.custom_field_id) AND (is_org_member(cf.organization_id) OR is_super_admin())))));
create policy members_update_cfv on public.custom_field_values for UPDATE to authenticated using ((EXISTS ( SELECT 1 FROM custom_fields cf WHERE ((cf.id = custom_field_values.custom_field_id) AND (is_org_member(cf.organization_id) OR is_super_admin()))))) with check ((EXISTS ( SELECT 1 FROM custom_fields cf WHERE ((cf.id = custom_field_values.custom_field_id) AND (is_org_member(cf.organization_id) OR is_super_admin())))));
create policy members_insert_files on public.files for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_lead_history on public.lead_stage_history for INSERT to authenticated with check ((EXISTS ( SELECT 1 FROM leads l WHERE ((l.id = lead_stage_history.lead_id) AND (is_org_member(l.organization_id) OR is_super_admin())))));
create policy members_delete_lead_tags on public.lead_tags for DELETE to authenticated using ((EXISTS ( SELECT 1 FROM leads l WHERE ((l.id = lead_tags.lead_id) AND (is_org_member(l.organization_id) OR is_super_admin())))));
create policy members_insert_lead_tags on public.lead_tags for INSERT to authenticated with check ((EXISTS ( SELECT 1 FROM leads l WHERE ((l.id = lead_tags.lead_id) AND (is_org_member(l.organization_id) OR is_super_admin())))));
create policy members_insert_leads on public.leads for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_leads on public.leads for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_messages on public.messages for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_messages on public.messages for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_notes on public.notes for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_notes on public.notes for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy admins_delete_members on public.organization_members for DELETE to authenticated using ((is_org_admin(organization_id) OR is_super_admin()));
create policy admins_insert_members on public.organization_members for INSERT to authenticated with check ((is_org_admin(organization_id) OR is_super_admin()));
create policy admins_update_members on public.organization_members for UPDATE to authenticated using ((is_org_admin(organization_id) OR is_super_admin())) with check ((is_org_admin(organization_id) OR is_super_admin()));
create policy superadmin_update_organizations on public.organizations for UPDATE to authenticated using ((is_org_admin(id) OR is_super_admin())) with check ((is_org_admin(id) OR is_super_admin()));
create policy members_insert_pipeline_stages on public.pipeline_stages for INSERT to authenticated with check ((EXISTS ( SELECT 1 FROM pipelines p WHERE ((p.id = pipeline_stages.pipeline_id) AND (is_org_member(p.organization_id) OR is_super_admin())))));
create policy members_update_pipeline_stages on public.pipeline_stages for UPDATE to authenticated using ((EXISTS ( SELECT 1 FROM pipelines p WHERE ((p.id = pipeline_stages.pipeline_id) AND (is_org_member(p.organization_id) OR is_super_admin()))))) with check ((EXISTS ( SELECT 1 FROM pipelines p WHERE ((p.id = pipeline_stages.pipeline_id) AND (is_org_member(p.organization_id) OR is_super_admin())))));
create policy members_insert_pipelines on public.pipelines for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_pipelines on public.pipelines for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_sales on public.sales for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_sales on public.sales for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_tags on public.tags for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_tags on public.tags for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_insert_tasks on public.tasks for INSERT to authenticated with check ((is_org_member(organization_id) OR is_super_admin()));
create policy members_update_tasks on public.tasks for UPDATE to authenticated using ((is_org_member(organization_id) OR is_super_admin())) with check ((is_org_member(organization_id) OR is_super_admin()));

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_super_admin = true);
$$;
create or replace function public.update_updated_at_column()
returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end; $$;
alter function public.update_updated_at_column() reset search_path;

drop function if exists public.can_admin_members(uuid);
drop function if exists public.can_manage_org(uuid);
drop function if exists public.can_write_org(uuid);
drop function if exists public.has_org_role(uuid, text[]);

grant execute on function public.is_super_admin(), public.is_org_member(uuid), public.is_org_admin(uuid),
  public.get_user_orgs(), public.handle_new_user(), public.rls_auto_enable(),
  public.admin_create_organization(text, text, text) to public, anon, authenticated;
commit;
