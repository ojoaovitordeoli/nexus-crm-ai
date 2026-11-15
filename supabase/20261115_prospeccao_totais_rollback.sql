-- NEXUS CRM | V35 ROLLBACK: remove o quadro de números da prospecção (os avisos da V34 continuam).
drop trigger if exists prospecting_totals_same_org on public.prospecting_channel_totals;
drop function if exists public.prospecting_totals_same_org();
drop table if exists public.prospecting_channel_totals;
