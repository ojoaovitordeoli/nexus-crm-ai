-- NEXUS CRM | V54 "Automações por conversa": regras que CRIAM TAREFAS (nada de mensagem, HTTP externo ou IA).
-- Ativa só a parte de automação da fundação 20261028 (as tabelas de WhatsApp continuam fora) e acrescenta
-- os gatilhos "faltou" e "compareceu" no agendamento.
-- Tabelas só do servidor (como a fundação previa): o navegador não lê nem escreve direto; a API confere
-- sessão, empresa e papel (gerente/admin) antes de qualquer coisa.
-- Rollback: supabase/20261121_v54_automacoes_rollback.sql

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null,
  name text not null check (length(name) between 3 and 100),
  enabled boolean not null default false,
  trigger_type text not null default 'lead_stage_changed'
    check (trigger_type in ('lead_stage_changed','appointment_no_show','appointment_completed')),
  action_type text not null default 'create_followup_task'
    check (action_type in ('create_followup_task')),
  stage_id uuid null references public.pipeline_stages(id) on delete cascade,
  task_title text not null check (length(task_title) between 3 and 180),
  delay_days integer not null default 1 check (delay_days between 0 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Gatilho de etapa precisa da etapa; gatilho de agendamento não usa etapa.
  constraint automation_rules_stage_por_gatilho check (
    (trigger_type = 'lead_stage_changed' and stage_id is not null) or
    (trigger_type <> 'lead_stage_changed' and stage_id is null))
);
create index if not exists automation_rules_org_enabled_idx on public.automation_rules(organization_id, enabled, trigger_type, stage_id);
create unique index if not exists automation_rules_org_name_key on public.automation_rules(organization_id, name);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  event_key text not null check (length(event_key) between 5 and 255),
  status text not null default 'running' check (status in ('running','success','failed')),
  task_id uuid null references public.tasks(id) on delete set null,
  error_summary text null,
  created_at timestamptz not null default now(),
  finished_at timestamptz null,
  unique (rule_id, event_key)
);
create index if not exists automation_executions_org_created_idx on public.automation_executions(organization_id, created_at desc);

alter table public.automation_rules enable row level security;
alter table public.automation_executions enable row level security;
revoke all on public.automation_rules, public.automation_executions from anon, authenticated;
grant all on public.automation_rules, public.automation_executions to service_role;

comment on table public.automation_rules is
  'V54: regras por empresa que só criam tarefas (etapa do lead, falta ou presença no agendamento). Gerência pela API autenticada.';
comment on table public.automation_executions is
  'V54: trilha de cada execução (uma por regra e evento), com a tarefa criada ou o erro resumido.';
