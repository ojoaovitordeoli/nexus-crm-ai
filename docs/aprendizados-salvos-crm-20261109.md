# Salvos do Instagram aplicados ao Nexus CRM — 09/11/2026

Fonte: pacote de análise dos salvos do João (1.044 publicações; 31 fichas de 07/11 e 47 de 27/09).
Só 2 vídeos foram assistidos por inteiro (Hotel Inbox `DfXJM8xDc_u`, Veyra Health `DfV39ohhwAC`); o resto é legenda/capa.
Por isso, cada item abaixo é **padrão adaptado**, não receita do criador. Nada de terceiros foi instalado.

## Aplicado na V21 (esta entrega)
| Salvo | Ensinamento | No Nexus |
|---|---|---|
| R24 "CTR não é conversão" (`@gustavoprivate`) | Volume de clique/lead não mede resultado | Relatórios → **Origem até a venda**: por origem, leads da coorte, quantos agendaram, quantos compraram, conversão e faturamento. Só conta agendamento/venda ligados por `lead_id`; vendas sem lead aparecem à parte. `lib/sales-attribution.mjs` |
| Veyra Health (`DfV39ohhwAC`, vídeo) e CarePath (`DfQBn-BBG1Y`) | Fila ordenada pelo prazo, com contexto e próxima ação; alerta que explica o porquê | Minhas tarefas: cada retorno mostra o **lead vinculado** (link para a ficha + origem) e **"Vencida há N dias"** em vez de só a data |

## Já estava no código (conferido)
- Hotel Inbox (`DfXJM8xDc_u`, vídeo): webhook WhatsApp idempotente por `provider_message_id`, empresa resolvida no servidor pelo número cadastrado, vínculo ao contato sem criar registro (`app/api/webhooks/whatsapp/route.js`).
- R35 WhatsApp oficial × não oficial: o Nexus usa só a Cloud API oficial.

## Fila (precisa de decisão, schema ou dados reais)
1. **Campanha/UTM no lead** (R45, R29): o relatório hoje agrupa só por `source`. Gravar `utm_source/medium/campaign` na captura permite medir campanha, não só canal. Requer coluna + formulário.
2. **LGPD** (`DfXFwwCDFMD`): revisar campos obrigatórios (telefone só se necessário), base legal/consentimento no lead, prazo de retenção e pedido de exclusão do titular.
3. **Prospecção local** (R13, `DeK6rXOirDb`): importação de lista (CSV) com origem "Prospecção", deduplicação por telefone e revisão humana antes de qualquer contato. Não automatizar disparo.
4. **Grupos opt-in** (R06): registrar consentimento do contato para receber ofertas antes de qualquer automação de envio.
5. **Inbox → lead** (Hotel Inbox): rascunho de resposta por IA só com aprovação humana; depende das migrações de WhatsApp/IA aplicadas.
6. **Revisão visual "sem cara de IA"** (`DfKG5-uD9Tr` unslop, R14/R47): usar como checklist de auditoria do dashboard, não como dependência.
