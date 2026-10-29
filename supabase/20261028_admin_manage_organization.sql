-- NEXUS CRM • Ciclo de vida de empresas
-- Executar no SQL Editor do projeto Supabase após revisar.
-- Arquivar/restaurar é reversível. Excluir exige nome exato e empresa sem registros operacionais.
-- Nenhuma empresa é alterada automaticamente por este script.

CREATE OR REPLACE FUNCTION public.admin_manage_organization(
  p_org_id uuid,
  p_action text,
  p_confirm_name text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_org public.organizations%ROWTYPE;
  v_dep record;
  v_has_rows boolean;
  v_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_super_admin IS TRUE
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Somente o Super Admin ativo pode gerenciar empresas';
  END IF;

  SELECT * INTO v_org
    FROM public.organizations
    WHERE id = p_org_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Empresa nao encontrada'; END IF;

  IF p_action = 'archive' THEN
    IF v_org.status = 'archived' THEN RETURN 'Empresa ja arquivada'; END IF;
    UPDATE public.organizations SET status='archived' WHERE id=p_org_id;
    v_status := 'Empresa arquivada';

  ELSIF p_action = 'restore' THEN
    IF v_org.status <> 'archived' THEN
      RAISE EXCEPTION 'Somente empresas arquivadas podem ser restauradas';
    END IF;
    UPDATE public.organizations SET status='active' WHERE id=p_org_id;
    v_status := 'Empresa restaurada';

  ELSIF p_action = 'delete' THEN
    IF v_org.status <> 'archived' THEN
      RAISE EXCEPTION 'Arquive a empresa antes de solicitar exclusao definitiva';
    END IF;
    IF p_confirm_name IS DISTINCT FROM v_org.name THEN
      RAISE EXCEPTION 'Nome de confirmacao nao corresponde ao nome da empresa';
    END IF;

    -- Todas as tabelas com FK direta para organizations são examinadas.
    -- Pipeline padrão e vínculos de usuários são metadados administrativos.
    -- Qualquer dado operacional (leads, conversas, tarefas, documentos,
    -- campanhas etc.) bloqueia a exclusão em vez de acionar CASCADE.
    FOR v_dep IN
      SELECT n.nspname, c.relname, a.attname
      FROM pg_catalog.pg_constraint f
      JOIN pg_catalog.pg_class c ON c.oid=f.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_attribute a
        ON a.attrelid=f.conrelid AND a.attnum=f.conkey[1]
      WHERE f.contype='f'
        AND f.confrelid='public.organizations'::pg_catalog.regclass
        AND pg_catalog.array_length(f.conkey,1)=1
        AND n.nspname='public'
        AND c.relname NOT IN ('pipelines','organization_members','audit_logs')
    LOOP
      EXECUTE pg_catalog.format(
        'SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',
        v_dep.nspname,v_dep.relname,v_dep.attname
      ) INTO v_has_rows USING p_org_id;

      IF v_has_rows THEN
        RAISE EXCEPTION
          'A empresa possui dados em %. Arquive-a para preservar registros.',
          v_dep.relname;
      END IF;
    END LOOP;

    -- Preserva o histórico de auditoria, sem FK para a empresa que será excluída.
    UPDATE public.audit_logs SET organization_id=NULL WHERE organization_id=p_org_id;
    DELETE FROM public.organizations WHERE id=p_org_id;
    v_status := 'Empresa excluida definitivamente';
  ELSE
    RAISE EXCEPTION 'Acao invalida: use archive, restore ou delete';
  END IF;

  INSERT INTO public.audit_logs(
    user_id, action, entity_type, entity_id, before, after
  ) VALUES (
    auth.uid(), 'organization_' || p_action, 'organization', p_org_id,
    pg_catalog.jsonb_build_object('name',v_org.name,'status',v_org.status),
    pg_catalog.jsonb_build_object(
      'name',v_org.name,
      'status', CASE WHEN p_action='archive' THEN 'archived'
                     WHEN p_action='restore' THEN 'active' ELSE 'deleted' END
    )
  );

  RETURN v_status;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_organization(uuid,text,text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_organization(uuid,text,text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
