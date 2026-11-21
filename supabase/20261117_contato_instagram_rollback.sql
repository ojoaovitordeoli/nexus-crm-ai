-- Desfaz 20261117_contato_instagram.sql. Apaga apenas o @ do Instagram guardado nos contatos.
drop index if exists public.contacts_org_instagram_uniq;
alter table public.contacts drop column if exists instagram;
