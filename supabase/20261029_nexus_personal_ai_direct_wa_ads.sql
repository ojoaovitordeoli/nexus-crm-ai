-- NEXUS / Connections & personal AI. Run in a reviewed Supabase staging project first.
-- New tables only. Every request is authenticated in the server and scoped by organization.
create table if not exists public.nexus_ai_threads (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'Nova conversa',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists nexus_ai_threads_scope on public.nexus_ai_threads(organization_id,user_id,updated_at desc);
create table if not exists public.nexus_ai_messages (
 id uuid primary key default gen_random_uuid(),
 thread_id uuid not null references public.nexus_ai_threads(id) on delete cascade,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null check(role in ('user','assistant')),
 content text not null check(length(content) between 1 and 12000),
 created_at timestamptz not null default now()
);
create index if not exists nexus_ai_messages_scope on public.nexus_ai_messages(organization_id,user_id,thread_id,created_at desc);

create table if not exists public.nexus_direct_wa_connections (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 created_by uuid not null references auth.users(id),
 visibility text not null check(visibility in ('private','team')),
 instance_name text not null unique check(instance_name ~ '^[a-z0-9_-]{5,90}$'),
 label text not null check(length(label) between 2 and 80),
 state text not null default 'created' check(state in ('created','connecting','open','close','error')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists nexus_direct_wa_connections_scope on public.nexus_direct_wa_connections(organization_id,created_by);
create table if not exists public.nexus_direct_wa_messages (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 connection_id uuid not null references public.nexus_direct_wa_connections(id) on delete cascade,
 provider_id text not null check(length(provider_id) between 3 and 255),
 remote_jid text not null check(length(remote_jid) between 3 and 140),
 from_me boolean not null default false,
 text_body text,
 occurred_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(connection_id,provider_id)
);
create index if not exists nexus_direct_wa_messages_feed on public.nexus_direct_wa_messages(organization_id,connection_id,occurred_at desc);

create table if not exists public.nexus_meta_ads_connections (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 account_id text not null check(account_id ~ '^act_[0-9]{5,30}$'),
 label text not null default 'Conta de anúncios',
 token_ciphertext text not null check(length(token_ciphertext) between 60 and 12000),
 configured_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(organization_id,account_id)
);
create index if not exists nexus_meta_ads_connections_scope on public.nexus_meta_ads_connections(organization_id);

alter table public.nexus_ai_threads enable row level security;
alter table public.nexus_ai_messages enable row level security;
alter table public.nexus_direct_wa_connections enable row level security;
alter table public.nexus_direct_wa_messages enable row level security;
alter table public.nexus_meta_ads_connections enable row level security;
revoke all on public.nexus_ai_threads,public.nexus_ai_messages,public.nexus_direct_wa_connections,public.nexus_direct_wa_messages,public.nexus_meta_ads_connections from anon,authenticated;
grant all on public.nexus_ai_threads,public.nexus_ai_messages,public.nexus_direct_wa_connections,public.nexus_direct_wa_messages,public.nexus_meta_ads_connections to service_role;
comment on table public.nexus_ai_messages is 'Per-user AI conversations; server-only access. Implement retention and deletion under LGPD.';
comment on table public.nexus_direct_wa_connections is 'Uncertified WhatsApp Web bridge: optional, no guarantee of continued connectivity.';
