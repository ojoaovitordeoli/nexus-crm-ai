# NEXUS CRM AI

CRM multiempresa em Next.js, TypeScript e Supabase.

## Estado

Repositório inicializado. O código completo da versão V2 (Glass + Super Admin) precisa ser enviado a partir do pacote local `nexus-crm.zip`, mantendo a estrutura de pastas.

## Publicação

- Netlify: importar este repositório GitHub, framework Next.js, build `npm run build`.
- Variáveis necessárias: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chave pública); eventuais segredos administrativos apenas como variáveis de servidor.
- Nunca enviar `.env.local`, service role keys ou senhas para o GitHub.
- Validar build, conexão Supabase e permissões antes de ativar criação de usuários.

## Áreas

- `/login`: autenticação
- `/admin`: Super Admin
- `/minha-area`: operação do usuário
- `/dashboard`: indicadores

**Atenção:** a existência das rotas no código não comprova que a versão publicada esteja funcionando.
