-- NEXUS CRM: compatibilidade com o cadastro de empresas da tela /admin
-- Executar UMA VEZ no SQL Editor do projeto Supabase do CRM.
-- Nao modifica empresas existentes, usuarios ou senhas.

CREATE OR REPLACE FUNCTION public.admin_create_organization(
  p_name text, p_plan text, p_slug text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org_id uuid;
  v_pipeline_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND is_super_admin IS TRUE AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: somente Super Admin ativo';
  END IF;

  IF length(btrim(coalesce(p_name,''))) < 2 OR
     length(btrim(coalesce(p_slug,''))) < 2 THEN
    RAISE EXCEPTION 'Nome ou identificador da empresa invalido';
  END IF;
  IF p_plan IS NULL OR p_plan NOT IN ('free','starter','pro','enterprise') THEN
    RAISE EXCEPTION 'Plano invalido';
  END IF;

  INSERT INTO public.organizations(name, slug, plan)
  VALUES (btrim(p_name), btrim(p_slug), p_plan)
  RETURNING id INTO v_org_id;

  INSERT INTO public.pipelines(organization_id, name, is_default, position)
  VALUES (v_org_id, 'Pipeline Padrão', TRUE, 0)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.pipeline_stages
    (pipeline_id, name, color, position, is_won, is_lost)
  VALUES
    (v_pipeline_id, 'Novo Lead', '#3b82f6', 0, FALSE, FALSE),
    (v_pipeline_id, 'Contato Inicial', '#06b6d4', 1, FALSE, FALSE),
    (v_pipeline_id, 'Qualificado', '#8b5cf6', 2, FALSE, FALSE),
    (v_pipeline_id, 'Proposta Enviada', '#f59e0b', 3, FALSE, FALSE),
    (v_pipeline_id, 'Negociação', '#f97316', 4, FALSE, FALSE),
    (v_pipeline_id, 'Agendamento', '#ec4899', 5, FALSE, FALSE),
    (v_pipeline_id, 'Fechado', '#10b981', 6, TRUE, FALSE),
    (v_pipeline_id, 'Perdido', '#ef4444', 7, FALSE, TRUE);

  RETURN v_org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_organization(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_organization(text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
