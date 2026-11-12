# Hospedagem do NEXUS CRM — sem ficar preso a um provedor

O NEXUS tem duas partes independentes:

| Parte | Onde fica | O que guarda |
|---|---|---|
| Aplicação (Next.js) | Render hoje; pode ir para qualquer servidor com Docker | Nada — não guarda dado |
| Banco + login (Supabase) | Supabase | Todos os dados dos clientes |

Trocar a hospedagem da aplicação **não mexe nos dados**.

## 1. Produção mínima para revender

- **Render — instância Starter (pago):** o plano gratuito "dorme" após 15 min sem acesso e mostra a tela de carregamento do Render por cerca de 1 min.
- **Supabase — plano Pro:** o gratuito pausa o projeto após 7 dias sem atividade e não tem backup.
- **Domínio próprio** (ex.: `app.seudominio.com.br`): o cliente nunca vê `onrender.com`, e você troca de provedor só mudando o DNS.

## 2. Domínio próprio no Render

1. Render → nexus-crm-ai → Settings → Custom Domains → adicione `app.seudominio.com.br`.
2. No registro do domínio (Registro.br, Cloudflare...), crie o registro **CNAME** `app` apontando para o endereço que o Render mostrar.
3. Aguarde o certificado HTTPS (automático).
4. **Supabase → Authentication → URL Configuration:** troque o *Site URL* para `https://app.seudominio.com.br` e inclua esse endereço em *Redirect URLs*. Sem isso, "Esqueci minha senha" manda o cliente para o endereço antigo.

## 3. Rodar em qualquer servidor (Docker)

```bash
cp .env.example .env        # preencha; .env nunca vai para o Git
docker compose up -d --build
curl http://localhost:3000/api/health   # {"ok":true,...}
```

Variáveis:

| Variável | Quando entra | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | build | pública |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | build | pública (chave *publishable*) |
| `SUPABASE_SERVICE_ROLE_KEY` | execução | **segredo** — só no servidor |
| `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` | execução | só se o WhatsApp oficial for ativado |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | execução | opcional |

### VPS com Coolify

1. VPS com 2 vCPU / 2–4 GB de RAM, Ubuntu 24.04.
2. Instale o Coolify seguindo a documentação oficial dele.
3. Novo recurso → repositório GitHub `nexus-crm-ai` → build por **Dockerfile**.
4. Em *Build variables* coloque as duas `NEXT_PUBLIC_*`; em *Environment variables* os segredos.
5. Health check: `/api/health`. Domínio: `app.seudominio.com.br` (HTTPS automático).
6. Faça o passo 4 da seção 2 (URLs no Supabase).

Com VPS própria, atualização do sistema operacional, backup do servidor e monitoramento passam a ser responsabilidade sua.

## 4. Migração sem o cliente perceber

1. Suba a nova hospedagem e teste pelo endereço provisório.
2. Confira login, troca de empresa, criar lead e mover etapa.
3. Troque o CNAME do domínio para a nova hospedagem.
4. Mantenha a antiga ligada 48 h (tempo de propagação do DNS) e depois desligue.

## 5. Monitoramento

Aponte um monitor de disponibilidade (UptimeRobot, Better Stack...) para `https://app.seudominio.com.br/api/health`. A rota só responde se o servidor está de pé: não consulta o banco nem expõe configuração.
