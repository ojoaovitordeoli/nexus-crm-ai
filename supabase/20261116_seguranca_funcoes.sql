-- NEXUS CRM | V46: fecha alertas de segurança do Supabase (advisor) em funções.
-- Não cria nem apaga tabela, linha ou política. Só ajusta quem pode EXECUTAR funções e o search_path.
-- Rollback: supabase/20261116_seguranca_funcoes_rollback.sql
--
-- 1) Funções de permissão usadas nas políticas RLS (todas "to authenticated"):
--    o visitante sem login (anon) e o PUBLIC deixam de executar; authenticated e service_role continuam
--    (as políticas precisam). get_user_orgs: mesmo tratamento (devolve só as empresas do próprio usuário).
revoke execute on function public.is_org_member(uuid) from public, anon;
revoke execute on function public.is_org_admin(uuid) from public, anon;
revoke execute on function public.is_super_admin() from public, anon;
revoke execute on function public.get_user_orgs() from public, anon;
grant execute on function public.is_org_member(uuid) to authenticated, service_role;
grant execute on function public.is_org_admin(uuid) to authenticated, service_role;
grant execute on function public.is_super_admin() to authenticated, service_role;
grant execute on function public.get_user_orgs() to authenticated, service_role;

-- 2) Funções de gatilho/evento: ninguém precisa chamá-las pela API.
--    Gatilhos e gatilhos de evento continuam disparando (o Postgres não exige EXECUTE de quem dispara).
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 3) search_path fixo (alerta "Function Search Path Mutable").
alter function public.update_updated_at_column() set search_path = public, pg_temp;

-- Não mexido de propósito: admin_create_organization (o app chama como usuário logado e a função
-- confere Super Admin por dentro). Proteção contra senha vazada é configuração do painel (Auth).
