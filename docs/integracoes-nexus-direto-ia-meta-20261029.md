# NEXUS — WhatsApp direto, IA individual e Meta Ads
Data: 29/10/2026 · Branch de homologação, não produção.

## Diagnóstico
- A versão `main` continua com Supabase e interfaces de CRM, mas não há conexão direta com WhatsApp Web, histórico de chat por usuário ou dados de contas Meta Ads.
- A antiga caixa de entrada oficial foi preservada na rota `/whatsapp-oficial`, sem alterar o webhook oficial existente.
- O módulo antigo de análise de IA foi preservado em `/insights-analise`.
- **A nova branch NÃO está 100% funcional nem publicada.** As três integrações precisam de migração, credenciais externas e testes de usuário reais.
- O design geral aprovado não foi substituído; as três novas telas têm componentes compactos próprios.

## 1. WhatsApp direto (sem Cloud API oficial)
O cliente conversa com um gateway dedicado Evolution API, utilizando sessão via WhatsApp Web/QR.
Código: `components/NexusDirectWhatsApp.jsx`, `app/api/direct-whatsapp/route.js`, `app/api/webhooks/whatsapp/direct/route.js`, `lib/nexus-evolution.mjs`.

- O usuário pode criar canal **privado** (apenas criador) ou **compartilhado** (apenas gestores criam; funcionários da mesma empresa acessam).
- Escanear QR Code pelo WhatsApp / WhatsApp Business → Aparelhos conectados → Conectar um aparelho.
- O provedor precisa de serviço permanente e armazenamento persistente de sessão. Uma função HTTP Next.js isolada **não mantém sessão do WhatsApp**.
- Webhook de instância com header secreto `x-nexus-webhook-secret`, correspondência por `instance_name`, sem confiar em identificador de empresa enviado pelo provedor. Gravação idempotente.
- Mensagens de texto manuais e leitura das últimas 250 por canal. Sem envio em massa, automação, anexos ou CRM bot.
- O status real vem do provedor ao solicitar `Verificar status`, nunca do texto de um botão.
- **Uso não oficial e sujeito a alteração do WhatsApp, desconexão, restrições de conta e regras da plataforma.** O projeto Evolution API não representa endosso oficial do WhatsApp. Avaliar termos antes de habilitar para clientes. Não oferecer SLA oficial.

Configuração server-only:
```env
EVOLUTION_API_URL=https://SEU-EVOLUTION
EVOLUTION_API_KEY=CHAVE-GLOBAL-DO-SERVICO
NEXUS_PUBLIC_BASE_URL=https://SEU-NEXUS
NEXUS_DIRECT_WEBHOOK_SECRET=SEGREDO-ALEATORIO-FORTE-COM-32-OU-MAIS-CARACTERES
```
Configure os recursos de persistência e conexão no serviço Evolution API (banco, cache e volume) separadamente do Nexus.
A API externa precisa aceitar `POST /instance/create`, `GET /instance/connect/:instance`, `GET /instance/connectionState/:instance`, `POST /message/sendText/:instance`, `DELETE /instance/logout/:instance`, mais webhooks por instância com headers. Confirme versão e licença do gateway antes de usar em produção.
Referências:
- https://github.com/evolution-foundation/evolution-api
- https://github.com/evolution-foundation/docs-evolution
- https://www.whatsapp.com/legal/WhatsApp-Terms-for-WhatsApp-Business-App

## 2. Chat de IA individual
Código: `app/api/personal-ai/route.js`, `components/NexusPersonalChat.jsx`.

- `/insights`: chat pessoal, conversas históricas e opção de apagar conversa.
- Cada thread e mensagem têm organização + usuário. Consultas sempre verificam sessão e associação. Nem outro funcionário da mesma empresa pode ler o histórico.
- Envia ao modelo somente pergunta/histórico daquele usuário, até 20 tarefas atribuídas/criadas pelo usuário e contagens agregadas autorizadas (leads, contatos e tarefas).
- Resposta é consultiva, sem ferramentas de execução nem envio de mensagens.
- Consentimento explícito a cada sessão de chat, limites de 4 perguntas/minuto, 40/dia por usuário e 250/dia por empresa (limites simples que não eliminam concorrência de requisições).
- Persistência com retenção e políticas LGPD a definir; API key sempre no backend.

Configuração:
```env
OPENAI_API_KEY=CHAVE-DO-PROVEDOR
OPENAI_MODEL=MODELO-VALIDO-NO-SEU-PROJETO
```
Sem credenciais, não há resposta de IA. O provedor recebe histórico pessoal autorizado para contextualizar respostas, conforme consentimento. A versão anterior de análises agregadas continua disponível na rota separada.

## 3. Meta Ads (somente leitura)
Código: `app/api/meta-ads/route.js`, `components/NexusMetaAds.jsx`.

- `/ads`: gestão de vinculação por gerente/admin, histórico com métricas de até 100 campanhas por conta.
- Token com `ads_read` informado pelo responsável após receber autorização do titular da conta, criptografado com AES-256-GCM, não visível em GET.
- Indicadores reais via Graph API: gasto/7 dias, campanhas, impressões, cliques, CTR, situação.
- O campo `balance` pode representar saldo devido, **não necessariamente crédito disponível**. Para contas pré-pagas a UI informa que o saldo disponível não foi verificado.
- Nenhuma campanha é criada, pausada, editada ou lançada automaticamente; dados só são consultados. A consulta exige permissões e acessos válidos Meta.

Configuração:
```env
NEXUS_SECRETS_KEY=64-CARACTERES-HEXADECIMAIS-DE-32-BYTES-CRIPTOGRAFICOS
META_GRAPH_API_VERSION=v25.0
```
Conectar requer conta `act_...` e token autorizado para aquela conta. Em uso comercial multiempresa, a Meta poderá exigir revisão de aplicativo e permissões avançadas. O método de entrada manual de token é fase de homologação; ideal migrar para OAuth/Business Login auditado e rotacionar os tokens.

## Pré-requisitos para ativar
1. Revisar e executar `supabase/20261029_nexus_personal_ai_direct_wa_ads.sql` em Supabase de **homologação**, após backup e validação dos papéis.
2. Configurar variáveis acima apenas no Render/ambiente de servidor. Jamais colocar chaves em `NEXT_PUBLIC_`.
3. Executar `npm install`, `npm test`, `npm run build`, `npm run test:browser`.
4. Homologar dois usuários em duas empresas, isolamento de canal privado, acesso por papel e exclusão de histórico.
5. Para WhatsApp direto, testar pareamento, reinício do serviço, perda de sessão, recepção, envio manual e idempotência.
6. Para Meta Ads, testar sem token, token vencido, contas pré-pagas, múltiplas contas e correspondência dos valores com o Gerenciador oficial.
7. Para IA, validar custo, consentimento, dados enviados, deleção, quotas concorrentes e retenção.
8. Somente após auditoria de segurança e políticas da plataforma escolher se a integração experimental via WhatsApp Web pode ser disponibilizada para terceiros.

### Fora de escopo atual
Não há QR funcional sem gateway, IA funcional sem API key, saldo Meta sem token, automações de WhatsApp, supervisão de mensagens pessoais sem autorização, chat multiagente, histórico completo de anúncios paginado, OAuth da Meta, deploy nem homologação ponta a ponta real. Os códigos são fundações integráveis e testáveis, não promessas de 100% de funcionamento.
