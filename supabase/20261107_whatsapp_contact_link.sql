-- NEXUS CRM | WhatsApp: vínculo de mensagem a contato/lead (Etapa 1 da homologação)
-- Pré-requisito: 20261028_automation_whatsapp_foundation.sql aplicada.
-- Aditiva: não altera nem apaga linhas existentes. Rollback no fim do arquivo.

alter table public.whatsapp_messages
  add column if not exists contact_id uuid null references public.contacts(id) on delete set null,
  add column if not exists lead_id uuid null references public.leads(id) on delete set null;

create index if not exists whatsapp_messages_org_contact_idx
  on public.whatsapp_messages(organization_id, contact_id, occurred_at desc)
  where contact_id is not null;
create index if not exists whatsapp_messages_org_lead_idx
  on public.whatsapp_messages(organization_id, lead_id)
  where lead_id is not null;

-- Garante que o vínculo nunca aponte para contato/lead de outra empresa,
-- mesmo que um bug no servidor tente gravar isso.
create or replace function public.whatsapp_messages_same_org_link()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.contact_id is not null and not exists (
    select 1 from public.contacts c where c.id = new.contact_id and c.organization_id = new.organization_id
  ) then
    raise exception 'contact_id de outra organização' using errcode = '23514';
  end if;
  if new.lead_id is not null and not exists (
    select 1 from public.leads l where l.id = new.lead_id and l.organization_id = new.organization_id
  ) then
    raise exception 'lead_id de outra organização' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function public.whatsapp_messages_same_org_link() from public, anon, authenticated;

drop trigger if exists whatsapp_messages_same_org_link on public.whatsapp_messages;
create trigger whatsapp_messages_same_org_link
  before insert or update of contact_id, lead_id, organization_id on public.whatsapp_messages
  for each row execute function public.whatsapp_messages_same_org_link();

-- Tabelas continuam somente servidor (sem políticas RLS para anon/authenticated).

-- ROLLBACK (executar manualmente se necessário):
-- drop trigger if exists whatsapp_messages_same_org_link on public.whatsapp_messages;
-- drop function if exists public.whatsapp_messages_same_org_link();
-- drop index if exists public.whatsapp_messages_org_lead_idx;
-- drop index if exists public.whatsapp_messages_org_contact_idx;
-- alter table public.whatsapp_messages drop column if exists lead_id, drop column if exists contact_id;
