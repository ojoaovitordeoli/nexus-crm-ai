# Análise v3 — Sistema Óptica + Flowa vs NEXUS (15/11/2026)

Leitura feita com o acesso ADM (painel do dono) do Sistema Óptica, olhando os módulos com dados de uma ótica real, e com o acesso de gestor de tráfego do Flowa. Nada foi salvo, enviado ou apagado. Nomes e telefones de clientes não foram registrados aqui.

Complementa `analise-comparativa-optica-v2.md` (que cobriu Kanban, editor de funil, ficha e Agente IA). Aqui entra o que faltava: WhatsApp por dentro, automações de disparo, pós-venda, módulos ópticos, painel do dono do SaaS e Flowa.

## 1. O que é cada sistema

**Sistema Óptica** — SaaS vendido para óticas/clínicas. Dois níveis:
- **Portal do dono (ADM):** Clientes Ativos (111 ativos, 158 cancelados, com etapa de onboarding "Entrada → Processo Inicial → Nível 1-4 → Ouro"), ADM Geral (298 usuários, status das conexões WhatsApp com verificação a cada 5 min, API externa com o Flowa), Banco de Dados, **Planos** (cada plano liga/desliga 31 módulos), Análise Mensal, Apresentação, Academia.
- **Operação da ótica (usuário):** 31 módulos em 5 grupos — MKT & Vendas, Gestão, Orçamento & OS, Cadastros, Sistema.

**Flowa** — sistema interno da agência (gestor de tráfego, CS, editor). Sincroniza clientes, Método ADO e vendas com o Sistema Óptica por webhook (`x-api-token`).

## 2. Atendimento — o coração (foco do pedido)

### Kanban (CRM)
- Colunas: Novos Leads · Em Contato · Agendado · Compareceu · Venda Feita · Perdido · Desqualificado. Contagem por coluna.
- **Card:** nome, **badge de mensagens não lidas**, etiqueta de origem (Tráfego Pago), telefone, **tempo na etapa** ("2d"), status "Conversa ativa", ações rápidas **Mover para…**, **Abrir WhatsApp**, agenda e data.
- Filtros: mês, ano, origem, tipo de lead, busca; **Salvar filtros como padrão**; Exportar.
- **Editor de funil:** modelos múltiplos (Padrão / Em branco), cores, reordenar, **Salvar e ativar**, aviso de que leads de etapas removidas continuam salvos.
- **Ficha do lead (abas):** Dados · Anotações · **Link de Pagamento** · **Orçamento** · **O.S.** · **Jornada do Cliente** (criação, origem, cada mudança de status com hora). Topo: Abrir WhatsApp, **Transferir de mês**, editar, excluir.

### WhatsApp (caixa de atendimento)
- Seletor de empresa no topo (o ADM vê qualquer ótica).
- Lista: avatar, nome + número, **contador de não lidas**, hora, **etapa do funil embaixo do nome**, prévia da última mensagem (texto, [audio], [imagem], [reacao]).
- Conversa: cabeçalho com **origem**, **etapa (clicável para trocar)**, **tempo na etapa**, excluir.
- **Envia de verdade:** texto, imagem, anexo e **gravação de áudio**; toca áudio recebido.
- Mensagens automáticas aparecem na mesma conversa (boas-vindas do anúncio, pós-venda).
- Alterar etapa direto da lista de conversas (botão "Alterar estágio do lead" em cada item).

### Automações que rodam pelo WhatsApp
- **Agendamentos → Disparos automáticos** com régua pronta: mesmo dia 2h antes; dia seguinte 08:00 + 2h; até 7 dias: lembrete 3 dias + véspera + 08:00 + 2h; >7 dias lembrete a cada 4 dias. Variáveis `{nome} {tipo} {data} {hora}`. Histórico de disparos.
- **Pós-venda:** funil criado **automaticamente ao registrar a venda**. Régua 7 / 15 / 30 / 90 / 180 / 270 / 365 dias, várias mensagens por etapa ("mensagens quebradas"), variável `{nome}`. Na venda se escolhe: Automático / Manual / Sem pós-venda.
- **Indicação:** link de indicação + **link com roleta de prêmios**; até 4 mensagens automáticas ao indicado (0s/30s/60s/90s) com `{nome_indicado} {nome_loja} {nome_do_indicador}`; ranking de indicadores e taxa de conversão.
- **Captadores:** pessoas externas que trazem leads, com comissão e conversão.
- **CRM Repescagem:** Kanban separado (Novos · Em Contato · Agendado · Convertido · Perdido) + **disparo em massa**; "Iniciar repescagem" a partir da base de clientes.
- **Agente IA:** editor de fluxo estilo n8n, subagentes, template "Clínica Modular".

### Venda (o que liga tudo)
Formulário: fonte (Tráfego, Indicação, Captador, Passante, Cliente Base, Outros), produtos ou valor avulso, desconto, forma (PIX, dinheiro, crédito, débito, boleto, transferência), condição (à vista, entrada+parcelas, parcelado, faturado), parcelas, status, vendedor, **fornecedor, responsável técnico, oftalmologista**, dados do cliente (CPF, nascimento, endereço) e **escolha do pós-venda**. Aba "Transações Stone".

## 3. Gestão e módulos ópticos (contexto)
Dashboard em 3 visões (Marketing e Vendas · Financeiro · Insights); Relatórios com conversão por fonte e PDF; Metas; Tráfego Pago (lançamento semanal de investimento, CPL, CTR, vendas do tráfego); Financeiro com caixa digital + **Asaas** (cobranças, PIX, extrato); Notas Fiscais (Asaas + Focus NFe); Calculadora de Precificação com rateio de custo fixo; Produtos/estoque; Orçamentos; Ordem de Serviço; **Fabricação de Lentes** (Kanban: Aguardando envio → Lab → Fabricação → Trânsito → Recebido → Pronto → Entregue); **Medição de DP por foto**; **Provador Virtual** com link público; **Consultor Óptico** (visagismo, espessuras, tratamentos); cadastros de fornecedores, funcionários, responsável técnico, oftalmologistas e marcas.

## 4. Flowa (só o que interessa ao NEXUS)
Clientes por nível de operação; **Rotina** do dia em blocos de horário com checklist; **Tarefas semanais** em Kanban com prioridade, checklist e delegação; **Gerenciamento de campanhas** Meta consolidado (investido, conversas, CPL, saldo); **Alertas operacionais** (saldo ≤ R$100, CPL alto, grupo sem resposta > 15 min); **Disparos de sexta** (resumo semanal automático para o cliente, com anti-bloqueio); Squads (CS + gestor + editor por cliente); Saldos semanais; Reuniões com sala de vídeo própria; WhatsApp pessoal por QR Code.

## 5. Comparação com o NEXUS (código V36)

| Função | Sistema Óptica | NEXUS hoje | Situação |
|---|---|---|---|
| Kanban com contagem e arrastar | Sim | Sim | Igual |
| Editor de funil, Salvar e ativar | Sim | Sim (`PremiumOperation.jsx`) | Igual |
| Histórico de etapas | Jornada do Cliente | `lead_stage_history` existe | Igual no banco, falta mostrar como jornada |
| **Não lidas no card / tempo na etapa** | Sim | Não | **Falta** |
| **Ações rápidas no card (Mover / WhatsApp)** | Sim | Parcial | **Inferior** |
| Filtro salvo como padrão | Sim | Não | Falta |
| Ficha: Orçamento / O.S. / Link de pagamento | Sim | Não | **Falta** |
| **WhatsApp enviar texto/áudio/imagem** | Sim | **Somente leitura** | **Inferior (maior gap)** |
| Etapa e origem dentro da conversa | Sim | Não | Falta |
| **Lembrete automático de agendamento** | Régua completa | Não | **Falta** |
| Comparecimento / no-show | Sim | Sim | Igual |
| **Pós-venda automático ao vender** | Sim, régua 7–365 dias | Não | **Falta** |
| Venda vinculada ao cliente | Sim | Sim (V24) | Igual |
| Venda: pagamento, parcelas, fonte, profissional | Sim | Parcial | Inferior |
| Indicação (quem indicou, ranking) | Sim + roleta + disparos | Sim (V36), sem roleta/disparo | Inferior |
| Captadores com comissão | Sim | Não | Falta |
| Repescagem + disparo em massa | Sim | Não | Falta |
| Metas do mês | Sim | Não | Falta |
| Tráfego pago (CPL, investimento) | Lançamento manual | Não | Falta |
| Agente IA com fluxo visual | Sim | Assistente com confirmação (V32) + React Flow | Diferente; o NEXUS é mais seguro |
| Importar planilha | Sim | Sim (.xlsx, V33) | Igual |
| Planos liga/desliga módulos | Sim | Não | Falta (importante para vender) |
| Monitor de conexão WhatsApp por empresa | Sim | Não | Falta |
| Segurança multiempresa (RLS, papéis) | Não verificado | Forte (P0) | **NEXUS melhor** |

## 6. Onde o NEXUS já é melhor
- Segurança por empresa no banco (RLS + papéis testados) e teste contra vazamento de segredo no bundle.
- Assistente que prepara ação e **pede confirmação** antes de executar.
- Serve para qualquer segmento, não só ótica.
- Ponto fraco observado no concorrente: o ADM abre o WhatsApp real de qualquer ótica, um risco de LGPD que o NEXUS não deve copiar.

## 7. O que trazer primeiro (ordem sugerida)
1. **Card do Kanban acionável:** não lidas, tempo na etapa, Mover para…, Abrir WhatsApp. Pequeno, alto impacto, não depende de API nova.
2. **Jornada do Cliente na ficha** usando o `lead_stage_history` que já existe.
3. **WhatsApp que envia** (texto, áudio, imagem) e troca de etapa dentro da conversa — depende de homologar a WuzAPI/Cloud API (P3).
4. **Lembretes de agendamento** com a régua acima (depende do item 3).
5. **Pós-venda automático** criado pela venda, régua editável (depende do item 3).
6. Venda completa (forma/condição/parcelas/fonte) + **Metas do mês**.
7. Repescagem com disparo em massa (com limite anti-bloqueio).
8. Planos com módulos liga/desliga (para vender o NEXUS em níveis).

## 8. Visão de usuário (login de dono de ótica, plano reduzido)

- **Menu menor, definido pelo plano:** Dashboard, Academia, CRM, Leads, Vendas, WhatsApp (contador "99+" no menu), Tráfego Pago, Indicação, Agendamentos, Clientes, Produtos, Cadastros e Configurações.
- **Uma conta, várias empresas:** em Configurações → Empresas, o usuário vê todas as empresas vinculadas e troca com "Acessar". "Solicitar Nova Empresa" pede ao dono do SaaS.
- **Configurações do usuário:** Usuários (por empresa: Dono/Gerente/Vendedor), **WhatsApp por UazAPI** (URL + token + webhook, "Testar conexão"), **Notificações** (novo lead, venda, agendamento, estoque baixo, meta semanal, O.S. pronta, aniversário, vencimento de receita; por e-mail; som da mensagem do WhatsApp), Meios de Pagamento (Asaas e Stone ativos; Cielo, Rede, Getnet, PagBank, Mercado Pago "em breve"), Acert Conecta, Focus NFe e **API Pública** (token por empresa + webhooks de saída assinados com HMAC).
- **Agenda na prática:** cada agendamento tem os botões **Compareceu / Não compareceu / Reagendar / Excluir** direto na linha.
- **Kanban e WhatsApp** iguais aos vistos pelo ADM.
- **Falha deles:** módulos fora do plano somem do menu, mas **abrem pelo endereço direto** (/financeiro, /pos-venda, /metas abriram). O bloqueio só existe na tela. No NEXUS, o plano tem de ser checado no servidor e no banco.

## 9. Plano de aplicação no NEXUS

Cada item entra como versão pequena, com teste e sem fingir integração.

### Usuário (operação da empresa)
| Ordem | Entrega | Depende de |
|---|---|---|
| V38 ✅ | Card do Kanban: tempo na etapa, Conversar, Mover para…, ficha sobre o quadro | — |
| V39 ✅ | Agenda com Compareceu / Não compareceu / Reagendar na linha | — |
| V40 ✅ | Venda completa: forma, condição, parcelas, fonte, desconto + **Metas do mês** no painel | — (usa colunas e tabela `goals` já existentes) |
| V41 | **WhatsApp que envia** (texto, áudio, imagem) via WuzAPI, etapa e origem na conversa, contador de não lidas no menu e no card | WuzAPI homologada |
| V42 | **Lembretes de agendamento** com a régua (3 dias, véspera, 08:00, 2h antes) e histórico de envios | V41 |
| V43 | **Pós-venda automático** criado pela venda, régua editável 7→365 dias | V41 |
| V44 | Repescagem (Kanban próprio + envio em massa com limite anti-bloqueio) | V41 |
| V45 | Notificações escolhidas pelo usuário (novo lead, venda, agendamento, meta) | — |

### ADM (dono do NEXUS / super admin)
| Ordem | Entrega |
|---|---|
| A1 | **Planos com módulos** liga/desliga, aplicados no servidor e no RLS (não só no menu) |
| A2 | Painel de empresas clientes: ativas, pausadas, canceladas, plano e dias de casa |
| A3 | **Monitor das conexões WhatsApp** de todas as empresas (online/offline, tempo fora) |
| A4 | Usuário com várias empresas e troca rápida (já existe seletor; falta a tela "Minhas empresas") |
| A5 | API pública por empresa com token e webhook assinado (HMAC) |

**Não copiar:** o ADM lendo conversas reais de qualquer cliente. No NEXUS, o super admin vê status e métricas, nunca o conteúdo das conversas.
