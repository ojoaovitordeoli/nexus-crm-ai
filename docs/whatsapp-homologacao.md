# Homologação do WhatsApp Cloud API oficial — NEXUS CRM

Data: 07/11/2026 · Escopo: P3 (integração), com itens P0 de segurança.

## Estado verificado (não presumido)

| Item | Estado | Evidência |
|---|---|---|
| Webhook `app/api/webhooks/whatsapp/route.js` | Código pronto | Verifica `hub.verify_token` (GET) e HMAC `x-hub-signature-256` sobre o corpo bruto antes do parse (POST); limite de 1 MB; organização resolvida só por `phone_number_id` previamente registrado. |
| Parser `extractWhatsAppEvents` (`lib/workflow-security.mjs`) | Testado | 3 testes em `tests/workflow-security.test.mjs` (assinatura falsa, challenge, sanitização). |
| Caixa `app/api/whatsapp/inbox/route.js` | **Somente leitura** | GET lista conexões e 250 mensagens; POST só registra número (Super Admin). Não há envio. |
| Migração `supabase/20261028_automation_whatsapp_foundation.sql` | **Não aplicada** no projeto Supabase "CRM" | Consulta em `pg_class`: `whatsapp_connections`, `whatsapp_messages`, `automation_rules`, `automation_executions` inexistentes. |
| Variáveis `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` no Render | Não verificado | Conector do Render sem autorização nesta sessão. |
| Vínculo mensagem → contato/lead | Inexistente | Tabela não tem `contact_id`/`lead_id`; a UI casa nome por sufixo de telefone no cliente (`components/NexusWhatsAppInbox.jsx:45`). |
| Baseline | `npm test` 17/17 ok | `npm run build` e `test:browser` não executados nesta etapa. |

Consequência: hoje, com a migração ausente, o webhook responde 503 a qualquer evento válido e a caixa mostra o aviso de migração. Nada está recebendo mensagens em produção.

## Lacunas encontradas no código

1. **Leitura sem filtro de papel (P0/LGPD).** O GET da caixa aceita qualquer membro ativo, inclusive `VIEWER`, e devolve texto de conversas. Definir quem pode ler (sugestão: `SELLER`, `SDR`, `MANAGER`, admins) e testar o negativo com `VIEWER` e com outra empresa.
2. **`can_register` incoerente.** A resposta usa `role==='AGENCY_ADMIN'`, mas o POST exige `profiles.is_super_admin`. Hoje coincidem porque `authorizeTenant` mapeia super admin para `AGENCY_ADMIN`; se um membro tiver papel `AGENCY_ADMIN` na tabela, a UI mostra o botão e o POST recusa. Basear os dois no mesmo critério.
3. **Erro de status ignorado.** O update de `delivery_status` não checa `error`; falha silenciosa. Logar sem dados pessoais.
4. **Ativação por mensagem.** A conexão vira `active` no primeiro evento assinado. Aceitável, mas registrar quem/quando em trilha de auditoria.
5. **Retenção LGPD.** O comentário da tabela pede retenção, mas não há política nem rotina. Definir prazo antes de receber dados reais.
6. **Vínculo a contato.** Normalizar telefone (E.164, tratar 9º dígito BR) no servidor e gravar `contact_id` / `lead_id` por FK, escopado por `organization_id`.

## Plano de homologação (ordem)

**Etapa 0 — pré-requisitos (usuário)**
- App na Meta (developers.facebook.com) com produto WhatsApp e número de **teste** da própria Meta.
- Definir `META_APP_SECRET` e `META_WEBHOOK_VERIFY_TOKEN` no Render (variáveis protegidas; nunca no chat/commit).
- Autorizar o conector do Render (`/mcp`) para conferir o SHA live.

**Etapa 1 — correções antes de aplicar o banco** (branch própria, testes unitários)
- Itens 1, 2 e 3 acima, com testes negativos (VIEWER, outra empresa, sem sessão).
- Migração complementar versionada: `contact_id uuid null references contacts(id) on delete set null`, `lead_id` idem, índice por `(organization_id, contact_id)`; rollback documentado (`drop column`).

**Etapa 2 — aplicar migrações** (somente com autorização explícita)
- Aplicar `20261028_automation_whatsapp_foundation.sql` + complementar no Supabase. Idealmente primeiro numa branch do Supabase (staging).
- Conferir: RLS ativo, sem políticas, `anon`/`authenticated` sem grant, `service_role` com grant.

**Etapa 3 — webhook real com número de teste**
- Registrar callback `https://nexus-crm-ai.onrender.com/api/webhooks/whatsapp` na Meta e assinar o campo `messages`.
- Super Admin registra o Phone Number ID na empresa de teste.
- Enviar mensagem do celular → conferir linha em `whatsapp_messages`, conexão `active`, mensagem visível só na empresa certa.
- Negativos: POST sem assinatura (401), assinatura errada (401), `phone_number_id` não registrado (ignorado), payload repetido (sem duplicar).

**Etapa 4 — vínculo e atendimento**
- Casar `wa_id` com contato da empresa no servidor; criar lead/contato novo só por ação humana ou regra auditada.
- Mostrar a conversa na ficha do lead.

**Etapa 5 — envio (só depois das anteriores)**
- `POST /api/whatsapp/send` com autorização por papel, janela de 24 h da Meta, templates aprovados fora da janela, gravação `direction='outbound'` e status via webhook.
- Atendente humano envia; sugestão por IA fica para P4.

## Critério de pronto
Mensagem real recebida e enviada no número de teste, vinculada ao contato correto, invisível para outra empresa e para `VIEWER` (se assim decidido), com testes automatizados dos negativos e SHA live conferido no Render.

## Etapa 1 — feita em 07/11/2026 (branch `feat/whatsapp-etapa1-seguranca`)
- Caixa: `VIEWER` e papéis desconhecidos recebem 403 (`readWhatsAppRole`).
- Registro de número e `can_register` usam o mesmo critério: `isSuperAdmin` devolvido por `authorizeTenant`.
- Webhook: erro de status é logado sem dados pessoais; remetente é vinculado a contato **da mesma empresa** só quando há exatamente um telefone compatível (com/sem 55 e 9º dígito); lead = mais recente do contato. Sem coluna de vínculo, grava a mensagem sem ele.
- Migração `supabase/20261107_whatsapp_contact_link.sql`: colunas `contact_id`/`lead_id`, índices e trigger que recusa vínculo a outra empresa; rollback no fim do arquivo. **Não aplicada.**
- Testes: `npm test` 12/12, `npm run build` ok. Não testado contra banco real (fica para Etapa 2/3).
- Limites conhecidos: busca de contato pega até 50 candidatos pelos 4 últimos dígitos; retenção LGPD e trilha de auditoria da ativação seguem pendentes.
