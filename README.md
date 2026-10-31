# NEXUS CRM AI

CRM multiempresa com painel operacional, Super Admin, dashboard, funil de leads, contatos, tarefas, agenda interna, relatórios e módulos opcionais de automação, WhatsApp oficial e copiloto de IA.

**Ambiente principal:** https://nexus-crm-ai.onrender.com  
**Hospedagem:** Render · **Banco/Auth:** Supabase · **Código:** Next.js 15.5.28, React 19.2.9.

## Estado dos módulos

| Módulo | Situação |
|---|---|
| Login, recuperação de senha e Super Admin | Implementado, requer configuração válida do Supabase |
| Dashboard, leads, contatos, agenda interna e tarefas | Implementado com APIs autenticadas e escopo por empresa |
| Kanban e relatórios CSV | Implementados, dependem das tabelas existentes |
| Busca Ctrl + K e tour interativo | Implementados com cmdk e Driver.js |
| Animações e visual V4/V5 | Implementados em CSS/React; comparação visual com vídeos ainda pendente |
| Automações internas | Código pronto; depende da migração SQL abaixo |
| Visualização de fluxo React Flow | Implementada; permite inspecionar e editar a regra suportada pelo executor |
| WhatsApp Cloud API | Webhook assinado e caixa de entrada somente leitura; precisa migração, configuração e assinatura na Meta |
| Copiloto de IA | Código pronto para análise somente leitura com consentimento; precisa migração e API key |

**Importante:** o aplicativo não envia mensagens pelo WhatsApp dentro do CRM, não executa agentes que tomam ações sem aprovação e não sincroniza o calendário com serviços externos. Não considere essas integrações ativas antes de configurá-las e testá-las.

## Desenvolver e verificar

```bash
npm install
npm test
npm run build
npm run dev
```

A GitHub Action executa testes de segurança e build no PR e na branch principal. Isso não substitui testes autenticados e end-to-end.

## Variáveis de ambiente

Configure somente no painel de Environment do Render ou em um arquivo `.env.local` **fora do Git**:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=CHAVE_PUBLICA
SUPABASE_SERVICE_ROLE_KEY=SEGREDO_SERVIDOR
META_APP_SECRET=SEGREDO_DA_APP_META
META_WEBHOOK_VERIFY_TOKEN=TOKEN_DE_VERIFICACAO_META
OPENAI_API_KEY=CHAVE_API_DE_IA
OPENAI_MODEL=gpt-6-luna
```

A chave `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET` e `OPENAI_API_KEY` **nunca** podem usar o prefixo `NEXT_PUBLIC_` nem aparecer no navegador, em commits ou mensagens de chat.

## Ativar automações e WhatsApp

1. No Supabase SQL Editor, revisar e executar `supabase/20261028_automation_whatsapp_foundation.sql`. O script adiciona tabelas novas, habilita RLS e restringe consultas diretas a servidores autorizados.
2. Para WhatsApp, configurar `META_APP_SECRET` e `META_WEBHOOK_VERIFY_TOKEN` em Render e registrar a URL `https://nexus-crm-ai.onrender.com/api/webhooks/whatsapp` em Meta Developers, assinando eventos de mensagens.
3. Entrar no Super Admin, escolher a empresa e cadastrar o **Phone Number ID** da Meta na área de WhatsApp. A conexão só se torna ativa quando um evento assinado é recebido.
4. Para automações, entrar em `/automations`, criar uma regra, ativá-la e mover um lead de etapa. Conferir se uma tarefa foi criada e auditada. A execução é idempotente por regra/lead/etapa.

Instruções detalhadas: [Fase 2 — segurança e ativações](docs/fase2-implementacao-segura.md).

## Ativar o copiloto

1. Executar `supabase/20261028_ai_insights_quota.sql` no Supabase SQL Editor.
2. Configurar `OPENAI_API_KEY` em Render e, opcionalmente, `OPENAI_MODEL` com um modelo permitido na sua conta.
3. Acessar `/insights`. Antes da consulta, o usuário precisa confirmar o envio da pergunta e das métricas agregadas. O modelo não recebe contatos individuais nem conversas do WhatsApp.

Instruções: [Copiloto e React Flow](docs/copiloto-ia-e-reactflow.md).

## Acesso, privacidade e testes pendentes

- A autorização é verificada no servidor por sessão Supabase, perfil e empresa.
- As novas tabelas de automações, mensagens e uso de IA são acessíveis somente pelo servidor com `service_role`; não são expostas diretamente a usuários comuns.
- Antes de comercializar, validar o isolamento de dados com **dois usuários de duas empresas**, os papéis VIEWER/SELLER/MANAGER/Super Admin, concorrência, idempotência, importações e a retenção de dados pela LGPD.
- As mensagens recebidas são armazenadas como dados pessoais. Definir base legal, retenção, política de acesso e procedimento de exclusão antes de uso amplo.
- Priorizar testes E2E autenticados, observabilidade, limitação de requisições por IP e prevenção de spam antes de escalar.

## Evolução funcional baseada nas referências

- O workspace operacional atualiza leads, vendas, agenda, tarefas e contatos por Supabase Realtime, com recarga ao retornar à aba e polling de segurança.
- O plano de evolução do funil configurável, Command Center, agente de IA, skills, base de conhecimento e integrações está documentado no [dossiê de referências de IA](docs/dossie-referencias-ia-instagram.md).
- A versão PDF do dossiê está disponível em [`docs/dossie-referencias-ia-instagram.pdf`](docs/dossie-referencias-ia-instagram.pdf).
- A análise comparativa aprofundada do sistema óptico, com o diagnóstico do Nexus e a ordem correta de reconstrução, está em [`docs/analise-comparativa-optica-v2.md`](docs/analise-comparativa-optica-v2.md) e [`docs/analise-comparativa-optica-v2.pdf`](docs/analise-comparativa-optica-v2.pdf).
- O plano de produto está em [`plan.md`](plan.md) e os critérios funcionais estão em [`TODO.md`](TODO.md).

## Arquitetura

- `components/` — painéis, Kanban, automações, inbox, copiloto e onboarding.
- `app/api/operation/` — API das operações principais do CRM.
- `app/api/automations/` — regras por empresa; `lib/automation-runner.js` — execução idempotente.
- `app/api/webhooks/whatsapp/` — webhook oficial com HMAC.
- `app/api/whatsapp/inbox/` — leitura e cadastro protegido de números.
- `app/api/insights/` — respostas de IA, quotas e consentimento.
- `lib/tenant-session.js` — autenticação/isolamento dos novos módulos.
- `tests/` — testes de regressão e validação de eventos assinados.
- `supabase/` — scripts SQL sujeitos a revisão e execução pelo responsável do banco.

[Auditoria de código aberto e roadmap](docs/auditoria-open-source-2026-10.md).
