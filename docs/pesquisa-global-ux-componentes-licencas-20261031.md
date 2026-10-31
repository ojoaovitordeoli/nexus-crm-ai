# NEXUS | Pesquisa técnica e auditoria de referências — 31/10/2026

## Objetivo
A autorização recebida é para pesquisar projetos, padrões, habilidades e bibliotecas públicas e aplicá-los ao NEXUS CRM existente. Não autoriza usar credenciais alheias, copiar interfaces proprietárias, violar licenças ou migrar produção sem validação. Os dados e o deploy principal continuam intactos durante a exploração.

## Problema observado (V9 e primeira V10)
- V9: módulos visualmente independentes e cards gêmeos. Trocar tons e fonte sem reconstruir a experiência entregou visual de template.
- V10 primeira captura: menu e hierarquia melhores, mas o Kanban em modo sem estágios mostrava um enorme aviso vazio. O eixo do gráfico com um lead mostrava ticks duplicados. Ambos foram corrigidos nesta branch.
- Dado real ausente exige boa interface de estado vazio, **não registros fabricados**.
- Nenhuma captura automatizada com usuário de teste é validação de uso com dados reais / equipe.

## Fontes pesquisadas, permissões e decisões

### Atomic CRM — Marmelab
- Projeto: https://github.com/marmelab/atomic-crm
- Licença: MIT. README: https://github.com/marmelab/atomic-crm/blob/main/README.md
- Estudar: ficha de cliente e histórico, visualizações de registros, relação organização/pessoa, filtros, ações junto aos dados. Opção segura para adaptar ideias de componentes e padrões, preservando aviso de licença quando incorporar código.
- Não copiar todo o aplicativo; ele tem arquitetura própria e exigiria integração/desvio de stack.

### Attio — produto comercial fechado
- Docs: https://attio.com/help/reference/attio-101/introduction-to-navigating-attio
- Registros e visualizações: https://attio.com/help/reference/attio-101/attios-data-model/understanding-records
- Estudar comportamento e hierarquia: sidebar com setores, Cmd+K, vistas em tabela/kanban, busca e detalhes progressivos.
- Não copiar componentes proprietários, código, logos ou telas inteiras.

### Linear — produto comercial fechado
- Docs: https://linear.app/docs/customer-requests
- Estudar densidade informacional, filtros salvos, estados e microinterações contidas, sem simular um produto de gestão de tarefas quando precisamos de CRM.
- Não reutilizar identidade visual proprietária.

### dnd-kit — drag-and-drop
- https://github.com/clauderic/dnd-kit — MIT
- Sensores mouse, teclado e toque; feedback de arrastar com acessibilidade, colisão e reordenação. Candidato para substituir futuramente o HTML5 drag nativo do Kanban. Exige teste com arrastar entre colunas, rollback de API e estados de erro.

### TanStack Table
- https://github.com/TanStack/table — MIT
- Candidato para registros densos: filtros, ordenação, colunas, paginação e seleção por múltiplos itens. Adoção apenas depois de projetar API paginada com tenant, sem falsear totais.

### Radix Primitives
- https://github.com/radix-ui/primitives — MIT
- Bases acessíveis para menus, diálogos, tabs, popovers, comboboxes e foco. Adaptação pontual, não reescrita completa.

### dashboardcn e shadcn/ui (blocos)
- https://dashboardcn.com/docs — componentes de dashboards sob MIT, conforme a documentação consultada.
- https://ui.shadcn.com/blocks?category=dashboard — blocos abertos de layouts com tabelas e gráficos.
- Candidatos para padrões de tabela, dataviz e controles sob tema personalizado; não adicionar template pronto sem integração visual.

### Twenty CRM — estudo, não cópia
- https://github.com/twentyhq/twenty
- Projeto AGPL-3.0 com arquivos sob licença comercial; investigar como estudo conceitual e não transportar código para a base atual sem revisão legal específica.

### Arena Skill enviada pelo usuário
- Arquivo: arena-skill-main.zip, licença MIT, autoria Jake Schincariol.
- A skill foi desenhada especificamente para Claude Code e uso do Agent tool / paralelismo de múltiplos subagentes. **Não está instalada nem executável automaticamente por este ambiente.**
- Reaproveitamento cabível: padrão de avaliação com correção, completude, robustez, especificidade e clareza; revisão adversarial de UX e de código. Nunca alegar que foram executados “100 agentes” quando isso não ocorreu.
- Adoção de código requer preservar o aviso de licença.

## Regras operacionais e visuais para NEXUS
- Tela não é uma landing page: primeira ação deve ser utilizável, não decorativa.
- Principal: cliente, tarefa, agendamento ou conversa; gráficos não substituem fila de trabalho.
- Fluxo: lead → contato → qualificação → agendamento → comparecimento → venda → pós-venda, com fonte e responsável.
- Um único padrão tipográfico: títulos Sora com escala deliberada, texto Manrope 12–14px para UI e 14–16px para leitura de descrição; evitar micropalavras em caixa alta espalhadas por toda a página.
- O vidro deve aparecer onde existe contraste/agrupamento real: não em todos os componentes. Preferir uma superfície contínua para dados tabulares.
- Somente rótulos de ação e métricas verificáveis. Não inventar crescimento, faturamento, metas, data, "online", IA ativada ou sincronização.
- Tema claro/escuro com token e contraste >= WCAG AA para texto normal quando possível, foco e redução de movimento.
- Desktop 1440px, tablet, mobile 390px: capturas, inspeção de desbordamento e revisão dos resultados renderizados.

## QA de aceite para equipe — 100 pontos (somente após teste REAL)
1. Legibilidade, hierarquia visual e identidade própria (20): leitura confortável, consistência visual, sem cara de modelo.
2. Fluxos comerciais operáveis (25): criar lead, mover funil, agendar, registrar venda, histórico.
3. Fidelidade às referências e fluidez (15): material, microinterações contidas e resultado comparável, sem cópia.
4. Confiabilidade, isolamento por empresa e precisão dos indicadores (25): dados completos/indicação de amostra, permissões e auditoria.
5. Acessibilidade e responsividade (10): teclado, aria, contraste, mobile.
6. Performance e ausência de regressões (5): build, navegador, carga e validação de usuários.

**Nota mínima 90/100 exige evidências, não autodeclaração.** Prêmio visual não compensa falha funcional ou vazamento entre empresas. Uma falha crítica de dados ou autenticação reprova a release independentemente da pontuação.

## Próximas atividades técnicas (ainda não executadas)
- Reunir em um design system os 9+ CSS legado com precedência e !important; auditar rotas fora da Visão Geral.
- Ficha detalhada com histórico, contato, tarefas e operações associadas.
- Dados paginados e pipeline analytics calculados no servidor; filtros reais.
- dnd-kit no funil com teclado e multiempresa, sem sobrescrever estágio perdido/ganho.
- Testes reais com ao menos 2 empresas e papéis distintos.
- Revisão humana de capturas e aceite antes de merge / deploy.
