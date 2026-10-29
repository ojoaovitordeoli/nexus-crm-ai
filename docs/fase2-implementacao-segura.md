# Fase 2 — Segurança, Automação e WhatsApp oficial
Atualizado em 28/10/2026. Este pacote foi desenvolvido numa branch de revisão antes do merge.

## O que já foi implementado no código
- Next.js 15.5.28 e React 19.2.9, com compatibilidade de parâmetros assíncronos.
- Regressões automatizadas: HMAC da Meta, verificação do challenge, sanitização dos eventos, validação de regras e papéis autorizados.
- Segurança por empresa reaproveitada nos endpoints de automação e caixa de entrada.
- Construtor simples **funcional**, não visual drag-and-drop: gatilho de movimento de lead para uma etapa → cria uma tarefa com prazo. Regras começam pausadas, podem ser ativadas/pausadas e têm execução idempotente por regra/lead/etapa.
- Webhook oficial WhatsApp Cloud API com verificação de token (GET), assinatura HMAC-SHA256 (POST), associação por Phone Number ID cadastrado pelo Super Admin e gravação idempotente de mensagens.
- Caixa de entrada **somente leitura** com conversas persistidas por empresa, quando houver mensagens recebidas.
- Nenhum token é enviado ao navegador. Nenhuma mensagem é disparada automaticamente.

## Antes de ativar qualquer integração
1. **Supabase:** revisar e executar `supabase/20261028_automation_whatsapp_foundation.sql` no SQL Editor do projeto correto. O script cria tabelas novas, restringe acesso direto de `anon` e `authenticated`, mantendo acesso pelo servidor com `service_role`. Não remove dados existentes.
2. **Render:** configurar apenas em Environment `META_APP_SECRET` e `META_WEBHOOK_VERIFY_TOKEN` (valores confidenciais obtidos/configurados na Meta). Não publicar seus valores no GitHub nem no chat.
3. **Meta Developers:** configurar a URL `https://nexus-crm-ai.onrender.com/api/webhooks/whatsapp` para o produto WhatsApp, usar o mesmo verify token do Render e assinar os eventos `messages`. A Meta verificará o GET e assinará as entregas POST.
4. **Super Admin → WhatsApp:** registrar o **Phone Number ID** da empresa, nunca o token ou número de telefone comum. A conexão torna-se ativa quando um evento assinado daquele Phone Number ID chega.
5. Com uma conversa real de teste, verificar se a mensagem aparece apenas no usuário da empresa autorizada e não em outra empresa.
6. **Super Admin/Gerente → Automações:** criar uma regra, ativá-la, mover um lead entre etapas no Kanban e verificar a tarefa no módulo de tarefas e o registro da execução.

## Comportamentos que são propositalmente limitados
- Sem envio de WhatsApp pelo CRM: as mensagens só entram após autorização Meta e configuração. Para responder, há link externo para `wa.me`. Antes de enviar mensagens pelo CRM, implementar token seguro por tenant, controle de opt-in, janelas de atendimento, templates e registro de consentimento.
- Sem IA respondendo clientes: agentes necessitam provedor, custo, aprovação para ações que escrevem, isolamento de dados e logs.
- O editor de automação é um formulário de regras; **React Flow não foi instalado** porque ainda não há executor generalizado confiável para múltiplos tipos de nós. Aumentar complexidade visual antes do motor seria criar botões fictícios.
- Tarefas de follow-up são criadas **na mudança de etapa**, com `due_date` futuro configurável. O servidor não está executando um job futuro: o prazo é o vencimento da tarefa.
- Idempotência atual: uma regra executa no máximo uma vez para cada combinação lead e etapa. Reentrada posterior na mesma etapa não gera tarefas duplicadas. Erros de execução são registrados para auditoria e exigem tratamento/retry posterior.
- Controles diretos de RLS para as novas tabelas estão fechados; não há acesso direto no frontend. Dados de mensagens exigem política de retenção e uso compatível com LGPD.

## Critérios antes de comercializar
- Testes autenticados com duas empresas, usuários VIEWER, SELLER, MANAGER e Super Admin.
- Auditar que `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` e `SUPABASE_SERVICE_ROLE_KEY` estão apenas no servidor.
- Confirmar que um webhook sem assinatura válida não grava dados.
- Revisar retenção de mensagens e logs e políticas de privacidade.
- Ativar alerts de falhas, rate limits, paginação e monitoramento de filas antes de escalar em produção.
