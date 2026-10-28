# NEXUS CRM AI — Etapa de recuperação

Versão publicada diretamente no GitHub pelo ChatGPT, sem download de ZIP.

## Escopo desta etapa
- Login com Supabase Auth, logout e recuperação de senha
- Área Super Admin protegida por verificação de `profiles.is_super_admin`
- Central Super Admin com abas Empresas, Usuários, Acessos e Auditoria
- Cadastro de usuários sem envio de e-mail pela rota segura `/api/admin/users`; exige autenticação Super Admin e segredo somente no servidor
- Vínculo de usuários por empresa com papéis (AGENCY_ADMIN, ORGANIZATION_ADMIN, MANAGER, SDR, SELLER e VIEWER); suspensão e reativação via RPC
- Criação de empresa e funil padrão via RPC autenticada, se migração administrativa aplicada
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
   - `SUPABASE_SERVICE_ROLE_KEY`: **somente no servidor Netlify**, para criar usuários; proteger como valor secreto, com escopo Functions/Production; nunca usar `NEXT_PUBLIC_` nesse nome
4. Executar novo deploy para compilar com as variáveis.
5. No Supabase, configurar **Authentication > URL Configuration** com o endereço do Netlify e adicionar `https://SEU-SITE.netlify.app/reset-password` em redirect URLs.
6. Confirmar migrações/RLS e as funções `admin_create_organization`, `admin_add_member`, `admin_set_member_status`, `admin_set_profile_status` antes de usar o Super Admin.
7. No Supabase, confirmar que a conta do proprietário possui `profiles.is_super_admin = true` e `profiles.status = 'active'`. Isso deve ser realizado sob controle do proprietário e de forma auditável.
8. Verificar uma conta comum em outra empresa antes de cadastrar clientes reais; RLS multiempresa é essencial.

Nunca colocar uma `service_role`, token secreto ou senha no GitHub público.

## Estado de verificação
As alterações estão no GitHub; build e conexão real devem ser verificados pelo CI, Netlify e banco. A API administrativa não pode ser usada antes de configurar o segredo no Netlify. Não considere a plataforma apta à venda antes dos testes de RLS e acesso entre empresas.
