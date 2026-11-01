# Dossiê GitHub Intelligence — Nexus CRM

**Data da auditoria:** 1º de novembro de 2026  
**Projeto auditado:** `ojoaovitordeoli/nexus-crm-ai`  
**Escopo:** CRM, UI empresarial, tabelas, funil visual, agentes, automações, segurança e QA.

## Conclusão

A decisão é evoluir o Nexus nativamente em Next.js, React e Supabase. Nenhum CRM ou plataforma externa foi escolhido como núcleo. Os candidatos avaliados possuem runtimes, schemas, workers, licenças ou operações próprias que tornariam uma incorporação direta arriscada.

O Nexus deve extrair padrões e reimplementá-los com seus próprios contratos, identidade visual e modelo de dados. As referências mais úteis são: WACRM para account-scoping, RLS, API keys, webhooks e inbox; XYFlow para o editor controlado de workflows; Refine para separação de data/auth/access/live providers; TanStack Table para tabelas headless; e Playwright como padrão de validação E2E.

## Fontes auditadas

### CRM e operação

- [Twenty](https://github.com/twentyhq/twenty) foi verificado como um CRM extensível com objetos, campos tipados, relações, views Table/Kanban/Calendar, permissões por objeto/campo e layouts configuráveis. Foi classificado como **referência**, não como base. O núcleo usa Vite/React, NestJS, GraphQL, TypeORM, PostgreSQL, Redis e BullMQ. A licença é mista, predominantemente AGPLv3, com pacotes Enterprise/comerciais.
- [EspoCRM](https://github.com/espocrm/espocrm) foi verificado como CRM PHP/SPA com API REST, metadata, ACL, leads, oportunidades, campanhas e extensões. Foi classificado como **referência**, não como base. O frontend usa Backbone/jQuery e o projeto está sob AGPL-3.0-or-later.
- [Atomic CRM](https://github.com/marmelab/atomic-crm) foi verificado como React/Vite/Supabase, com contatos, empresas, tarefas, notas, deals Kanban, histórico, importação/exportação, migrações e testes. Foi classificado como **referência**, não como base. A licença MIT permite reutilização, mas o schema e a arquitetura são próprios.
- [WACRM](https://github.com/ArnasDon/wacrm) foi verificado como Next.js/Supabase/Meta Cloud API, com inbox compartilhada, contatos, pipelines, broadcasts, automações, IA, API REST e MCP. Foi classificado como **referência seletiva**, não como base. O repositório é MIT, mas ainda é pré-1.0 e fortemente acoplado ao domínio WhatsApp.

### UI, dados e workflows

- [Refine](https://github.com/refinedev/refine) foi verificado como framework headless com dataProvider, authProvider, accessControlProvider, routerProvider e liveProvider. A decisão é usar esses contratos como referência, sem introduzir o framework inteiro no Nexus.
- [TanStack Table](https://github.com/TanStack/table) foi verificado como biblioteca headless para filtering, sorting, grouping, selection e pagination client/server-side. A decisão é usar o padrão para tabelas futuras, fixando uma versão compatível e validando o ambiente antes da adoção.
- [XYFlow](https://github.com/xyflow/xyflow) foi verificado como editor controlado de nodes/edges, com nodeTypes, edgeTypes, validação de conexões, provider e persistência serializável. A decisão é usar o canvas somente como Client Component, mantendo execução, autorização e segredos no servidor.

### IA, automação e execução

- [OpenAI Agents JS](https://github.com/openai/openai-agents-js) foi verificado com tools tipadas, handoffs, guardrails, sessões, MCP e tracing. A decisão é referência para agentes server-side; nenhuma chave ou tool deve chegar ao browser.
- [Mastra](https://github.com/mastra-ai/mastra) foi verificado com agents, workflows, memória, storage e observabilidade. A decisão é referência arquitetural, não adoção imediata. Há licença dual, recursos Enterprise source-available e requisitos modernos de Node.
- [Activepieces](https://github.com/activepieces/activepieces) foi verificado com actions/triggers, pieces, workers, Redis, BullMQ, Postgres, retries e execução distribuída. A decisão é não incorporar o núcleo; usar apenas os padrões de integração e ciclo de vida.
- [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) foi verificado com jobs duráveis, retries, filas, concurrency, idempotency keys e human-in-the-loop. A decisão é referência para jobs futuros; uma POC isolada é necessária antes de adicionar infraestrutura externa.

### Qualidade

- [Playwright](https://github.com/microsoft/playwright) foi verificado como padrão maduro de testes E2E, com BrowserContext isolado, locators semânticos, assertions web-first, traces, screenshots, projetos por navegador e emulação responsiva. A decisão é **adotar como padrão de QA** do Nexus.

## O que não será feito

O Nexus não vai incorporar Twenty, EspoCRM, Atomic CRM, Activepieces, Mastra, Trigger.dev ou WACRM como núcleo. Também não serão copiados frontend, identidade visual, código AGPL/Enterprise, tabelas, workers ou componentes proprietários sem triagem de licença e uma POC isolada.

Não serão usados rate limits process-local como controle de segurança, service-role no browser, filtros de tabela convertidos diretamente em SQL, nem workflows tratados como simples canvas sem execução, idempotência, autorização e auditoria.

## Arquitetura escolhida para o Nexus

1. Manter Next.js, React e Supabase como stack principal.
2. Criar módulos account-scoped para contatos, empresas, deals, atividades, notas, tarefas e workflows.
3. Centralizar autorização no servidor e no RLS, com validação de pertencimento em toda operação.
4. Separar dados, autenticação, autorização e realtime por contratos internos testáveis.
5. Persistir workflows como DTO versionado de nodes/edges, com validação de tipos, ciclos e permissões.
6. Usar o canvas visual somente para editar configuração; execução e segredos ficam no servidor.
7. Usar tabelas com filtros, ordenação, seleção e paginação autorizadas no backend.
8. Implementar webhooks com HMAC, limite de payload, deduplicação, processamento assíncrono e retries.
9. Implementar agente inicialmente assistivo, com tools tipadas, aprovação humana para mutações e logs sem dados sensíveis.

## Fluxo CRM prioritário

```text
contato/empresa
  → atividade e qualificação
  → oportunidade/deal
  → mudança de etapa auditável
  → tarefa ou agendamento
  → venda ganha/perdida com motivo
  → dashboard e relatório derivados dos mesmos registros
```

O funil não deve confundir etapa com venda ganha. Mudanças precisam guardar histórico, responsável, timestamp, origem e, quando aplicável, motivo de ganho/perda.

## QA executado

O repositório já possuía um smoke test de navegador em `tests/browser-experience.mjs`. O Chromium necessário não estava instalado. Ele foi instalado e o teste foi executado com sucesso:

```text
PASS: login transitions, authenticated dashboard, Ctrl+K, search, menu click, task shortcut, mobile dialog
```

O teste cobre login e recuperação, dashboard autenticado com dados simulados, busca pela paleta Ctrl+K, navegação para tarefas, criação de tarefa, screenshot desktop e abertura da paleta em viewport mobile.

Esse teste é uma base de qualidade, não prova que todos os módulos do produto estão prontos. Os próximos testes devem cobrir isolamento entre empresas, CRUD real de contatos/deals, mudança de etapa, agenda, WhatsApp, webhooks, automações e aprovação humana.

## Referências

- [1] https://github.com/twentyhq/twenty "Twenty CRM"
- [2] https://github.com/espocrm/espocrm "EspoCRM"
- [3] https://github.com/marmelab/atomic-crm "Atomic CRM"
- [4] https://github.com/ArnasDon/wacrm "WACRM"
- [5] https://github.com/refinedev/refine "Refine"
- [6] https://github.com/TanStack/table "TanStack Table"
- [7] https://github.com/xyflow/xyflow "XYFlow"
- [8] https://github.com/openai/openai-agents-js "OpenAI Agents JS"
- [9] https://github.com/mastra-ai/mastra "Mastra"
- [10] https://github.com/activepieces/activepieces "Activepieces"
- [11] https://github.com/triggerdotdev/trigger.dev "Trigger.dev"
- [12] https://github.com/microsoft/playwright "Playwright"
