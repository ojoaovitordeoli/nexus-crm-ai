# Nexus — Operação e WhatsApp oficial | 29/10/2026

## O que muda nesta branch
- A tela principal deixa o antigo hero de órbitas, o grid de quatro cards genéricos e o botão de replay de efeitos.
- Surge a mesa de operação: pendências com prazo, números consultados no banco, etapas reais do funil, histórico e links de continuidade.
- Desktop navega por uma faixa horizontal de módulos; mobile mantém menu acessível.
- A direção visual muda para superfícies de papel/ink, verde profundo e cobre, com títulos editoriais; evita copiar diretamente os quatro vídeos de referência.
- A caixa WhatsApp passa a **permitir respostas oficiais** de texto somente para uma conversa que tenha mensagem recebida em menos de 24 horas, desde que conectada à Meta e configurada pelo Super Admin. Sem automação de disparos, sem templates, sem promessa de entrega instantânea.

## Referências
Partimos da análise registrada em `docs/referencias-visuais-quatro-videos.md` (V4/V5/movimento/login).
A decisão de design foi deliberadamente **não** reaplicar o mesmo glassmorphism, as mesmas órbitas, loops decorativos, painel de vídeo e tipografia DM Sans/Manrope como marca principal.
Referências de arquitetura: Chatwoot (inbox compartilhada), Twenty (estrutura CRM), React Flow para fluxos futuros; nenhuma dependência de código desses projetos foi copiada nesta branch.

## Arquitetura WhatsApp
1. Super Admin vincula `phone_number_id` à organização via `/api/whatsapp/inbox`.
2. Meta assina `messages` no webhook existente; assinatura HMAC validada; IDs mapeados a empresa no servidor.
3. A migração nova cria `whatsapp_connection_secrets` e `whatsapp_outbox`. A credencial é armazenada em AES-256-GCM, somente no banco com service_role.
4. Super Admin fornece token do sistema Meta para o canal na interface (POST `/api/whatsapp/credentials`).
5. Usuários autorizados respondem no componente `NexusWhatsAppInbox` (POST `/api/whatsapp/send`).
6. O servidor revalida perfil, empresa, canal, janela de 24h, token e limite de 20 mensagens/minuto por usuário.
7. Cada tentativa possui `client_request_id` único e trilha na outbox. Sucesso Meta é `accepted`; entrega posterior depende do webhook. Em timeout, o status é `uncertain` e **não ocorre retry automático**.
8. A resposta aceita é salva em `whatsapp_messages` e fica visível no histórico, se a gravação concluir.

## Para ativar em um ambiente isolado de testes
1. Conferir e aplicar `supabase/20261028_automation_whatsapp_foundation.sql`, depois `supabase/20261029_whatsapp_outbound.sql`, no Supabase correto; revisar políticas, backups e migrações antes.
2. No Render, configurar `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `META_TOKEN_ENCRYPTION_KEY` (64 caracteres hexadecimais) e `META_GRAPH_API_VERSION`.
3. Na Meta, configurar `https://nexus-crm-ai.onrender.com/api/webhooks/whatsapp` com token correspondente; usar WhatsApp Business Platform e números aprovados; habilitar `messages`.
4. No Nexus, cadastrar Phone Number ID e, depois, seu token de acesso do sistema da Meta. O token deve ter acesso legítimo de gerenciamento/mensagens para aquele número.
5. Receber uma mensagem real de teste e responder em até 24 horas. Verificar que o outbound só aparece na empresa correta.
6. Testar papéis: Super Admin configura credenciais; gerente e vendedores respondem; viewer não envia; usuário de outra organização recebe 403.
7. Em ambiente próprio validar webhooks duplicados, entrega com status, 401/403 Meta, tempo limite, RLS, mobile e login verdadeiro.
8. Só então liberar deploy, observabilidade, políticas de retenção LGPD e backup da base.

## Limitações conscientes
- **Não há envio em produção** nesta branch sem Meta, token e SQL configurados e verificados. Criar código não ativa a conexão.
- Ainda não há mídia/anexos, templates aprovados, novo contato fora de 24 horas, distribuição por atendente, etiquetas persistentes, automação de follow-up por WhatsApp ou sincronização de calendários.
- O dashboard usa os registros atualmente carregados pelo workspace; totais vindos de consultas independentes e limitadas em páginas devem ser identificados como tais.
- O CSS legado ainda existe, mas a nova camada se sobrepõe para reduzir risco de regressão. A consolidação definitiva depende de testes de regressão de todas as rotas.
- Não foi feita homologação autenticada em produção ou comparação pixel-a-pixel dos MP4 originais nesta branch.

## Aceite da branch
- `npm test` e `npm run build` passam no CI;
- testes de navegador inspecionam login, central de comandos, sidebar mobile e dashboard com dados fictícios;
- migrações revisadas e validada recuperação de canal/usuário entre organizações;
- envio de texto só com canal ativo, token cifrado, janela de 24h e papel autorizado;
- nenhum elemento expõe token de acesso ou chave privada.
