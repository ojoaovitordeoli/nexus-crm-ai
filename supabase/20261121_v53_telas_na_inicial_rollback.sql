-- Desfaz 20261121_v53_telas_na_inicial.sql. As telas continuam salvas; só deixam de aparecer na tela inicial.
alter table public.user_views drop column if exists on_home;
