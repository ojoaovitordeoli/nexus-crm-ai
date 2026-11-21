-- NEXUS CRM | V42: captura de leads (formulário / landing page → funil já qualificado)
-- Aditiva: só cria 1 tabela e 1 índice. Não altera nem apaga nada existente.
-- Rollback: supabase/20261116_captura_leads_rollback.sql
--
-- Modelo de acesso:
--  * Tabela SOMENTE SERVIDOR: RLS ligado, nenhuma política para anon/authenticated e privilégios revogados.
--    Quem lê/escreve é a API do NEXUS com service_role, depois de conferir sessão + empresa + papel
--    (gestão da chave) ou o hash da chave (entrada de leads).
--  * No banco fica só o hash SHA-256 da chave; a empresa é descoberta pelo hash, nunca pelo corpo.
--  * Os leads entram nas tabelas que já existem (contacts, leads, notes), com as políticas atuais.

create table if not exists public.lead_capture_tokens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_hint text not null check (char_length(token_hint) between 4 and 12),
  label text not null default 'Captura de leads' check (char_length(label) between 1 and 80),
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz null,
  revoked_at timestamptz null
);
create index if not exists lead_capture_tokens_org_idx
  on public.lead_capture_tokens(organization_id) where revoked_at is null;

alter table public.lead_capture_tokens enable row level security;
revoke all on public.lead_capture_tokens from anon, authenticated;
grant all on public.lead_capture_tokens to service_role;
-- Sem políticas para anon/authenticated de propósito: acesso só pela API do servidor.
