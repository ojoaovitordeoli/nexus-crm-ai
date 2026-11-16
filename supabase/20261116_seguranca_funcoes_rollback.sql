-- Desfaz 20261116_seguranca_funcoes.sql (volta às permissões anteriores).
grant execute on function public.is_org_member(uuid) to public, anon;
grant execute on function public.is_org_admin(uuid) to public, anon;
grant execute on function public.is_super_admin() to public, anon;
grant execute on function public.get_user_orgs() to public, anon;
grant execute on function public.handle_new_user() to public, anon, authenticated;
grant execute on function public.rls_auto_enable() to public, anon, authenticated;
alter function public.update_updated_at_column() reset search_path;
