# NEXUS CRM — Copiloto consultivo e diagrama visual

## O que o código entrega
- Rota `/insights` (Copiloto IA) acessível após login e empresa autorizada.
- API segura `/api/insights`, usando Responses API. **Somente leitura**: não muda leads, não cria tarefas e não envia WhatsApp.
- A interface pede confirmação explícita antes de enviar a pergunta e números agregados da empresa ao provedor.
- Nenhum nome, telefone, conteúdo de conversa ou dado individual de cliente é coletado do Supabase para a IA.
- Limites iniciais por usuário: três solicitações por minuto e 25 por dia; por empresa: 150 por dia. Ledger apenas com tamanho da pergunta, status, token usage e timestamps. Não armazena pergunta nem resposta.
- O modelo padrão é `gpt-6-luna`, configurável pela variável `OPENAI_MODEL`; modelo e preço dependem do acesso da conta do proprietário.
- `React Flow` (MIT) no módulo de Automações: visualização interativa e animada do **gatilho → criação de tarefa**, que acompanha os campos configurados. Ao clicar nos nós, os campos correspondentes recebem foco.

## Ativação do Copiloto
1. No Supabase SQL Editor, revisar e executar o arquivo `supabase/20261028_ai_insights_quota.sql`. Não mexe nos registros existentes.
2. No Render, configurar `OPENAI_API_KEY` como segredo no servidor, nunca com prefixo NEXT_PUBLIC e nunca colar no chat ou no GitHub.
3. Opcional: configurar `OPENAI_MODEL` para outro modelo disponível na sua conta de API.
4. Reiniciar o serviço via deploy e entrar em `/insights`. O usuário deve aceitar o envio dos indicadores agregados a cada pergunta.
5. Fazer teste com dois usuários de empresas diferentes. Conferir que respostas não citam clientes de outra empresa e que as cotas impedem excesso de chamadas.

## Restrições e próximos passos
- Contador de requisições usa consultas ao Supabase; em tráfego muito alto, substituir por reserva atômica via SQL/RPC para evitar corridas de concorrência.
- O contexto usa os últimos 250 registros de cada módulo, logo não representa necessariamente a base completa. Nunca apresentar como análise integral.
- Sem ferramentas de escrita ou execução da IA: a finalidade é oferecer sugestões, não agir sem aprovação.
- O gráfico do React Flow mostra **o único tipo de automação que o servidor já executa**. Não são suportados múltiplos caminhos, condições, cron ou integrações externas; não habilitar conexão de nós sem adicionar executor e controles.
- Avaliar qualidade dos resultados, política de retenção/LGPD, custo e escopo de dados antes de oferecer comercialmente.
