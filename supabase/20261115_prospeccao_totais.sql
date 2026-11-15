-- NEXUS CRM | V35: quadro de números da prospecção por canal de origem (e-mail / WhatsApp)
-- Pré-requisito: 20261115_prospeccao_notificacoes.sql. Aditiva. Rollback: 20261115_prospeccao_totais_rollback.sql
-- Os totais são calculados no PC do dono (Harvey + agente de WhatsApp) e enviados pelo vigia com o token da empresa.
-- Somente servidor: RLS ligado, sem políticas, privilégios revogados de anon/authenticated.

create table if not exists public.prospecting_channel_totals (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (channel in ('email','whatsapp')),
  sent integer not null default 0 check (sent between 0 and 10000000),
  replied integer not null default 0 check (replied between 0 and 10000000),
  interested integer not null default 0 check (interested between 0 and 10000000),
  sales integer not null default 0 check (sales between 0 and 10000000),
  revenue_cents bigint not null default 0 check (revenue_cents between 0 and 100000000000),
  measured_at timestamptz not null,
  received_at timestamptz not null default now(),
  token_id uuid null references public.prospecting_ingest_tokens(id) on delete set null,
  primary key (organization_id, channel)
);

create or replace function public.prospecting_totals_same_org()
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
revoke all on function public.prospecting_totals_same_org() from public, anon, authenticated;

drop trigger if exists prospecting_totals_same_org on public.prospecting_channel_totals;
create trigger prospecting_totals_same_org
  before insert or update of token_id, organization_id on public.prospecting_channel_totals
  for each row execute function public.prospecting_totals_same_org();

alter table public.prospecting_channel_totals enable row level security;
revoke all on public.prospecting_channel_totals from anon, authenticated;
