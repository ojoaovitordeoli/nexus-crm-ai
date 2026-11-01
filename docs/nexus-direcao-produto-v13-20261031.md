# NEXUS · Constituição de produto e design
**31 de outubro de 2026 · origem: materiais do cliente + código do projeto + referências públicas**

> O produto não está aprovado visualmente. Compilar, gerar screenshots e executar testes de mock não substituem homologação com usuários e dados reais. Proíbe-se definir nota subjetiva de qualidade com base em testes de CI.

## 1. Visão do produto
Nexus é um **CRM comercial multiempresa** e não um dashboard de ilustração. Serve a equipes de ramos diversos, preserva autorização por empresa e papéis de acesso e futuramente recebe o **Segundo Cérebro** como uma capacidade de contexto/memória aprovada, sem substituir CRM.

Sequência de trabalho: **empresa → cliente/lead → contato → oportunidade/etapa → retorno → agendamento → venda → histórico**. O que não tiver vínculo persistido no banco não pode ser apresentado como vinculado.

## 2. Evidências enviadas pelo cliente
- "Prompt mestre — Dashboard pessoal com glassmorphism, analytics e microinterações": UI funcional, responsiva; referências Instagram **Db7fSM1v8Yg** (login blade), **De_78COzoPO** (glassy V5), **DfCWtPgPcfP** (portal marine dark), **De9XFBQTG0D** (glassy V4); tema claro/escuro, contraste, microinterações 180–320ms, reduced motion e acessibilidade. **Não copiar código nem marca**.
- "Dossiê referências IA Instagram": Command Center vivo, funil configurável por empresa, assistente com skills aprovadas, ingestão de conhecimento, controle de custos/quotas e auditoria; o documento distingue inspirações não validadas de implementação comprovada.
- "Dossiê Mestre Nexus": Next.js/Supabase/Render, papéis, APIs, falhas históricas de experiência e avisos sobre integrações e tabelas não homologadas; limite atual de até 250 linhas por módulo.

## 3. Referências de mercado (observação pública; não código copiado)
- Agendor: telas de funil, busca/filtro por negócios, modos de listagem/quadro, múltiplos funis por processo. https://ajuda.agendor.com.br/pt-BR/articles/5373579-como-funciona-o-funil-do-agendor
- Agendor: tarefas associadas a negócio, histórico de vendas, follow-up. https://www.agendor.com.br/sistema-crm-gratuito
- Attio: dados estruturados e visualizações por negócio; https://attio.com/help/reference/attio-101/attios-data-model/define-your-data-model-objects-lists-and-views
- Linear: referências de clareza em sistemas densos, sem reutilizar identidade proprietária.
- Exemplos GitHub de componentes reais são referência de padrões de implementação/QA, sujeitos à verificação de licença e compatibilidade. **Não instalar ou copiar template inteiro** para dentro do Nexus.

## 4. Falhas de V9–V12 a NÃO repetir
- Cards idênticos, brilho e gradientes sem hierarquia; excesso de containers;
- Rótulos de microcopy genéricos ou promocionais que não explicam ações;
- Somar stylesheets e overrides de várias gerações sem design system;
- Exibir IA ou dados fictícios como se existissem integrações prontas;
- Validação com apenas 1 registro ou mock como se fosse integração real;
- Publicar experiência não inspecionada ou elogiar o próprio design como "9/10".

## 5. Regras de interface NEXUS
1. **Ritmo funcional**: ação do usuário aparece perto do dado que a origina. Evitar abrir outro módulo para fazer follow-up.
2. **Densidade com legibilidade**: nomes, datas, etapas e contexto operáveis na mesma visão; texto legível, rótulos claros; não exagerar com "heros" e KPIs sem ação.
3. **Personalidade contida**: naval/petróleo + teal e acento único, possível translucidez localizada; modo claro e escuro sempre legíveis.
4. **Escopo por empresa**: URL, search, estado e API nunca devem cruzar organização. Respectivo papel limita leitura/escrita.
5. **IA discreta e verificável**: somente recomendações fundamentadas no histórico autorizado, com permissão/consentimento e revisão humana para ações sensíveis. Nunca sugerir que Segundo Cérebro está conectado enquanto não estiver.
6. **Acessibilidade**: navegação por teclado e foco visível; 375px, 768px e desktop; reduced motion; erros de rede visíveis.
7. **Sem ações cenográficas**: toda ação persistente usa API/autorização real e confirmação de resposta. Sem histórico inventado.

## 6. V13 — escopo implementado, limites não resolvidos
- A rota **/leads** abre a nova mesa de oportunidades: busca, filtro por etapa/WhatsApp, ordenação, exportação CSV autorizada, detalhe com mudança de etapa, link WhatsApp validado, criação de retorno na tabela de tarefas da empresa e registro básico verificável.
- Quadro Kanban e editor existentes foram preservados.
- O nome do lead no título da tarefa **não é chave estrangeira**. Não mostrar histórico relacional ou notificações de IA como prontos.
- Esta entrega é **uma frente parcial** de evolução de produto. Dashboard, vendas, contatos, WhatsApp e integração Segundo Cérebro ainda precisam revisão e validação com contas reais.

## 7. Aceite mínimo de mudanças futuras
- Build e testes de navegador desktop/mobile;
- Testar busca, filtro, seleção, etapa, criação de tarefa, permissões VIEWER e organizações diferentes;
- Screenshot real da tela (com dados de teste sinalizados), inclusive 390px;
- Conferir live SHA em Render;
- Verificar usabilidade com operadores e dados reais para qualquer afirmação de produto pronto.

**Princípio final**: CRM excelente não é o que parece ter mais trabalho visual; é o que torna decisões e atendimentos mais rápidos, claros e confiáveis, mantendo identidade própria e acabamento rigoroso.
