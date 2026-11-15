-- Desfaz 20261116_leads_indicacao.sql. Apaga apenas a informação de "quem indicou".
drop trigger if exists leads_referral_guard on public.leads;
drop function if exists public.leads_referral_guard();
drop index if exists public.leads_org_referred_by_idx;
alter table public.leads drop column if exists referred_by_contact_id;
