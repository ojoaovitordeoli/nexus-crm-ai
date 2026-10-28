# NEXUS CRM AI — Etapa de recuperação

Versão publicada diretamente no GitHub pelo ChatGPT, sem download de ZIP.

## Escopo desta etapa
- Login com Supabase Auth, logout e recuperação de senha
- Área Super Admin protegida por verificação de `profiles.is_super_admin`
- Leitura de empresas e usuários e criação de empresa via RPC autenticada, se migração aplicada
- Dashboard com contagem real de leads, vendas, agendamentos e faturamento
- Minha operação, leads e tarefas por empresa
- Visual glassmorphism, tema claro/escuro e layout responsivo

**Importante:** esta é uma base funcional de recuperação, não a cópia integral do pacote original NEXUS CRM V2 de 118 arquivos. Módulos avançados do pacote original (WhatsApp, Kanban, N8N, arquivos e fluxos administrativos adicionais) permanecem para integração. Não contém dados falsos.

## Publicar no Netlify
1. Importar o repositório do GitHub.
2. Next.js detectado automaticamente; comando de build `npm run build`.
3. Em *Environment variables*, definir:
   - `NEXT_PUBLIC_SUPABASE_URL`: URL do projeto
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: chave pública `anon`/publishable compatível do mesmo projeto
4. Executar novo deploy para compilar com as variáveis.
5. No Supabase, configurar **Authentication > URL Configuration** com o endereço do Netlify e adicionar `https://SEU-SITE.netlify.app/reset-password` em redirect URLs.
6. Confirmar migrações/RLS antes de usar recursos administrativos.

Nunca colocar uma `service_role`, token secreto ou senha no GitHub público.

## Estado de verificação
O código foi enviado para o repositório; build e conexão real devem ser verificados pelo CI e pelo Netlify.
