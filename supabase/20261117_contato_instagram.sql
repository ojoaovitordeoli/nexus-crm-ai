-- NEXUS CRM | V47: @ do Instagram no contato (captura "comenta a palavra" → ManyChat/n8n → NEXUS)
-- Aditiva: 1 coluna opcional + 1 índice. Nenhuma linha existente é alterada.
-- As políticas RLS de contacts continuam valendo (é a mesma linha).
-- Rollback: supabase/20261117_contato_instagram_rollback.sql

alter table public.contacts
  add column if not exists instagram text null
  check (instagram is null or instagram ~ '^[a-z0-9._]{1,30}$');

comment on column public.contacts.instagram is
  'Usuário do Instagram sem @, em minúsculas (ex.: otica.visao). Nulo quando não informado.';

-- Um mesmo @ não vira dois contatos ativos na mesma empresa.
create unique index if not exists contacts_org_instagram_uniq
  on public.contacts(organization_id, instagram)
  where instagram is not null and deleted_at is null;
