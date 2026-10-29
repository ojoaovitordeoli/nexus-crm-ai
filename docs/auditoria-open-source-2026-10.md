# Auditoria de código aberto e evolução do NEXUS CRM
Atualização: 28/10/2026 · Base: Next.js 14, React 18, Supabase, Render, GitHub
Destinação: projeto interno e potencial produto comercial multiempresa (SaaS)

## Escopo verificado
Auditoria da árvore completa do repositório `ojoaovitordeoli/nexus-crm-ai` (arquivos rastreados no GitHub) e triagem de repositórios públicos relevantes. **Não foi feita varredura literal de todo o GitHub, execução de testes end-to-end no painel autenticado ou leitura do banco de dados de produção.** Comparações visuais de vídeo exigem revisão dos quadros originais.

Arquivos principais: `components/CRM.jsx`, `components/StaffWorkspace.jsx`, `components/PremiumOperation.jsx`, `components/MotionCalendar.jsx`, `app/api/operation/route.js`, `app/api/admin/*`, `lib/supabase.js`, `app/*.css`, `supabase/*.sql`.

### P0 — Riscos e limitações reais
1. **Segurança do framework:** Next 14.2.35 está na faixa afetada por avisos críticos de outubro/2026. Patch experimental separado em PR #1 para Next 15.5.28 e React 19.2.9. **Validar login, autorização, CRUD e navegação antes do merge e deploy.** Referência: https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw
2. **Sem suíte E2E ou testes de permissão:** a automação atual verifica build apenas. Criar testes de fluxos de usuário comum, super admin, isolamento de empresas, erro de credencial, cadastro de tarefa, agenda e regressões visuais.
3. **Esquema do banco incompleto no repositório:** contém scripts de correção, mas não um conjunto versionado completo das tabelas, constraints, RLS, índices e migrações. Criar baseline validado sem tocar dados existentes.
4. **Integrações externas não conectadas:** menu de WhatsApp mostra status pendente; não há webhook, armazenamento de mensagens, autenticação por telefone, fila nem conector para Google Calendar. Não afirmar sincronização ou agente ativo.
5. **CSS acumulado:** há estilos de gerações diferentes na mesma aplicação. Consolidar tokens, tipografia, animações e prioridade de seletores; medir desempenho e acessibilidade.
6. **Operações administrativas e dados sensíveis:** preservar SERVICE_ROLE apenas no servidor, validar empresa e papel antes de escrever, aplicar idempotência e auditoria. Nunca expor tokens no navegador ou em repositório.

## Projetos pesquisados e potencial de aplicação
| Ordem | Projeto | Licença observada | Uso concreto | Dependência/atenção |
|---|---|---|---|---|
| 1 | [Motion](https://github.com/motiondivision/motion) | MIT | Transições, gestos, layout, efeitos de sequência do dashboard e painéis | Adotar progressivamente; medir FPS, reduzir movimento |
| 2 | [cmdk](https://github.com/dip/cmdk) | MIT | Paleta Ctrl+K para navegação e ações | **Implementado** no workspace; validação visual no navegador ainda pendente |
| 3 | [TanStack Table](https://github.com/TanStack/table) | MIT | Filtros, ordenação, seleção, colunas e paginação de leads/contatos | API paginada antes de usar em milhares de registros |
| 4 | [React Flow](https://github.com/xyflow/xyflow) | MIT | Construtor visual de automações: gatilho → condição → ação | Necessita motor de execução e permissões; editor sozinho não automatiza |
| 5 | [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | Apache-2.0 | Jobs duráveis, follow-up, retries, agendamentos, filas | Exige serviço de execução separado; nada em segredo no frontend |
| 6 | [Activepieces](https://github.com/activepieces/activepieces) | Core MIT; EE comercial | Conectar serviços, modelos de automação, execução de fluxos | Confirmar licença de cada módulo e modelo de hospedagem |
| 7 | [CopilotKit](https://github.com/CopilotKit/CopilotKit) | MIT | Copiloto contextual para leads, sugestões de tarefas e interface de IA | Requer backend autenticado com tools autorizadas |
| 8 | [Mastra](https://github.com/mastra-ai/mastra) | Core Apache-2.0; EE comercial | Agentes TypeScript, workflow e ferramentas | Isolar prompts e credenciais por organização |
| 9 | [Langfuse](https://github.com/langfuse/langfuse) | Core MIT; EE restrita | Observabilidade, avaliação, custos e rastreabilidade de agentes | Cuidado com dados pessoais nos traces |
| 10 | [Chatwoot](https://github.com/chatwoot/chatwoot) | Community MIT; EE comercial | Referência de caixa de entrada omnichannel, times, mensagens e etiquetas | Aplicação Rails/Vue; conectar API ou adaptar conceitos, não copiar stack toda |
| 11 | [Driver.js](https://github.com/driverjs/driver.js) | MIT | Tour para novos funcionários e demonstração comercial | Tour deve funcionar com os seletores reais |
| 12 | [AI SDK](https://github.com/vercel/ai) | Verificar licença do pacote | Chat e streaming de agentes sem prender a um provedor | Escolher provedor, configurar limites e proteção contra abuso |
| 13 | [Meta WhatsApp Cloud API samples](https://github.com/fbsamples/whatsapp-api-examples) | Meta Platform Policy | Webhooks assinados, recebimento e envio oficial | Precisa cadastro Meta, token, número e autorização por empresa |
| Referência | [n8n](https://github.com/n8n-io/n8n) | Sustainable Use License, **não open source OSI** | Inspiração e automações internas, sujeito à licença | Não embutir/revender como parte do SaaS sem analisar acordo comercial |
| Ressalva | [Evolution API](https://github.com/evolution-foundation/evolution-api) | Apache-2.0 com condições adicionais de marca/notificação | Avaliar conectores especializados | Revisar licença e requisitos, riscos de transporte não oficial |

Fontes primárias de licença e funcionalidade: READMEs, LICENSE de cada projeto; verificadas em 28/10/2026. A escolha do software deve ser revisada antes do empacotamento comercial.

## Sequência de implementação recomendada

### Fase A — estabilizar e validar
- Merge do patch crítico de Next somente após CI e validação autenticada.
- Testes Playwright com usuários de papéis diferentes e duas empresas; proibir leitura entre organizações.
- Versionar esquema Supabase e controles de RLS.
- Verificar Web Vitals, LCP, CLS, FPS, modo de movimento reduzido e navegação por teclado.
- Consolidar camadas CSS V4/V5/motion, remover duplicações e regressões.
- Criar ambiente de staging seguro que não use o banco de produção sem isolamento.

### Fase B — experiência premium operacional
- Comando Ctrl+K já presente, com busca em registros carregados. Evoluir para pesquisa global server-side com paginação.
- Adotar Motion nos componentes que pedem spring, drag e transições; não animar tudo sem hierarquia.
- Aplicar TanStack Table a contatos e leads, com paginação no backend e importação CSV com prévia e deduplicação.
- Usar Driver.js para tour de onboarding, com botão de reiniciar o tour.
- Criar timeline de atendimento, notas, tags e histórico com permissões.

### Fase C — automação realmente funcional
- Configurar uma tabela de automações por organização (trigger, condições, versão, status, auditoria).
- Criar executor confiável com retries, idempotência, dead-letter, limites e logs (Trigger.dev ou Activepieces).
- Usar React Flow para o editor gráfico, mas só mostrar como ativo se o fluxo for executável.
- Fluxos recomendados: novo lead → atribuir responsável; sem retorno → tarefa de follow-up; novo agendamento → lembrete; mudança de etapa → notificação; venda → relatório.
- Cada ação externa precisa registro de evento, consentimento/opt-in e controle de mensagens.

### Fase D — WhatsApp oficial e agentes de IA
- Conectar cada empresa com a Meta WhatsApp Business Platform; verificar assinatura de webhook e mapear phone_number_id → empresa.
- Persistir conversas e mensagens por organização, com RLS, índices, retenção, opt-in e logs.
- Respostas do atendente, atribuição de conversa, etiquetas e histórico primeiro; disparos automáticos depois.
- CopilotKit + Mastra ou SDK equivalente com ferramentas somente-leitura no início: resumo de lead, pendências e sugestão de resposta.
- Ações com escrita (criar tarefa, mudar etapa, enviar mensagem) exigem confirmação humana, validação no servidor, limites e auditoria.
- Instrumentar erros, custos e avaliações (Langfuse se necessário).

## Critérios de aceite antes de vender
- Pelo menos dois perfis e duas empresas isoladas nos testes.
- Nenhum botão falso nem integrações rotuladas como ativas sem funcionar.
- Sem tokens/API keys expostos no bundle, em logs ou no cliente.
- Ações automatizadas reexecutáveis de forma segura; incidentes auditáveis.
- Testes de acesso, cadastro, importação, webhook, pagamentos e LGPD onde aplicável.
- Desempenho mobile aceitável, foco de teclado, suporte a movimento reduzido e erro de rede claro.
- Licenças e avisos de terceiros documentados para cada dependência integrada.

## Estado após esta auditoria
- P0 security PR: https://github.com/ojoaovitordeoli/nexus-crm-ai/pull/1 (branch draft, separado de produção).
- Command Center Ctrl+K: implementado no main com cmdk MIT, sujeito à validação autenticada no navegador.
- As demais integrações permanecem recomendações, não serviços ativos.
