# Plano de reconstrução funcional do NEXUS CRM

## Produto

O Nexus será um CRM geral orientado a operação comercial. A referência é o encadeamento funcional observado no sistema óptico, não o domínio de óticas nem uma cópia estética literal.

## Design

**Movimento:** centro de comando comercial com densidade operacional de software de vendas e acabamento premium sóbrio.

**Princípios:** ação primária visível, contexto antes de decoração, densidade útil nos cartões, feedback imediato e estado vazio orientado à próxima ação.

**Cores:** azul profundo para navegação e confiança, laranja reservado para ação/receita, verde para ganho/conclusão, amarelo para atenção e vermelho para perda/risco. As cores de etapas são configuráveis por empresa.

**Layout:** shell com navegação de operação à esquerda; faixa superior com empresa, período, pesquisa e notificações; área de trabalho com filtros e uma coluna/linha de prioridade; detalhes em drawer ou tela lateral para preservar o contexto do funil.

**Interação:** todo registro deve oferecer próximo passo. Lead mostra conversar, agendar, criar tarefa, mover etapa e abrir ficha. Venda mostra cliente, origem, itens, pagamento e pós-venda. Agente mostra simular, aprovar, publicar, pausar e transferir.

**Tipografia e motion:** hierarquia editorial legível, números fortes apenas em KPIs, animações curtas para entrada/atualização e respeito a `prefers-reduced-motion`.

## Arquitetura

- `components/StaffWorkspace.jsx`: shell, contexto da empresa, navegação e sincronização.
- `components/PremiumOperation.jsx`: dashboard, Kanban, ficha 360°, contatos e operações comerciais.
- `components/NexusAutomationGraph.jsx`: editor visual de automações/agentes.
- `app/api/operation/route.js`: autorização por empresa, leitura e mutações operacionais.
- `supabase/`: entidades, RLS, eventos, auditoria e migrações.
- `docs/`: especificações e dossiês de referência.

## Sequenciamento

A implementação deve seguir: (1) modelo de funil e editor; (2) ficha 360°; (3) vendas e pagamentos; (4) agenda conectada; (5) dashboard de gestão e atribuição; (6) inbox operacional; (7) repescagem/pós-venda; (8) editor de agente IA com templates e governança.
