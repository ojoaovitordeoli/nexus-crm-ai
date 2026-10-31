# NEXUS CRM — análise comparativa v2 e plano de reconstrução

## Correção da análise anterior

A primeira entrega errou ao resumir o sistema óptico a “dashboard + Kanban + IA”. Isso não representa o produto. O sistema observado é um **centro operacional comercial**: ele conecta aquisição, lead, conversa, agendamento, proposta, pagamento, ordem de serviço, venda, pós-venda, recompra e indicadores. O Nexus atual tinha uma estética premium e uma base técnica promissora, mas ainda apresentava uma operação simplificada demais.

A meta desta v2 não é fazer uma cópia visual da ótica. É reconstruir, para qualquer segmento, os mesmos encadeamentos e o mesmo nível de ação.

## O que foi observado de fato

### Shell da aplicação
A navegação lateral separa “MKT & Vendas” de “Gestão”. Há contexto de empresa/unidade, usuário, data, notificações, tema e contador de WhatsApp. O menu de vendas inclui Dashboard, CRM, CRM Repescagem, Leads, Vendas, WhatsApp, Tráfego Pago, Indicação, Método ADO, Pós-venda, Metas, Agendamentos e Agente IA. Gestão contém Financeiro, Relatórios, Clientes e Produtos.

### CRM
O CRM não é uma lista de leads: é um Kanban horizontal com contagem por coluna e cartões densos. O cartão mostra nome, contador de interações, origem/campanha, telefone, idade do lead, status de conversa, data e ações de conversa, agenda e mudança de etapa. No estado observado havia 31 Novos Leads, 3 Em Contato, 1 Agendado, 0 Compareceu, 0 Venda Feita, 13 Perdidos e 1 Desqualificado.

Há filtros de mês, ano, origem e status, busca/filtro salvo, exportação, botão “Novo Lead” e acesso explícito ao editor do funil.

### Editor de funil
O modal “Configurar Funil de Vendas” é uma ferramenta de produto, não uma simples lista de banco. Ele permite escolher “Padrão” ou “Em branco”, preservar o “Modelo Padrão — Funil original do sistema”, nomear um modelo, adicionar etapas, editar o nome, escolher cor, reordenar para cima/baixo, excluir, salvar ou “Salvar e ativar”. Também avisa sobre o efeito de remover etapas que já possuem leads.

Para o Nexus geral, cada empresa deve poder ter vários modelos por operação/produto/região, com um modelo ativo e política explícita de transição.

### Ficha 360°
Ao abrir um lead, o sistema apresenta uma ficha enxuta, mas muito mais operacional do que o drawer atual do Nexus. As abas reais são Dados, Anotações, Link de Pagamento, Orçamento, O.S. e Jornada do Cliente. Há ação direta para abrir WhatsApp e edição no topo. A ficha conecta atendimento, negociação, pagamento, execução e histórico.

A versão geral do Nexus deve trocar “lead drawer com origem e etapa” por uma ficha 360° com Dados, Atividades, Conversas, Anotações, Propostas, Pagamentos, Arquivos, Agenda, Jornada e Pós-venda.

### Dashboard
O Dashboard começa com saudação contextual, empresa/unidade e período. Há três visões: Marketing e Vendas, Financeiro e Insights. A visão comercial combina quatro cards principais (Vendas do Mês, Receita do Mês, Ticket Médio e Meta do Mês), gráfico de vendas por dia, vendas por vendedor, fonte, fornecedor, top produtos, profissionais, últimas vendas, leads do mês, campanhas, CPL, ROAS, impressões, cliques, CTR, funil por etapa, leads por origem, evolução mensal, KPIs macro comparados ao mês anterior, ciclo lead-venda, no-show, clientes novos, recompras, mini-funil por fonte, campanhas, palavras-chave, projeção de meta, mix de produtos, pagamentos, heatmap e melhor/pior dia.

O mérito não é “ter muitos cards”; é permitir responder, na mesma tela: quanto vendi, de onde veio, onde está travando, quem performa, qual canal converte, que meta falta e qual ação devo tomar.

### Agente IA
A tela se chama “Agente IA — Editor de Fluxo” e descreve fluxos visuais no estilo n8n. Ela oferece “Aplicar Template Clínica Modular” e “Criar Fluxo em Branco”. O template observado explica uma arquitetura de subagentes: Recepcionista/Router para classificar intenção; Subagente Clínica para agendar consultas; Subagente Informações para endereço, valores e convênios; e Subagente Reagendamento para cancelar/reagendar com retenção. O fluxo pode ser aplicado e ativado.

Logo, o Nexus não deve chamar de “agente” um prompt de insights. Deve ter um editor visual de fluxo com roteador, subagentes, condições, conhecimento, agenda, ações CRM, espera, follow-up e handoff humano, mais rascunho/publicação, simulação, logs, aprovação e pausa por conversa.

## Diagnóstico do Nexus atual

O Nexus já tem multiempresa, autenticação, leads, contatos, tarefas, agenda, automações internas, Copiloto, React Flow, inbox oficial em fundação e dashboard premium. O problema é de produto: a tela atual concentra uma visão bonita, mas não entrega o ciclo operacional completo.

O Kanban atual possui busca, filtro, lista/board, drag-and-drop e drawer, mas não tem modelo de funil com ativação, cartão tão acionável, ficha 360°, ações de proposta/pagamento/OS ou relação explícita com vendas. O Dashboard atual mede leads, vendas, agenda e tarefas, mas não possui a camada de vendas, aquisição e gestão observada no sistema óptico. O agente atual é mais próximo de Copiloto somente leitura e preview de automação do que do editor de fluxo de subagentes observado.

## Reconstrução por produto

### Núcleo de dados e eventos
Todas as operações devem gerar eventos idempotentes e atualizar projeções: `lead_created`, `lead_stage_changed`, `message_received`, `appointment_created`, `appointment_status_changed`, `proposal_created`, `sale_created`, `payment_recorded`, `post_sale_started` e `agent_handoff`. O dashboard deve ler projeções por empresa e receber Realtime; a atualização não pode depender de cada tela lembrar de recalcular manualmente.

### Funil
Adicionar entidade de modelo de funil, etapas com cor/ordem/tipo, modelo ativo, regras de entrada/saída, campos obrigatórios, SLA da etapa e automações. O editor precisa ter padrão, em branco, duplicação, ativação e aviso de impacto. O Kanban precisa mostrar contagem, tempo parado, última interação, responsável, origem/campanha, próxima tarefa e ações rápidas.

### Ficha 360°
Criar uma tela/drawer rico com abas universais: Resumo, Conversas, Atividades, Anotações, Agenda, Propostas, Pagamentos, Arquivos, Jornada e Pós-venda. Todas as ações devem manter o mesmo contato/oportunidade e alimentar o histórico.

### Vendas
Criar módulo de vendas com venda avulsa ou vinculada ao lead, cliente, vendedor, itens/produtos/serviços, desconto, valor, status, forma de pagamento, origem, data, parcelas e observações. O evento de venda deve atualizar dashboard, funil, atividades e pós-venda.

### Agenda
A agenda deve permitir tipos genéricos (reunião, demonstração, visita, retorno, entrega, instalação, consulta), contato, oportunidade, responsável, local, duração, status (agendado, confirmado, concluído, no-show, reagendado, cancelado), lembretes e ações após o compromisso.

### Inbox/WhatsApp
A conversa deve estar ligada ao contato e à oportunidade, com não lidas, atribuição, filtros por etapa/tag/responsável, templates, respostas rápidas, notas internas, transferência, pausa do agente, criação de lead, movimentação de etapa e agendamento a partir da mensagem.

### Dashboard
Criar uma visão executiva com filtros por período, funil, equipe, origem e campanha. A primeira faixa deve responder receita/vendas/ticket/meta. A segunda deve explicar o fluxo com vendas por dia, conversão por etapa, ciclo, no-show e agenda. A terceira deve explicar aquisição com origem, campanha, CPL/CAC/ROAS e palavras-chave. A quarta deve explicar gestão com vendedor, produtos/serviços, pagamentos e metas. Cada card precisa ter comparação, tendência e drill-down.

### Agente IA
Implementar um editor de fluxo com templates gerais: Atendimento Comercial, Qualificação de Lead, Agendamento, Pós-venda e Recuperação. Nós mínimos: Router de intenção, Agente conversacional, Pergunta estruturada, Condição, Busca em conhecimento, Criar/atualizar contato, Mover etapa, Criar tarefa, Agendar, Enviar template, Esperar resposta, Aguardar tempo, Transferir para humano e Encerrar. Cada nó deve declarar campos que lê/altera, ferramentas permitidas, limites, saída, erro e fallback.

## Ordem de entrega

A primeira entrega de código deve ser o núcleo operacional: modelo de funil + ficha 360° + vendas + eventos. Depois entram dashboard de gestão, agenda/inbox, repescagem/pós-venda e finalmente o editor visual completo do agente IA. Não faz sentido continuar polindo animações antes de existir esse fluxo inteiro.

## Critério de pronto
Um usuário deve conseguir cadastrar um lead geral, vê-lo no funil, abrir a ficha 360°, conversar, anotar, agendar, criar proposta, registrar venda/pagamento, mover a oportunidade, disparar automação, iniciar pós-venda e enxergar todas as consequências no dashboard sem refresh manual. Se qualquer elo quebrar, ainda não está no nível do sistema de referência.
