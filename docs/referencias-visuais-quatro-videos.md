# NEXUS — revisão visual dos quatro vídeos originais

Referências recebidas em MP4 em 29/10/2026. Esta revisão foi feita a partir de quadros distribuídos ao longo de **todos os vídeos**, não apenas de screenshots de capa. O objetivo é aproveitar linguagem visual e interação, não copiar código ou a identidade de outros produtos.

## 1. `snapinsta-1793244837545.mp4` — Glassy Dashboard V4 (5,62s)
**Aparência observada:** fundo fotográfico quente e bastante desfocado (interior arquitetônico), painéis amplos e translúcidos, botões pequenos em formato cápsula, métricas compactas, bordas finas, leve dourado como destaque. Escala: muito espaço em branco e agrupamentos de informação. Alterna telas de indicadores, pipeline e relatórios.

**Aplicação NEXUS:** paleta marfim, areia, verde-petróleo e detalhe dourado; cards com transparência real e legibilidade reforçada; maior hierarquia tipográfica e espaçamento. Usamos **gradientes ambientais** sem reutilizar imagens de terceiros ou carregar uma foto pesada em toda página.

## 2. `snapinsta-1793244818692.mp4` — Glassy Dashboard V5 (5,8s)
**Aparência observada:** cenário panorâmico em segundo plano; vidro escuro e translucidez; pequena barra lateral flutuante à esquerda; grupos de cartões mais escuros com detalhes coloridos; animação de troca entre indicadores, mensagens e visão geral. No vídeo, a cena continua visível através das superfícies.

**Aplicação NEXUS:** modo escuro mais profundo, barra de navegação clara e estados ativos visíveis. Não transformar todo o CRM em um wallpaper fotográfico que prejudique leitura e desempenho.

## 3. `snapinsta-1793244828204.mp4` — Dashboard Animation (6,20s)
**Aparência observada:** console em azul-petróleo, métricas e linha do gráfico, troca para pipeline Kanban, navegação para detalhe com progressão de etapa e, ao final, uma versão clara. A transição entre estados da aplicação é o evento principal, não um botão especial de reprodução.

**Aplicação NEXUS:** sequências de entrada dos blocos de acordo com a hierarquia visual, gráfico que se desenha, cards de Kanban escalonados e transição suave entre módulos. O replay permanece **secundário**, útil para inspeção e demonstração. Funcionalidade nunca deve depender de animação.

## 4. `snapinsta-1793244809065.mp4` — Login & Signup Animation (5,15s)
**Aparência observada:** formulário sobre painel claro/creme, painel adjacente verde-floresta com texto editorial inclinado/serif, borda diagonal pronunciada, superfície que desliza na troca entre entrar e criar conta. Controles finos, formulário alinhado e CTA verde-escuro.

**Aplicação NEXUS:** split-screen no desktop, painel editorial e superfície diagonal, transição entre login e recuperação de senha. **Não habilitar cadastro público** apenas porque a referência visual mostra a tela de signup: o NEXUS cria usuários via Super Admin.

## Hierarquia resultante
1. V4: visual, materiais, tipografia e espaçamento
2. V5: navegação e modo escuro
3. Dashboard Animation: animação coerente com eventos reais de mudança de tela
4. Login Animation: autenticação e transição de estado

## Aspectos funcionais implementados nesta revisão
- Central de Comandos acessível via Ctrl/⌘+K e botão da topbar, com busca, estados vazios e resposta ao teclado.
- Atalhos rápidos para criar tarefa e contato, navegar, atualizar e trocar tema; filtros operando também ao pesquisar no módulo já aberto.
- Exportação CSV de contatos **filtrados e carregados**, com escape contra fórmulas injetadas em planilhas.
- Tipografia DM Sans / Manrope com tamanhos de interface menos microscópicos, foco visível e contraste.
- Autenticação Supabase e roteamento preservados, sem liberar endpoints ou permissões novas.
- Teste de navegador em CI para login, sessão simulada, comandos, atalhos, responsividade e screenshot de diagnóstico.

## O que esta revisão não comprova
- Fidelidade de 100% ou 98% aos vídeos: dependeria de comparação visual com capturas da aplicação dentro do navegador.
- Integração ativa de WhatsApp, envio de mensagens pela API oficial, agentes que executam tarefas ou sincronização externa de agenda.
- Operações de banco homologadas com uma conta real de cada perfil; o teste de navegador usa somente dados falsos e mocks.

## Critérios de aceite recomendados
- Variações claro/escuro e viewport 390px, 768px, 1440px sem overflow.
- Entrada dos cards e painéis em sequência, mantendo acessibilidade com `prefers-reduced-motion`.
- Paleta Ctrl+K abre, aceita texto, filtra registros, executa ações e fecha com Escape.
- Tarefas e contatos são criados e persistem no Supabase (verificação autenticada).
- Permissões por empresa e papel impedem acesso cruzado.
- Gráficos exibem apenas dados reais ou estados vazios explícitos.
