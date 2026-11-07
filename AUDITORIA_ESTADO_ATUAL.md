# Auditoria do estado atual — NEXUS CRM AI

**Data:** 07/11/2026 · **Responsável:** Claude (continuidade do dossiê V16)
**Branch de trabalho:** `feat/v17-lead-timeline-role-guards` (local; ver "Entrega" abaixo)

> Convenção: **código** ≠ **configurado em produção** ≠ **homologado ponta a ponta**. Cada afirmação abaixo indica a fonte.

## 1. Versão em produção

| Item | Valor | Fonte |
|---|---|---|
| `main` (GitHub) | `033731f178e0228487f414db87c4b0c5acd4927d` — 01/11/2026 03:58 UTC | `git ls-remote` |
| Render LIVE | `033731f…` · deploy `dep-dbjbhtvlk1mc738pf7pg` · status `live` · trigger `api` | Render API |
| `main` = LIVE? | **Sim** | comparação direta |
| V16 do dossiê (`0fe8873`) | Substituída; deploy `deactivated` | Render API |
| Serviço | `srv-dbh9efgm7kps73e8rv60`, plano **free**, Virginia, `autoDeploy=yes` (commit), sem health check | Render API |
| Logs desde 31/10 | Apenas avisos de cache do webpack no build; nenhum erro de aplicação registrado | Render logs |

### 8 commits após a V16 (todos publicados em 01/11, entre 03:23 e 03:58 UTC)

`630b591` docs auditoria + quality gate · `2f894ec` dashboard menos promocional · `bd81ad6` linguagem/paleta V16 · `118508b` direção visual operacional · `de9b800` shell claro unificado · **`1567616` glassmorphism azul do dashboard v4/v5** · **`72078c6` glass na navegação** · `033731f` remover tipografia genérica.

Arquivos: `app/nexus-v16-product.css` (+215), `app/operation-premium.css` (+86), `NexusExecutiveHome.jsx`, `PremiumOperation.jsx`, `.github/workflows/quality.yml`, 2 docs.

⚠️ **Decisão de produto pendente:** os commits `1567616`/`72078c6` reintroduzem glassmorphism, que o dossiê lista como rejeitado. Não reverti nada — pode ter sido pedido seu. Preciso que confirme se o visual atual em produção é o aprovado.

## 2. Banco de dados real (Supabase "CRM", `qhizuqcdxivdvjtefofz`, leitura apenas)

- 45 tabelas em `public`, **todas com RLS ativo**.
- Volume: 3 empresas (2 ativas), 3 perfis, 3 vínculos, 3 leads, 4 contatos, 0 tarefas, 0 agendamentos, 0 vendas, 3 funis, 5 registros de auditoria. **Não há volume para homologação real**.
- Escritas da UI ativa: **100% via `/api/*` com service role**, que valida sessão, empresa e vínculo no servidor (`app/api/operation/route.js`). O cliente só lê direto (perfil, vínculos, admin).

### Migrações do repositório que NÃO estão aplicadas em produção

| Migração | Efeito em produção |
|---|---|
| `20261028_automation_whatsapp_foundation.sql` | Tabelas `automation_rules`, `automation_executions`, `whatsapp_connections`, `whatsapp_messages` **inexistentes** → Automações e caixa WhatsApp não funcionam em produção (mostram estado "não instalado"). |
| `20261028_ai_insights_quota.sql` | `ai_insight_requests` inexistente → Copiloto responde 503 "controle de limites não instalado". |
| `20261028_admin_manage_organization.sql` | RPC `admin_manage_organization` **inexistente** → ação de gerenciar empresa no Super Admin falha. |

## 3. Riscos P0 confirmados (reproduzidos com as políticas reais)

Exploráveis via PostgREST com a chave pública (que é pública por design) + login de um usuário comum, **contornando a API**:

1. **VIEWER escreve**: políticas INSERT/UPDATE de leads, tarefas, vendas, contatos, agenda, histórico etc. usam `is_org_member()` sem olhar papel. O "somente leitura" só existe na API.
2. **Autoelevação de MANAGER**: `is_org_admin()` inclui MANAGER, e `organization_members` permite a esse papel alterar a própria linha para `ORGANIZATION_ADMIN`/`AGENCY_ADMIN` ou adicionar membros com qualquer papel.
3. **Plano/limites burláveis**: admin de empresa (incluindo MANAGER) pode alterar `plan`, `lead_limit`, `user_limit`, `modules`, `status` da própria empresa.
4. **Usuário suspenso se reativa**: a política de UPDATE do próprio perfil só protege `is_super_admin`, não `status`.
5. **Auditoria forjável**: qualquer membro insere em `audit_logs`.
6. `is_super_admin()` ignora `status` (super admin suspenso mantém acesso RLS).
7. 6 funções `SECURITY DEFINER` executáveis por `anon`; `update_updated_at_column` sem `search_path`; proteção contra senhas vazadas desativada no Auth.

O isolamento **entre empresas** está correto nas políticas (membro de B não lê nem escreve em A) — confirmado no teste local.

**Correção preparada, não aplicada:** `supabase/20261107_p0_rls_role_hardening.sql` + rollback `…_rollback.sql`. Validação em Postgres local (PGlite) com as políticas extraídas de produção (`npm run test:rls`):

```
ANTES (produção):   12 de 24 casos vulneráveis
DEPOIS:             24/24 conforme esperado
ROLLBACK:           volta exatamente às 12 falhas originais
REAPLICADA:         24/24
```

Impacto esperado na UI: nenhum (a UI não escreve direto nessas tabelas). Restrição nova de produto: MANAGER deixa de gerenciar equipe pelo banco (hoje só o Super Admin faz isso, via API).

**Pendente fora do código:** ativar *Leaked password protection* no painel do Supabase Auth.

## 4. Matriz de módulos

| Módulo | Código | Produção | Homologado |
|---|---|---|---|
| Login, recuperação, troca de senha | Sim | Sim (Supabase Auth) | Não (sem teste E2E real) |
| Multiempresa / papéis (API) | Sim, validação server-side | Sim | Parcial: isolamento entre empresas OK nas políticas; papéis no banco com falhas P0 |
| Dashboard V16 + ajustes pós-V16 | Sim | Sim (LIVE) | Visual sem aprovação registrada |
| Mesa de leads, Kanban, editor de funil | Sim | Sim | Mock apenas |
| Retorno vinculado ao lead (`lead_id`) | **Sim (esta entrega)** | Não publicado | Mock + regras |
| Histórico de etapas (`lead_stage_history`) | **Sim (esta entrega)** — tabela já existia, vazia, sem uso | Não publicado | Mock + regras |
| Linha do tempo da ficha | **Sim (esta entrega)** | Não publicado | Mock + regras |
| Tarefas, agenda interna, comparecimento/no-show | Sim (status `no_show` existe) | Sim | Sem dados reais |
| Vendas | Sim; **agora com vendedor e vínculo opcional a lead** | Parcial | Sem dados reais |
| Relatórios / KPIs | Sim, sobre amostra de até 250 registros por tipo | Sim | Receita = soma dos 250 mais recentes (aviso de parcialidade existe) |
| Automações | Sim | **Não** (migração ausente) | Não |
| WhatsApp (inbox leitura) | Sim | **Não** (migração ausente; credenciais Meta não verificadas) | Não |
| Copiloto IA | Sim | **Não** (migração ausente) | Não |
| Super Admin: criar empresa | Sim (RPC existe) | Sim | Não |
| Super Admin: gerenciar empresa | Sim | **Quebrado** (RPC ausente) | Não |
| Segundo Cérebro | Não existe integração | — | — |

## 5. Testes executados nesta sessão

| Comando | Antes (main `033731f`) | Depois (branch) |
|---|---|---|
| `npm ci` | OK | OK (lockfile consistente) |
| `npm test` | 10/10 | **15/15** (+5 em `tests/operation-rules.test.mjs`) |
| `npm run test:rls` | — | **novo**; resultado na seção 3 |
| `npm run build` | OK | OK |
| `npm run test:browser` | Todas as asserções funcionais passam; falha final só por erros de console do sandbox (WebSocket Realtime e 404 bloqueados pelo proxy) | Idem, **incluindo as novas asserções**: retorno enviado com `lead_id`, aba Atividade carrega a linha do tempo |

Observações honestas:
- O teste de navegador usa dados simulados (mock de Supabase/API). Não é teste de produção.
- Chromium do Playwright não baixa neste ambiente; usei o Chrome do sistema via `PLAYWRIGHT_EXECUTABLE_PATH` (variável nova, opcional; CI continua igual).
- Corrigi uma condição de corrida no teste de navegador (checagem do contador logo após o clique) que causou um falso negativo na primeira execução.
- Nenhum teste autenticado com duas empresas reais foi executado: exige contas de teste e staging.

Capturas revisadas: `leads-v17-timeline.png` (ficha com histórico), demais capturas padrão do teste em `test-artifacts/` (não versionado).

## 6. O que esta entrega implementa (P1 + guarda de papel)

1. **Retorno/tarefa vinculado por ID ao lead** — `task_create` aceita `lead_id`, valida que o lead pertence à empresa e grava `tasks.lead_id` (FK já existente). A mesa de leads e o drawer do Kanban enviam o ID. O texto que dizia "não fica vinculada" foi atualizado.
2. **Trilha de mudança de etapa** — `lead_stage` grava `lead_stage_history` (de → para, quem). Se a gravação do histórico falhar, a resposta diz isso explicitamente. Ainda **não é transacional** com a atualização do lead (próximo passo: RPC).
3. **Linha do tempo real na ficha** (aba Atividade) — nova ação `lead_timeline` (leitura, liberada ao VIEWER) que junta histórico de etapas, retornos, agendamentos, vendas e notas **vinculados por FK**. Estados de carregando, erro com "tentar novamente", vazio, parcial e truncado. Diz explicitamente que WhatsApp ainda não entra.
4. **Venda com responsável e vínculo** — `sale_create` grava `seller_id` (usuário logado), `sale_date` e aceita `lead_id` (e herda `contact_id` do lead).
5. **Agendamento com vínculo opcional a lead** — `appointment_create` aceita `lead_id` validado.
6. **Guarda de papel no funil** — `pipeline_model_save` agora exige MANAGER+ no servidor; botões "Configurar funil" somem para SDR/SELLER. Papel desconhecido = sem escrita (falha fechada).
7. Migração P0 de RLS + rollback + teste automatizado (não aplicada).

Arquivos: `app/api/operation/route.js`, `lib/operation-rules.mjs` (novo), `components/NexusOpportunityDesk.jsx`, `components/NexusLeadDetail.jsx`, `components/PremiumOperation.jsx`, `components/StaffWorkspace.jsx`, `app/nexus-opportunity-desk.css` (+7 linhas na folha do próprio componente, sem nova camada), `tests/*`, `supabase/20261107_*`, `.github/workflows/build.yml`, `package.json` (+devDependency `@electric-sql/pglite`, Apache-2.0).

## 7. Entrega, deploy e rollback

- **Push bloqueado nesta sessão**: o GitHub App do Claude não tem permissão de escrita no repositório. O trabalho está commitado localmente e foi entregue como *git bundle* + patch.
- **Nada foi publicado no Render e nenhum SQL foi executado em produção.** Produção segue em `033731f`.
- Rollback do código: reverter o commit (mudanças retrocompatíveis; colunas usadas já existiam).
- Rollback do banco (se a migração for aplicada): `supabase/20261107_p0_rls_role_hardening_rollback.sql`.

## 8. Próximos passos priorizados

**P0**
1. Aplicar `20261107_p0_rls_role_hardening.sql` (requer sua autorização) e ativar proteção de senhas vazadas.
2. Decidir sobre as 3 migrações pendentes (automação/WhatsApp, IA, gerenciar empresa). Recomendo aplicar primeiro `admin_manage_organization` (corrige botão quebrado), revisando o SQL antes.
3. Criar 2 empresas e 5 contas de teste (um por papel) para E2E autenticado em staging/branch do Supabase.

**P1**
4. Mudança de etapa + histórico em RPC transacional; registrar motivo de perda.
5. Fluxo agendamento → comparecimento/no-show → venda a partir da ficha do lead (as colunas já existem).
6. Notas na ficha (tabela `notes` existe, sem UI).

**P2**
7. KPIs agregados no servidor (contagem e soma por período, sem limite de 250) e filtros server-side.

**P5**
8. Remover código morto de escrita direta em `components/CRM.jsx` (rotas legadas não alcançáveis) e planejar consolidação das 28 folhas CSS carregadas em `app/`.
