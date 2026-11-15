-- NEXUS CRM | Indicação: quem indicou o lead (Expansão da metodologia ACE)
-- Aditiva: 1 coluna opcional em leads + índice + trava de empresa. Nenhuma linha existente é alterada.
-- Leitura/escrita pela API do servidor (service role), que confere empresa e papel.
-- As políticas RLS de leads continuam valendo para a coluna nova (é a mesma linha).
-- Desfazer: 20261116_leads_indicacao_rollback.sql

alter table public.leads
  add column if not exists referred_by_contact_id uuid null references public.contacts(id) on delete set null;

create index if not exists leads_org_referred_by_idx
  on public.leads(organization_id, referred_by_contact_id)
  where referred_by_contact_id is not null;

-- Quem indicou tem de ser contato da MESMA empresa e não pode ser o próprio contato do lead.
create or replace function public.leads_referral_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.referred_by_contact_id is null then return new; end if;
  if new.referred_by_contact_id = new.contact_id then
    raise exception 'o contato não pode indicar a si mesmo' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.contacts c
    where c.id = new.referred_by_contact_id and c.organization_id = new.organization_id
  ) then
    raise exception 'referred_by_contact_id de outra organização' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.leads_referral_guard() from public, anon, authenticated;

drop trigger if exists leads_referral_guard on public.leads;
create trigger leads_referral_guard
  before insert or update of referred_by_contact_id, contact_id, organization_id on public.leads
  for each row execute function public.leads_referral_guard();

comment on column public.leads.referred_by_contact_id is
  'Contato da mesma empresa que indicou este lead (indicação). Nulo quando não houve indicação.';
