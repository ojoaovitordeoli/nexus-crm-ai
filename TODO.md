# TODO — evolução funcional do NEXUS CRM

## Funil configurável e Kanban

- [ ] A empresa pode escolher um modelo padrão, criar um modelo em branco e duplicar um modelo existente.
- [ ] Cada modelo possui nome, status ativo/inativo, etapas ordenáveis, cor, tipo aberta/ganha/perdida/desqualificada, SLA e campos obrigatórios.
- [ ] O editor permite adicionar, editar, reordenar e remover etapas e avisa quando leads existentes serão afetados.
- [ ] O Kanban exibe contagem por coluna, tempo parado, origem/campanha, última interação, responsável, próxima tarefa e ações rápidas.
- [ ] Mover etapa por drag-and-drop e pelo detalhe aplica regras e grava histórico.

## Ficha 360°

- [ ] O lead/contato abre uma ficha com abas Resumo, Conversas, Atividades, Anotações, Agenda, Propostas, Pagamentos, Arquivos, Jornada e Pós-venda.
- [ ] A ficha permite abrir WhatsApp, criar tarefa, agendar compromisso, criar proposta e registrar venda sem perder o contexto.
- [ ] Todas as ações aparecem na jornada com autor, horário, origem e entidade relacionada.

## Vendas e eventos

- [ ] A venda pode ser criada do lead, contato, WhatsApp, agenda ou módulo de vendas.
- [ ] Venda possui cliente, oportunidade, vendedor, itens, valor, desconto, status, origem e forma de pagamento.
- [ ] `sale_created`, `payment_recorded` e alterações de venda são idempotentes, auditáveis e segregadas por empresa.
- [ ] O dashboard, o histórico, o funil e o pós-venda refletem a venda sem refresh manual.

## Dashboard operacional

- [ ] Filtros de período, funil, responsável, origem e campanha são compartilhados entre os blocos.
- [ ] KPIs incluem vendas, receita, ticket médio, meta, leads, agendamento, comparecimento, conversão, ciclo e no-show.
- [ ] Há vendas por dia, vendedor, fonte, produto/serviço e forma de pagamento.
- [ ] Há leads por origem, campanha, funil e evolução mensal.
- [ ] Cada KPI possui comparação com período anterior, tendência e drill-down.
- [ ] O dashboard mostra última sincronização, estado de dados e funciona com estado vazio útil.

## Agenda e atendimento

- [ ] Agendamento possui contato, oportunidade, tipo, responsável, local, duração, status, observações e lembretes.
- [ ] Status cobrem agendado, confirmado, concluído, no-show, reagendado e cancelado.
- [ ] Confirmar, concluir, cancelar ou marcar no-show dispara eventos e automações.
- [ ] Inbox liga conversa a contato e oportunidade e permite nota interna, atribuição, template, mudança de etapa e agendamento.

## Agente IA visual

- [ ] Editor visual suporta Router de intenção, agente conversacional, pergunta estruturada, condição, conhecimento, ação CRM, tarefa, agenda, espera, follow-up, handoff e encerramento.
- [ ] Existem templates Atendimento Comercial, Qualificação, Agendamento, Pós-venda e Recuperação.
- [ ] Cada fluxo possui rascunho, simulação, publicação, versão, logs, limites e pausa manual.
- [ ] Cada nó declara campos lidos/alterados, ferramentas permitidas, critérios de sucesso, erro e fallback.
- [ ] Ações de escrita exigem permissão e podem exigir aprovação humana.

## Pós-venda e gestão

- [ ] Venda concluída pode iniciar um funil de pós-venda com tarefas, mensagens, satisfação e recompra.
- [ ] Repescagem segmenta perdidos, sem resposta, orçamento não fechado, cancelados e clientes de recompra.
- [ ] Metas permitem período, responsável, valor/quantidade e acompanhamento do realizado.
- [ ] Relatórios exportam visões com filtros e preservam isolamento por empresa.
