-- NEXUS CRM | V34: notificações da prospecção automática (e-mail do Harvey e agente de WhatsApp)
-- Aditiva: só cria tabelas, índices e gatilho novos. Não altera nem apaga nada existente.
-- Rollback: supabase/20261115_prospeccao_notificacoes_rollback.sql
--
-- Modelo de acesso:
--  * As duas tabelas são SOMENTE SERVIDOR: RLS ligado, nenhuma política para anon/authenticated
--    e privilégios revogados. Quem lê/escreve é a API do NEXUS com service_role, depois de
--    conferir sessão + organization_id + papel (Admin da empresa, Admin da agência ou Super Admin).
--  * A entrada vinda do vigia local usa um token por empresa. No banco fica só o hash SHA-256
--    do token; a empresa é descoberta pelo hash, nunca pelo corpo da requisição.

create table if not exists public.prospecting_ingest_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_hint text not null check (char_length(token_hint) between 4 and 12),
  label text not null default 'Vigia da prospecção' check (char_length(label) between 1 and 80),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz null,
  revoked_at timestamptz null
);
create index if not exists prospecting_ingest_tokens_org_idx
  on public.prospecting_ingest_tokens(organization_id) where revoked_at is null;

create table if not exists public.prospecting_alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (source in ('harvey_email','whatsapp_agent')),
  channel text not null check (channel in ('email','whatsapp')),
  kind text not null check (kind in ('interesse','pergunta','objecao','venda','lead_quente','outro')),
  external_id text not null check (char_length(external_id) between 1 and 200),
  company_name text null check (char_length(company_name) <= 200),
  contact_name text null check (char_length(contact_name) <= 200),
  contact_email text null check (char_length(contact_email) <= 254),
  contact_phone text null check (contact_phone ~ '^[0-9]{10,15}$'),
  message_excerpt text null check (char_length(message_excerpt) <= 2000),
  occurred_at timestamptz not null,
  status text not null default 'novo' check (status in ('novo','em_atendimento','resolvido','descartado')),
  handled_by uuid null references auth.users(id) on delete set null,
  handled_at timestamptz null,
  token_id uuid null references public.prospecting_ingest_tokens(id) on delete set null,
  received_at timestamptz not null default now(),
  -- O mesmo aviso reenviado pelo vigia não vira duplicata.
  constraint prospecting_alerts_dedupe unique (organization_id, source, external_id)
);
create index if not exists prospecting_alerts_org_time_idx
  on public.prospecting_alerts(organization_id, occurred_at desc);
create index if not exists prospecting_alerts_org_status_idx
  on public.prospecting_alerts(organization_id, status, occurred_at desc);

-- O token que gravou o aviso tem de ser da mesma empresa, mesmo que um bug no servidor tente o contrário.
create or replace function public.prospecting_alerts_same_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.token_id is not null and not exists (
    select 1 from public.prospecting_ingest_tokens t
    where t.id = new.token_id and t.organization_id = new.organization_id
  ) then
    raise exception 'token de outra organização' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.prospecting_alerts_same_org() from public, anon, authenticated;

drop trigger if exists prospecting_alerts_same_org on public.prospecting_alerts;
create trigger prospecting_alerts_same_org
  before insert or update of token_id, organization_id on public.prospecting_alerts
  for each row execute function public.prospecting_alerts_same_org();

alter table public.prospecting_ingest_tokens enable row level security;
alter table public.prospecting_alerts enable row level security;
revoke all on public.prospecting_ingest_tokens from anon, authenticated;
revoke all on public.prospecting_alerts from anon, authenticated;
-- Sem políticas para anon/authenticated de propósito: acesso só pela API do servidor.
