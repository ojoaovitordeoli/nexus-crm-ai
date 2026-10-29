-- NEXUS CRM | Read-only AI insight usage ledger
-- Review before applying in Supabase SQL Editor. Does not modify existing rows.
create table if not exists public.ai_insight_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null,
  question_length integer not null check (question_length between 1 and 1200),
  status text not null default 'pending' check (status in ('pending','success','failed')),
  model text null,
  input_tokens integer null,
  output_tokens integer null,
  created_at timestamptz not null default now(),
  finished_at timestamptz null
);
create index if not exists ai_insight_user_quota_idx
  on public.ai_insight_requests(organization_id,user_id,created_at desc);
create index if not exists ai_insight_org_quota_idx
  on public.ai_insight_requests(organization_id,created_at desc);
alter table public.ai_insight_requests enable row level security;
revoke all on public.ai_insight_requests from anon, authenticated;
grant all on public.ai_insight_requests to service_role;
comment on table public.ai_insight_requests is
  'Server-only quota and audit. Never store raw questions, contact data or model responses here.';
