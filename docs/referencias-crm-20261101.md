# Referências verificadas para a reconstrução do Nexus

## O que foi acessado

A conta `@joao_vitordeolivera` não expôs salvos acessíveis nesta sessão. A conta `@ojoaovitordeoliveir` expôs a coleção `j`, com 23 URLs identificáveis. A coleção mistura inspiração de UI, design system, skills, agentes e automação; não é uma biblioteca inteira de CRMs. Entre os itens há referências a design system e UI, skills do Claude, agentes de voz, orquestração de subagentes, React aberto inspirado no Claude Desktop e ferramentas low-code.

## Padrões que serão adotados

### 1. Interface de CRM

O Atomic CRM combina contatos, tarefas, notas, e-mails, negócios em Kanban, histórico agregado, importação/exportação, campos personalizados e controle de acesso. A decisão para o Nexus é tratar cada registro como objeto operacional com histórico e ações no próprio contexto, não como um card decorativo isolado.

O Twenty reforça a separação entre objetos, campos e visualizações. A decisão para o Nexus é manter Leads, Contatos, Vendas e Agenda como módulos ligados por IDs e oferecer lista, Kanban e detalhe 360° sem duplicar dados.

### 2. WhatsApp

O wacrm organiza o produto em quatro telas de uso recorrente: inbox compartilhado, automações, pipelines e analytics. O inbox tem busca, atribuição, notas internas, não lidas e handoff para humano. O pipeline liga o negócio à conversa. A decisão para o Nexus é que a conversa nunca fique separada do contato, lead, venda e próxima tarefa.

### 3. Agente e automações

O Open Agent Builder separa o editor visual da execução. Os tipos de nó encontrados são início, agente, ferramenta/MCP, transformação, condição, loop, aprovação humana e fim, com execução em tempo real. A decisão para o Nexus é ter um editor com poucos blocos compreensíveis e logs por execução; não um painel cheio de efeitos ou uma tela genérica de chat.

React Flow fornece a base técnica para nós arrastáveis, zoom, pan, seleção múltipla, conexões, painel, minimapa e nós customizados. A decisão é usar canvas somente onde ele melhora a configuração de fluxo; configurações simples continuam em formulários normais.

### 4. Direção visual

A direção comum entre as referências é superfície clara ou neutra, bordas finas, hierarquia tipográfica simples, densidade alta de informação e ações próximas dos dados. Não há necessidade de hero promocional, órbitas, glows, frases como “Command Center”, excesso de caixa alta ou quatro cores sem função.

A nova direção do Nexus será: fundo de trabalho neutro; sidebar compacta; superfícies brancas/grafite; uma cor de ação; estados semânticos apenas para sucesso, alerta e erro; tipografia de leitura; títulos que descrevem o trabalho; tabelas, listas e painéis com espaçamento consistente.

## Fontes

- Atomic CRM: https://github.com/marmelab/atomic-crm
- wacrm: https://github.com/ArnasDon/wacrm
- wacrm produto: https://wacrm.tech/
- Open Agent Builder: https://github.com/firecrawl/open-agent-builder
- React Flow: https://reactflow.dev/
- Twenty CRM: https://github.com/twentyhq/twenty
- Coleção Instagram analisada: https://www.instagram.com/ojoaovitordeoliveir/saved/j/1363251799284939/

## Referência visual específica V4/V5 encontrada

A coleção local antiga da primeira conta contém o post do criador `code.xr` com a referência **Glassy Dashboard V5**: https://www.instagram.com/reel/De_78COzoPO/. A descrição confirma dashboard glassmorphism, cards translúcidos, analytics, gráficos suaves, design azul e branco, responsividade, React, Tailwind e Redux Toolkit.

A busca pública também encontrou a referência **Glassy Dashboard V4** do mesmo criador: https://www.instagram.com/_t/reel/De9XFBQTG0D/. A descrição confirma glassmorphism, cards translúcidos, analytics, visuais suaves e estética branca e azul minimalista.

A aplicação dessas referências ao Nexus não será uma cópia literal. O que será incorporado é a composição: fundo claro com profundidade sutil, transparência controlada, cards com hierarquia e bordas delicadas, gráficos com contraste, ritmo visual consistente e microinterações curtas. Não serão usados slogans de IA, excesso de brilho, gradientes decorativos ou efeitos que atrapalhem leitura e operação.
