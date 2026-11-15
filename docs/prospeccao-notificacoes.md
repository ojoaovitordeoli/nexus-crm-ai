# Prospecção automática → NEXUS (V34)

Aba **Prospecção** (`/prospeccao`): avisos de quem respondeu o e-mail do Harvey com interesse, pergunta ou objeção, e de vendas e leads quentes avisados pelo agente de WhatsApp. Visível só para **Admin da empresa, Admin da agência e Super Admin** (regra `canSeeProspecting` em `lib/prospecting-alerts.mjs`, conferida no servidor).

## Estado

| Parte | Estado |
|---|---|
| Migração `supabase/20261115_prospeccao_notificacoes.sql` | Versionada, **não aplicada** em produção. Rollback: `..._rollback.sql` |
| API `/api/prospecting-alerts` (tela) e `/api/prospecting-alerts/ingest` (vigia) | No código; responde `503 not_installed` enquanto a migração não for aplicada |
| Tela | Mostra "Ainda não ativado" sem a migração; nenhum dado de exemplo |
| Vigia local (`vigia_nexo.py`) | Ainda não chama o endpoint |

## Segurança

- Tabelas `prospecting_alerts` e `prospecting_ingest_tokens`: RLS ligado, **sem políticas** e privilégios revogados de `anon`/`authenticated`. Só a API (service_role) acessa, sempre filtrando por `organization_id`.
- Leitura e tratamento: sessão Supabase + empresa ativa + vínculo ativo + papel (`authorizeTenant` + `canSeeProspecting`).
- Entrada do vigia: **token por empresa**, gerado na própria tela pelo admin, exibido uma única vez. O banco guarda só o SHA-256 e os 6 últimos caracteres. A empresa é descoberta pelo token; `organization_id`, `status` ou qualquer outro campo de controle no corpo são ignorados.
- Gerar token novo revoga o anterior; "Desligar vigia" revoga todos.
- Gatilho no banco impede aviso apontando para token de outra empresa. Duplicatas são barradas por `(organization_id, source, external_id)`.
- Mudanças de situação e de token ficam em `audit_logs`.

## Contrato do endpoint de entrada

```
POST https://nexus-crm-ai.onrender.com/api/prospecting-alerts/ingest
Authorization: Bearer nxp_<43 caracteres>
Content-Type: application/json
```

O token fica num arquivo de configuração/variável de ambiente do vigia (ex.: `NEXUS_PROSPECCAO_TOKEN`), nunca no código nem em mensagens.

### Corpo

Um aviso, ou `{"alerts": [ ... ]}` com até 50 avisos. Máximo 64 KB.

| Campo | Obrigatório | Regra |
|---|---|---|
| `source` | sim | `harvey_email` (e-mail) ou `whatsapp_agent` (agente de WhatsApp). Define o canal. |
| `kind` | sim | `interesse`, `pergunta`, `objecao`, `venda`, `lead_quente`, `outro` |
| `external_id` | sim | Id único e estável do evento na origem (ex.: Message-ID do Gmail, id da conversa + data). Até 200 caracteres. Reenviar o mesmo id não duplica. |
| `company_name` | um destes 4 | Até 200 caracteres |
| `contact_name` | um destes 4 | Até 200 caracteres |
| `contact_email` | um destes 4 | E-mail válido |
| `contact_phone` | um destes 4 | DDD + número (10–11 dígitos, recebe 55) ou com DDI (12–15 dígitos). Gera o link `https://wa.me/...` |
| `message` | não | O que a pessoa disse. Cortado em 2.000 caracteres. |
| `occurred_at` | não | ISO 8601. Padrão: hora do recebimento. Não aceita data mais de 5 min no futuro. |

Exemplo:

```json
{
  "source": "harvey_email",
  "kind": "interesse",
  "external_id": "<CAF1234@mail.gmail.com>",
  "company_name": "Ótica Exemplo",
  "contact_name": "Fulana",
  "contact_email": "fulana@exemplo.com.br",
  "contact_phone": "48999990000",
  "message": "Tenho interesse, pode me mandar os valores?",
  "occurred_at": "2026-11-15T10:30:00-03:00"
}
```

### Totais por canal (V35, quadro "Números da prospecção")

No mesmo endpoint, o vigia pode mandar (junto com `alerts` ou sozinho) os totais acumulados por canal de **origem**:

```json
{"totals": [
  {"channel": "email", "sent": 600, "replied": 18, "interested": 6, "sales": 2, "revenue": 594.0, "measured_at": "2026-11-15T10:00:00-03:00"},
  {"channel": "whatsapp", "sent": 40, "replied": 9, "interested": 3, "sales": 1, "revenue": 997.0}
]}
```

- `channel`: `email` ou `whatsapp` (1 ou 2 canais, sem repetir). Venda que começou no e-mail e fechou no WhatsApp conta como `email`.
- `sent` (contatados), `replied`, `interested`, `sales`: inteiros ≥ 0. `revenue`: reais (número). `measured_at`: opcional, ISO.
- Cada envio **substitui** o total daquele canal (não soma). Tabela `prospecting_channel_totals` (migração `20261115_prospeccao_totais.sql`, rollback ao lado).
- Resposta 200 traz `totals_saved`.

### Respostas

| Status | Quando | Corpo |
|---|---|---|
| 200 | Recebido | `{"ok":true,"received":2,"created":1,"duplicates":1,"rejected":[{"index":3,"error":"..."}]}` |
| 400 | JSON inválido, lote vazio/maior que 50, nenhum aviso válido | `{"error":"...","rejected":[...]}` |
| 401 | Token ausente, em formato errado, inválido, revogado ou de empresa inativa | `{"error":"..."}` |
| 413 | Corpo acima de 64 KB | |
| 415 | Sem `Content-Type: application/json` | |
| 503 | Banco indisponível ou migração não aplicada (`code:"not_installed"`) | Reenviar depois é seguro (não duplica) |

Orientação para o vigia: em 503 ou erro de rede, tentar de novo com espera crescente; em 401, parar e avisar o dono (token trocado/desligado); em 400, registrar `rejected` no log local sem reenviar.

### Teste rápido (depois da migração e do token)

```bash
curl -s -X POST https://nexus-crm-ai.onrender.com/api/prospecting-alerts/ingest -H "Authorization: Bearer $NEXUS_PROSPECCAO_TOKEN" -H "Content-Type: application/json" -d '{"source":"harvey_email","kind":"pergunta","external_id":"teste-1","company_name":"Teste","message":"teste de ligação"}'
```

Depois, marcar esse aviso como "Descartado" na tela.

## Ativação (precisa de OK do dono)

1. Aplicar `supabase/20261115_prospeccao_notificacoes.sql` no Supabase de produção.
2. Fazer o deploy da branch/PR.
3. Admin entra em **Prospecção → Gerar token** e coloca o token no vigia.
4. Ligar o envio no `vigia_nexo.py` seguindo o contrato acima.

## Testes

- `tests/prospecting-alerts.test.mjs`: papéis, token, validação, entrada isolada por empresa, acesso cruzado (admin da empresa B não lê nem altera aviso da A), MANAGER/SELLER/SDR/VIEWER negados.
- `tests/prospecting-db.test.mjs` (PGlite): RLS/privilégios negam `anon` e `authenticated`, deduplicação, trava de token entre empresas, checagens de valores, rollback e reaplicação.
- `tests/browser-experience.mjs`: aba em 1440/768/390 px sem rolagem horizontal, link do WhatsApp e troca de situação.
