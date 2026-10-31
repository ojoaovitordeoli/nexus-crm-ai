# NEXUS | Plano de produto, execução e critérios de qualidade
Data: 31/10/2026. Base: documentos fornecidos (Sistema Óptico, dossiês de referências, vídeos de dashboards, especificação de CRM) e inspeção da branch main do GitHub.

## Visão do produto
CRM horizontal, multiempresa, comercial e operacional, com acabamento visual original. A experiência deve unir a densidade útil de um CRM de vendas, a disciplina de histórico e auditoria, os gatilhos de operação e uma interface sofisticada, sem simular recursos. Não copiar marca, componentes proprietários, textos ou aparência exata das referências.

## Padrão de qualidade desejado — nota 9
Cada área deve ter informação confiável, próximo passo claro, histórico auditável e estados de vazio, erro e carregamento. Não chamar amostras de valores totais nem afirmar que uma integração está ativa por ter apenas uma tela. Sem botões fictícios ou animações que escondam atrasos.

## Arquitetura de jornada comercial
Captação → lead e origem/campanha → qualificação → contato/WhatsApp → tarefa de follow-up → agendamento → presença/no-show → orçamento/proposta → negociação → venda com cliente, responsável, itens e pagamento → pós-venda/repescagem → relatório e meta.

A ficha 360° torna-se o centro de trabalho, não um módulo à parte: contatos, conversas, agenda, tarefas, alterações, propostas, vendas, arquivos e anotações com timeline e tenant ID.

## Prioridades por valor de negócio
P0 - Integridade: consolidação de login, autorização multiempresa, políticas RLS, migrações versionadas, testes reais e indicadores coerentes. Validar duas empresas, pelo menos 2 papéis cada, com acesso negativo explícito.

P1 - Fluxo comercial: funis por empresa sem perda de leads; transições de etapa atômicas e trilha; ficha 360; venda vinculada a cliente/lead; agenda com status de comparecimento; filtros cruzados de período, funil e origem. Medir lead → agendado → compareceu → venda. Não fabricar métricas sem dados.

P2 - Gestão: dashboard com valores auditáveis e filtros; performance de mídia/campanhas autorizadas; repescagem e pós-venda; metas e indicação (link/código, origem, aceitação, conversão, regras da recompensa). Exportar com segurança.

P3 - Automação e IA: inbox efetivamente conectada ao contato e lead; capacidade de atendimento humano/transferência; agente configurável por empresa com skills, base de conhecimento, modo de simulação, quotas e auditoria; ações sensíveis com aprovação humana. WhatsApp não oficial por QR deve ser tratado como experimental e sujeito a risco de bloqueio.

## Qualidade visual e UX
- Layout com sidebar contextual, topbar simples, busca funcional e atalhos; organização em blocos Marketing e Vendas / Gestão.
- Design tokens únicos para claro/escuro; tons sólidos claros com blur moderado como acabamento, não um card em cima de outro. Remover CSS acumulado progressivamente, só após cobertura visual de todas as rotas.
- Hierarquia de ações: atendimentos pendentes primeiro, conversão e receita depois. Gráfico e dados com fonte, período e referência de cobertura.
- Componentes de sucesso, erro, vazio e confirmação acessíveis; textos e campos legíveis em 390px, 768px e desktop. Animação curta vinculada a navegação real; reduced motion.
- Não usar fundos/órbitas decorativas como substitutos de densidade operacional.

## Critérios operacionais para lançamento
1. Usuário autentica, troca empresa e não vê dados cruzados.
2. Criar lead, agendar, registrar comparecimento, gerar venda associada e visualizar pipeline, histórico e resultado atualizado sem dupla contagem.
3. Navegação por teclado, busca Vendas, uso em mobile e nenhuma ação inerte.
4. Total de vendas, receita e ticket médio reconciliados com consultas completas do banco; estado parcial sinalizado quando limite de paginação for atingido.
5. Para canais e anúncios, teste ponta a ponta com credenciais válidas, falha de token, desconexão e retomada.
6. Relatório de testes de produção/staging e aprovação humana do visual. Não implantar em produção sem validação e plano de rollback.

## Primeira correção nesta branch
- Tipo semântico de etapa atualiza is_won e is_lost em uma única transição de estado React, para evitar estado inconsistente.
- Comunicação transparente de indicadores calculados a partir de registros carregados e links de atividade de venda para a área de vendas.
- Vendas incluídas nos destinos da paleta Ctrl+K.
- Rótulos de receita/ticket médio deixam claro quando há paginação incompleta.

## Ainda não implementado nesta branch
Ficha 360 completa; eventos de domínio atômicos; APIs agregadas paginadas; conta de anúncios autorizada; integração QR operacional; publicação; migrações. Qualquer novo esquema exige revisão sobre o Supabase real. Não prometer “9/10” sem critérios homologados.
