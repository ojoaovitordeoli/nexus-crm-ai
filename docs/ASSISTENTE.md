# Assistente NEXUS

Chat lateral (botão **Assistente** no topo) que responde sobre a operação da empresa e prepara ações.

## Como ligar

1. Crie uma conta em console.anthropic.com e **defina um limite de gasto mensal**.
2. Gere uma chave de API.
3. Render → nexus-crm-ai → Environment → `ANTHROPIC_API_KEY` = a chave → salvar → novo deploy.
   Nunca coloque a chave no GitHub nem em chat.

Modelo padrão: `claude-haiku-5-5` (o mais barato). Para trocar, use `ASSISTANT_MODEL`.

Alternativa: qualquer API compatível com OpenAI — `ASSISTANT_BASE_URL` (+ `ASSISTANT_API_KEY` se precisar) e `ASSISTANT_MODEL`.
Ex.: um Ollama num servidor seu (`http://servidor:11434/v1`) mantém os dados em casa, mas precisa de máquina com memória para o modelo.

## O que ele faz

| Consulta (executa na hora) | Ação (só com **Confirmar**) |
|---|---|
| Resumo do dia (tarefas vencidas/hoje, compromissos, leads novos, vendas do mês) | Criar tarefa/retorno |
| Buscar cliente por nome ou telefone | Agendar compromisso |
| Funil por etapa (quantidade e valor) | Mover lead de etapa |
| Vendas por período e por vendedor | Registrar venda |
| Leads parados há N dias | Abrir lead para um contato |
| Como usar o NEXUS | |

## Segurança

- A IA **só consulta**. Ações viram propostas; quem executa é o botão Confirmar, pela mesma API do sistema (mesmas permissões, campos obrigatórios por etapa, auditoria).
- Instruções escondidas em dados (ex.: nome de contato) não conseguem gravar nada sem uma pessoa confirmar.
- Vê apenas a empresa e o perfil de quem pergunta; perfil Somente leitura não recebe ações.
- Histórico enviado: no máximo 12 mensagens de texto. Limite: 12 perguntas/min por pessoa e 200/h por empresa (além do limite de gasto no provedor).
- Não envia WhatsApp nem e-mail.
