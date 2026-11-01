# Aplicação do GitHub Intelligence ao NEXUS — plano auditável
Estado de partida: main em `b1bf7cf9`, Nexus V14. Projeto em Render/Next.js/Supabase. O usuário pediu preservar pesquisa/skills no GitHub e melhorar CRM, sem comprometer a versão publicada.

## Biblioteca preservada
- `AGENTS.md` dá instruções reais para agentes de programação que trabalhem no repositório.
- `PROMPT_MESTRE.md` registra as diretrizes integrais de arquitetura, UX e IA.
- `.agents/skills/github-intelligence/SKILL.md` fornece skill local de carregamento progressivo.
- `catalogo-github.md` registra referências por domínio; `arena-skill.md` documenta ferramenta externa sem executá-la.

## Intervenção inicial na V14
- Indicadores de amostra identificados corretamente no próprio card; não afirmar que 250 registros representam o histórico.
- Busca de leads tolerante a acentos/caixa/telefone.
- Área concisa de prioridades baseada em tarefas e agenda realmente carregadas, com navegação para operações existentes.
- Evitar erro de execução quando data de agendamento for inválida; estados de acesso e dados preservados.
- Testes unitários das regras de cobertura e normalização.
- Inspeção responsiva e visual em navegador **a realizar em ambiente de teste**. Sem aprovação automática do acabamento.

## Próximos passos de produto — não implementados nesta mudança
P0: homologar permissão e isolamento com duas empresas; verificar RLS e cobertura do banco real.
P1: ficha 360 com IDs relacionais, trilha de etapa e follow-up vinculado, APIs agregadas/paginadas.
P2: agendas com comparecimento, indicadores reconciliados, histórico e fluxo de vendas; gestão de mídia autorizada.
P3: IA por tenant, Segundo Cérebro isolado, memória contextual, aprovações e quotas; WhatsApp oficial bidirecional somente após homologação e infraestrutura real.
Nenhum desses recursos pode ser rotulado como ativo antes da implantação e teste.
