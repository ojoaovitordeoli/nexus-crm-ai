-- NEXUS / WhatsApp outbound - apply after the inbound foundation migration.
-- Zero destructive changes. Never expose or replicate these rows to browser clients.
create table if not exists public.whatsapp_connection_secrets (
  connection_id uuid primary key references public.whatsapp_connections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_ciphertext text not null check (length(token_ciphertext) between 60 and 10000),
  configured_by uuid not null,
  updated_at timestamptz not null default now()
);
create index if not exists whatsapp_connection_secrets_org_idx
  on public.whatsapp_connection_secrets(organization_id);

create table if not exists public.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  client_request_id uuid not null,
  created_by uuid not null,
  recipient_wa_id text not null check (recipient_wa_id ~ '^[0-9]{8,24}$'),
  message_text text not null check (length(message_text) between 1 and 4096),
  status text not null default 'pending' check (status in ('pending','accepted','failed')),
  provider_message_id text,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(organization_id,client_request_id)
);
create index if not exists whatsapp_outbox_rate_idx
  on public.whatsapp_outbox(organization_id,created_by,created_at desc);
create index if not exists whatsapp_outbox_connection_idx
  on public.whatsapp_outbox(organization_id,connection_id,created_at desc);

alter table public.whatsapp_connection_secrets enable row level security;
alter table public.whatsapp_outbox enable row level security;
revoke all on public.whatsapp_connection_secrets, public.whatsapp_outbox from anon,authenticated;
grant all on public.whatsapp_connection_secrets, public.whatsapp_outbox to service_role;

comment on table public.whatsapp_connection_secrets is
  'Meta tokens encrypted by server-side AES-256-GCM key. Never return ciphertext in API responses.';
comment on table public.whatsapp_outbox is
  'Idempotent send attempts, tenant-scoped for audit. No automatic retries.';
