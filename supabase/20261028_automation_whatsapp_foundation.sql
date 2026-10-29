-- NEXUS CRM | Automation and official WhatsApp inbound foundation
-- Review in Supabase SQL Editor before running. No existing customer rows are deleted.
-- All new tables are server-only until future RLS policies are intentionally approved.

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  name text not null check (length(name) between 3 and 100),
  enabled boolean not null default false,
  trigger_type text not null default 'lead_stage_changed'
    check (trigger_type in ('lead_stage_changed')),
  action_type text not null default 'create_followup_task'
    check (action_type in ('create_followup_task')),
  stage_id uuid not null references public.pipeline_stages(id) on delete cascade,
  task_title text not null check (length(task_title) between 3 and 180),
  delay_days integer not null default 1 check (delay_days between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists automation_rules_org_enabled_idx
  on public.automation_rules(organization_id, enabled, stage_id);
create unique index if not exists automation_rules_org_name_key
  on public.automation_rules(organization_id, name);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  event_key text not null check (length(event_key) between 5 and 255),
  status text not null default 'running'
    check (status in ('running','success','failed')),
  task_id uuid null references public.tasks(id) on delete set null,
  error_summary text null,
  created_at timestamptz not null default now(),
  finished_at timestamptz null,
  unique (rule_id,event_key)
);
create index if not exists automation_executions_org_created_idx
  on public.automation_executions(organization_id,created_at desc);

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{6,24}$'),
  display_name text not null default 'WhatsApp Business',
  status text not null default 'pending'
    check (status in ('pending','active','disabled')),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz null,
  unique (organization_id,phone_number_id)
);
create index if not exists whatsapp_connections_org_idx
  on public.whatsapp_connections(organization_id,status);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  provider_message_id text not null check (length(provider_message_id) between 4 and 255),
  wa_id text not null check (length(wa_id) between 8 and 24),
  direction text not null default 'inbound'
    check (direction in ('inbound','outbound')),
  message_type text not null default 'text',
  text_body text null,
  delivery_status text null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id,provider_message_id)
);
create index if not exists whatsapp_messages_org_wa_idx
  on public.whatsapp_messages(organization_id,wa_id,occurred_at desc);
create index if not exists whatsapp_messages_org_time_idx
  on public.whatsapp_messages(organization_id,occurred_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_executions enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_messages enable row level security;

revoke all on public.automation_rules, public.automation_executions,
  public.whatsapp_connections, public.whatsapp_messages from anon, authenticated;
grant all on public.automation_rules, public.automation_executions,
  public.whatsapp_connections, public.whatsapp_messages to service_role;

comment on table public.automation_rules is
  'Server-only tenant-scoped followup rules; management via authenticated API.';
comment on table public.whatsapp_messages is
  'Personal message data; server-only and scoped by organization. Enforce LGPD retention.';
