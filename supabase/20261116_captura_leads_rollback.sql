-- NEXUS CRM | V42 ROLLBACK: remove as chaves de captura de leads.
-- Os leads que já entraram (contacts, leads, notes) ficam; só as chaves deixam de existir.
drop table if exists public.lead_capture_tokens;
