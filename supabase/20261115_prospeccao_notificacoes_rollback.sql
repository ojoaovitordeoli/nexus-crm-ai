-- NEXUS CRM | V34 ROLLBACK: remove as notificações da prospecção automática.
-- ATENÇÃO: apaga os avisos recebidos e os tokens do vigia. Exporte antes se precisar guardar.
drop trigger if exists prospecting_alerts_same_org on public.prospecting_alerts;
drop function if exists public.prospecting_alerts_same_org();
drop table if exists public.prospecting_alerts;
drop table if exists public.prospecting_ingest_tokens;
