# AGENTS.md — NEXUS CRM AI

Este arquivo governa o trabalho de agentes de programação neste repositório. Leia também [GitHub Intelligence](docs/github-intelligence/README.md), [prompt mestre](docs/github-intelligence/PROMPT_MESTRE.md) e [skill local](.agents/skills/github-intelligence/SKILL.md). Estas são instruções de trabalho, **não** funcionalidades de IA automaticamente habilitadas para os usuários do CRM.

## Produto e decisões inegociáveis
- NEXUS é um CRM multiempresa, horizontal, com evolução futura para Segundo Cérebro. Stack atual: Next.js 15, React 19, Supabase, Render. Preservar arquitetura existente antes de cogitar refatoração.
- Priorizar jornada real: empresa → lead/contato → atendimento → etapa → retorno → agendamento → venda → relatório.
- Respeitar `organization_id`, sessão verificada no servidor, autorização por perfil, isolamento entre empresas, RLS, consentimento e LGPD. `service_role` e segredos nunca chegam ao cliente.
- Recursos inativos não podem ser apresentados como disponíveis. O WhatsApp é atualmente uma inbox somente leitura e o copiloto exige configuração/consentimento. Segundo Cérebro ainda não está conectado.
- Evitar ações cenográficas e dados inventados. Vendas, tarefas, eventos e resultados dependem de persistência/autorização real.

## Regra de pesquisa e skills
1. Inspecionar a implementação existente, testes e documentação antes de escrever código.
2. Pesquisar ferramentas do catálogo `docs/github-intelligence/catalogo-github.md` somente quando resolvem problema concreto; verificar README, licença, manutenção, issues, segurança, compatibilidade.
3. Diferenciar skills (instruções) de MCP, APIs, IDEs e ferramentas (capacidades reais). Nunca alegar que o agente absorveu todo GitHub.
4. Não executar código de repositórios externos sem revisão, nem instalar bibliotecas automaticamente sem necessidade.
5. Adotar padrões, não copiar produtos concorrentes ou interfaces proprietárias.

## Linguagem visual
- Design autoral, profissional e útil; base V14, Sora + Manrope, naval/teal, tema claro/escuro, vidro fosco pontual. Referência funcional: Agendor, Attio, Linear; não reproduzir marcas/telas.
- Evitar cards gêmeos, gradientes e brilhos gratuitos, novos estilos de geração sem necessidade, animações não funcionais. Não adicionar outra camada CSS sem motivo.
- Estados reais: loading, vazio, erro, sucesso, dados parciais, sem acesso; UX para 390px, 768px e desktop; foco, teclado e reduced-motion.
- Toda nova funcionalidade tem ação visível, contexto, feedback de persistência e resultado verificável.

## Fluxo de engenharia
1. Descrever o problema e caminho crítico, verificando a área afetada.
2. Fazer mudança mínima, testável e reversível. Priorizar bugs reais e experiência operacional.
3. Para migrações de banco, registrar SQL versionado e não executar em produção sem validação com o Supabase real.
4. Executar `npm test`, `npm run build` e, quando houver infraestrutura, `npm run test:browser`; testar papéis e isolamento com usuários reais de teste.
5. Reportar precisamente: arquivos modificados, evidências, testes executados, riscos e pendências. Nunca declarar homologação de produção sem dados e aprovação.

Nenhum arquivo desta biblioteca autoriza merge ou deploy automaticamente.