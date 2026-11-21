-- NEXUS CRM | Cadastros do funil: categorias de cliente e setores de empresa (paridade com Agendor)
-- Aditiva: cria 2 tabelas e 2 colunas opcionais em contacts. Nenhuma linha existente é alterada.
-- Leitura/escrita pela API do servidor (service role) com checagem de empresa e papel.
-- Rollback no fim do arquivo.
-- APLICADA no Supabase qhizuqcdxivdvjtefofz em 08/11/2026 (com autorização do usuário).

create table if not exists public.contact_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.company_sectors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.contacts
  add column if not exists category_id uuid null references public.contact_categories(id) on delete set null,
  add column if not exists sector_id uuid null references public.company_sectors(id) on delete set null;

create index if not exists contacts_org_category_idx on public.contacts(organization_id, category_id) where category_id is not null;
create index if not exists contacts_org_sector_idx on public.contacts(organization_id, sector_id) where sector_id is not null;

-- Categoria/setor nunca podem apontar para cadastro de outra empresa.
create or replace function public.contacts_same_org_catalogs()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.category_id is not null and not exists (
    select 1 from public.contact_categories c where c.id = new.category_id and c.organization_id = new.organization_id
  ) then raise exception 'category_id de outra organização' using errcode = '23514'; end if;
  if new.sector_id is not null and not exists (
    select 1 from public.company_sectors s where s.id = new.sector_id and s.organization_id = new.organization_id
  ) then raise exception 'sector_id de outra organização' using errcode = '23514'; end if;
  return new;
end $$;
revoke all on function public.contacts_same_org_catalogs() from public, anon, authenticated;
drop trigger if exists contacts_same_org_catalogs on public.contacts;
create trigger contacts_same_org_catalogs
  before insert or update of category_id, sector_id, organization_id on public.contacts
  for each row execute function public.contacts_same_org_catalogs();

-- Mesmo padrão de lost_reasons: membros leem, admins da empresa escrevem.
alter table public.contact_categories enable row level security;
alter table public.company_sectors enable row level security;
revoke all on public.contact_categories, public.company_sectors from anon;
grant select on public.contact_categories, public.company_sectors to authenticated;
grant all on public.contact_categories, public.company_sectors to service_role;
-- Supabase concede escrita a authenticated em tabelas novas; aqui só leitura (RLS + API do servidor).
revoke insert, update, delete, truncate, references, trigger on public.contact_categories, public.company_sectors from authenticated;

drop policy if exists members_read_contact_categories on public.contact_categories;
create policy members_read_contact_categories on public.contact_categories for select to authenticated
  using (is_org_member(organization_id) or is_super_admin());
drop policy if exists members_read_company_sectors on public.company_sectors;
create policy members_read_company_sectors on public.company_sectors for select to authenticated
  using (is_org_member(organization_id) or is_super_admin());

-- ROLLBACK (manual):
-- drop trigger if exists contacts_same_org_catalogs on public.contacts;
-- drop function if exists public.contacts_same_org_catalogs();
-- alter table public.contacts drop column if exists sector_id, drop column if exists category_id;
-- drop table if exists public.company_sectors;
-- drop table if exists public.contact_categories;
