# Captura de leads (V42)

Formulário de site ou landing page → funil do NEXUS, com o lead **já classificado** (quente, morno ou frio) e com a origem do anúncio gravada.

## Quem chama
Servidor → servidor: **n8n**, função do site (Netlify/Vercel Function), Make ou Zapier.
**Nunca** chame direto do navegador: a chave ficaria visível no código da página.

## Chave
- Configurações → **Captura de leads** → *Gerar chave* (só administrador da empresa).
- A chave (`nxl_…`) aparece uma única vez. No banco fica só o hash SHA-256.
- Gerar uma nova revoga a anterior. *Desligar captura* revoga todas.

## Envio
```
POST https://nexus-crm-ai.onrender.com/api/leads/capture
Authorization: Bearer nxl_...
Content-Type: application/json
```
```json
{
  "name": "Ana Souza",
  "whatsapp": "(48) 99999-1111",
  "email": "ana@exemplo.com",
  "city": "Laguna",
  "source": "Landing page exame de vista",
  "form_id": "lp-exame",
  "utm_source": "instagram", "utm_medium": "paid", "utm_campaign": "exame-gratis",
  "utm_content": "video-01", "utm_term": "",
  "campaign_id": "", "campaign_name": "", "adset_id": "", "adset_name": "", "ad_id": "", "ad_name": "Vídeo 01",
  "answers": { "urgencia": "esta semana", "orcamento": "até R$ 800", "interesse": "óculos de grau" },
  "message": "Quero marcar o exame",
  "estimated_value": 800,
  "temperature": "quente",
  "score": 80
}
```
Obrigatório: `whatsapp` **ou** `email`. Todo o resto é opcional. `organization_id`, funil, etapa e responsável vindos no corpo são **ignorados**: a empresa vem da chave.

## Classificação (0–100)
| Sinal | Pontos |
|---|---|
| WhatsApp válido | +25 |
| E-mail | +10 |
| `answers.urgencia` (ou `prazo`) com agora / hoje / imediato / urgente / esta semana / amanhã | +40 |
| … com este mês / 15 dias / 30 dias / próximo mês / em breve | +20 |
| `answers.orcamento` ou `estimated_value` > 0 | +15 |
| `message` com 20+ caracteres | +10 |

Quente ≥ 65 · Morno 35–64 · Frio < 35. Se vier `temperature` (quente/morno/frio ou hot/warm/cold), ela vale; se vier `score` (0–100), ele é gravado.
O motivo da classificação fica numa nota no histórico do lead.

## O que acontece
1. Contato da mesma empresa com o mesmo WhatsApp (com ou sem 55) ou e-mail é **reaproveitado**; senão, é criado.
2. Se esse contato já tem **atendimento aberto** no funil padrão: nada é duplicado. A entrada vira uma nota, `last_interaction_at` é atualizado e a temperatura **só sobe** (frio → morno → quente).
3. Senão: lead novo na **primeira etapa ativa do funil padrão**, com UTM, campanha, conjunto, anúncio, formulário, temperatura, pontuação e valor; trilha de etapa e nota com as respostas.
4. Tudo vai para `audit_logs`.

## Respostas
| Status | Quando |
|---|---|
| 201 `{"status":"created","lead_id","temperature","score"}` | lead novo |
| 200 `{"status":"existing",...}` | contato já tinha atendimento aberto |
| 400 | dados inválidos (mensagem em português) |
| 401 | chave ausente, inválida ou revogada |
| 409 | empresa sem funil com etapa ativa |
| 413 / 415 | corpo maior que 16 KB / não é JSON |
| 503 | banco indisponível ou migração não aplicada (`code: not_installed`) |

## Banco
`supabase/20261116_captura_leads.sql` (rollback no arquivo `_rollback`): só cria `lead_capture_tokens`, tabela exclusiva do servidor (RLS ligado, sem políticas, privilégios revogados para anon/authenticated).
