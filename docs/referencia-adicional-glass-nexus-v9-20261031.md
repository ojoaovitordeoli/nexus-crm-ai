# NEXUS | Incorporação da referência de recriação profissional

Data: 31/10/2026
Origem: especificação adicional enviada pelo responsável para aprimorar o Nexus já existente. **Não é autorização para criar outro aplicativo no Lovable.**

## Diretrizes fiéis à referência
- Modo escuro profundo como experiência inicial, iluminação petrol e âmbar em manchas discretas, superfícies de vidro fosco, bordas luminosas finas.
- Modo claro com qualidade equivalente. Preferência de tema do usuário persiste.
- Sora em títulos, Manrope em textos e controles. Menos texto autopromocional, mais nome de ação e resultado comercial.
- Ripple ao clicar, afundamento ao pressionar, elevação leve nos cartões e transição curta entre rotas. Respeitar prefers-reduced-motion.
- Jornada de CRM: login e papéis, painel de métricas, leads e ficha com histórico, kanban, tarefas e calendário, inbox estruturada, administração, busca global e Ctrl+K.
- IA deixa de ocupar espaço na navegação principal; módulos existentes não são deletados.

## Arquitetura: decisão consciente
A referência propõe TanStack Start, Lovable Cloud, TanStack Query, Framer Motion, dnd-kit e Recharts. **São indicações de outra implementação**, não necessidades imediatas do produto existente. O Nexus real está em Next.js + React + Supabase, com contas e dados de empresas. Reescrever o runtime e migrar banco agora geraria custo e risco de perda de dados desnecessários.

As interações visuais e padrões de UX podem ser reproduzidos no stack atual. Avaliar bibliotecas novas por necessidade real e testes, não pela etiqueta. Não provisionar Lovable Cloud, não duplicar usuários e não alterar a ligação de produção nesta fase.

## Implementação visual neste PR
1. Layout do painel reconstruído sem banner de demonstração ou órbitas.
2. Sora + Manrope e tokens --glass-bg, --glass-border e --shadow-glow.
3. Modo escuro inicial com opção de alternar para claro.
4. Shell, navegação, painel e componentes de leads/vendas/contatos com materiais e hierarquia harmonizados.
5. Botões reais com ripple por PointerDown, hover, active e redução de movimento.
6. Copiloto removido do menu principal, mantendo API e rota antigas para não quebrar dados.
7. Playwright: capturas e testes dos temas, tipografia, tokens, ripple, mobile sem overflow, login, navegação e Ctrl+K.

## Requisitos de fase 1 ainda não concluídos
- Importação CSV com prévia, deduplicação, normalização e isolamento por empresa.
- Ficha 360 de lead com histórico confiável de atividades e conversas.
- Etiquetas, filtros cruzados e responsável em toda a jornada comercial.
- Receitas previstas e taxas de conversão calculadas por funil/etapa, sem inferência sobre amostras.
- Animação de reordenação/soltura do kanban com teclado e acessibilidade, se for adotado dnd-kit.
- Caixa unificada efetivamente conectada; canal WhatsApp requer credenciais e homologação.
- Auditoria de permissão e RLS em empresas e papéis reais, não apenas mocks.
- Migrações e dados reais: manter Supabase atual; não adicionar dados fictícios a contas reais.

## Critério de aceite, sem nota inventada
Não publicar apenas com build verde. Exigir revisão visual desktop/mobile em ambos temas, continuidade de login, funil, agenda e ações; checar textos, foco/teclado, contraste; receber aprovação da equipe antes de lançar. O conceito de «nota 9» precisa ser confirmado pelo usuário nas telas efetivas e na operação, não autodeclarado.
