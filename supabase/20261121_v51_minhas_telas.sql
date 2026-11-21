-- NEXUS CRM | V51 "Sob Medida": telas que cada pessoa montou conversando com o assistente.
-- Aditiva: 1 tabela nova. Nenhuma tabela existente é alterada.
-- Guarda só a RECEITA da tela (o que mostrar), nunca os dados — eles são buscados de novo, já filtrados pela empresa.
-- Cada tela é de uma pessoa numa empresa: ninguém vê nem mexe na tela de outra pessoa.
-- Rollback: supabase/20261121_v51_minhas_telas_rollback.sql

create table if not exists public.user_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  spec jsonb not null check (jsonb_typeof(spec) = 'object' and pg_column_size(spec) < 8192),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_views is
  'V51: telas salvas por pessoa (receita validada em lib/views/spec.mjs). Sem dados de clientes.';

create index if not exists user_views_owner_idx on public.user_views(organization_id, user_id, position);

alter table public.user_views enable row level security;

-- Só a própria pessoa, e só enquanto for membro ativo da empresa.
drop policy if exists user_views_select_own on public.user_views;
create policy user_views_select_own on public.user_views for select to authenticated
  using (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists user_views_insert_own on public.user_views;
create policy user_views_insert_own on public.user_views for insert to authenticated
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists user_views_update_own on public.user_views;
create policy user_views_update_own on public.user_views for update to authenticated
  using (user_id = auth.uid() and public.is_org_member(organization_id))
  with check (user_id = auth.uid() and public.is_org_member(organization_id));

drop policy if exists user_views_delete_own on public.user_views;
create policy user_views_delete_own on public.user_views for delete to authenticated
  using (user_id = auth.uid() and public.is_org_member(organization_id));

revoke all on public.user_views from anon;
grant select, insert, update, delete on public.user_views to authenticated;
