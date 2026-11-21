-- NEXUS CRM | V53 "A cara do negócio": a pessoa fixa até 4 das suas telas na tela inicial.
-- Aditiva: 1 coluna com padrão false em user_views (V51). As regras RLS da V51 continuam valendo (mesma linha).
-- Rollback: supabase/20261121_v53_telas_na_inicial_rollback.sql
alter table public.user_views add column if not exists on_home boolean not null default false;
comment on column public.user_views.on_home is 'V53: tela fixada na tela inicial da pessoa (máximo 4, conferido na API).';
