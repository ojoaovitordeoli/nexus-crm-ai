// V53 — "A cara do negócio": palavras do ramo da empresa (ótica fala "exame", clínica fala "paciente").
// O ramo fica em organizations.segment. Valores antigos em texto livre continuam valendo: detectarRamo
// reconhece o que der e o resto usa o vocabulário geral. Funções puras (tests/vocabulario.test.mjs).

export const RAMOS = {
  geral: {rotulo: 'Geral', cliente: 'cliente', clientes: 'clientes', atendimento: 'atendimento', atendimentos: 'atendimentos', agendamento: 'agendamento', agendamentos: 'agendamentos', venda: 'venda', vendas: 'vendas',
    sugestoes: ['Monta um quadro dos meus atendimentos por etapa', 'Gráfico das vendas por vendedor nos últimos 30 dias', 'Quais atendimentos estão parados há 3 dias?', 'O que eu tenho pra hoje?']},
  otica: {rotulo: 'Ótica', cliente: 'cliente', clientes: 'clientes', atendimento: 'atendimento', atendimentos: 'atendimentos', agendamento: 'exame de vista', agendamentos: 'exames de vista', venda: 'venda', vendas: 'vendas',
    sugestoes: ['Quantos exames de vista tenho esta semana?', 'Monta um quadro dos meus atendimentos por etapa', 'Gráfico das vendas por vendedor no mês', 'Quero guardar o grau de cada cliente']},
  clinica: {rotulo: 'Clínica / consultório', cliente: 'paciente', clientes: 'pacientes', atendimento: 'atendimento', atendimentos: 'atendimentos', agendamento: 'consulta', agendamentos: 'consultas', venda: 'tratamento fechado', vendas: 'tratamentos fechados',
    sugestoes: ['Quais pacientes estão parados há 3 dias?', 'Monta um quadro dos pacientes por etapa', 'Quero guardar o convênio de cada paciente', 'O que eu tenho pra hoje?']},
  odontologia: {rotulo: 'Odontologia', cliente: 'paciente', clientes: 'pacientes', atendimento: 'avaliação', atendimentos: 'avaliações', agendamento: 'avaliação', agendamentos: 'avaliações', venda: 'tratamento fechado', vendas: 'tratamentos fechados',
    sugestoes: ['Quantas avaliações tenho esta semana?', 'Monta um quadro dos pacientes por etapa', 'Gráfico dos tratamentos fechados por origem', 'Quero guardar o procedimento de interesse']},
  estetica: {rotulo: 'Estética', cliente: 'cliente', clientes: 'clientes', atendimento: 'atendimento', atendimentos: 'atendimentos', agendamento: 'avaliação', agendamentos: 'avaliações', venda: 'pacote fechado', vendas: 'pacotes fechados',
    sugestoes: ['Quantas avaliações tenho esta semana?', 'Monta um quadro das clientes por etapa', 'Gráfico dos pacotes fechados por origem', 'Quero guardar o procedimento de interesse']},
  academia: {rotulo: 'Academia / estúdio', cliente: 'aluno', clientes: 'alunos', atendimento: 'interessado', atendimentos: 'interessados', agendamento: 'aula experimental', agendamentos: 'aulas experimentais', venda: 'matrícula', vendas: 'matrículas',
    sugestoes: ['Quantas aulas experimentais tenho esta semana?', 'Monta um quadro dos interessados por etapa', 'Gráfico das matrículas por origem', 'Quero guardar o objetivo de cada aluno']},
  imobiliaria: {rotulo: 'Imobiliária', cliente: 'cliente', clientes: 'clientes', atendimento: 'atendimento', atendimentos: 'atendimentos', agendamento: 'visita', agendamentos: 'visitas', venda: 'negócio fechado', vendas: 'negócios fechados',
    sugestoes: ['Quantas visitas tenho esta semana?', 'Monta um quadro dos atendimentos por etapa', 'Gráfico dos negócios fechados por origem', 'Quero guardar o bairro de interesse']},
  varejo: {rotulo: 'Loja / varejo', cliente: 'cliente', clientes: 'clientes', atendimento: 'atendimento', atendimentos: 'atendimentos', agendamento: 'visita à loja', agendamentos: 'visitas à loja', venda: 'venda', vendas: 'vendas',
    sugestoes: ['Gráfico das vendas por vendedor no mês', 'Monta um quadro dos atendimentos por etapa', 'Quais clientes estão parados há 3 dias?', 'O que eu tenho pra hoje?']}
};

const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const PISTAS = [
  ['otica', /otica|oculos|optic|lente/], ['odontologia', /odonto|dentist|dental|implante/],
  ['clinica', /clinic|consultorio|medic|saude|fisio|nutri|psico|terap|oftalmo/], ['estetica', /estetic|beleza|harmoniza|spa|salao/],
  ['academia', /academia|estudio|pilates|crossfit|fitness|treino/], ['imobiliaria', /imobil|imovel|corretor/], ['varejo', /loja|varejo|comercio/]
];

/** Texto livre de organizations.segment → chave de RAMOS (ou 'geral'). */
export function detectarRamo(segment) {
  const t = norm(segment);
  if (!t) return 'geral';
  if (RAMOS[t]) return t;
  for (const [ramo, re] of PISTAS) if (re.test(t)) return ramo;
  return 'geral';
}

/** Palavras do ramo, sempre completas (cai no geral quando faltar algo). */
export function vocabulario(segment) {
  const ramo = detectarRamo(segment);
  return {ramo, ...RAMOS.geral, ...RAMOS[ramo]};
}

/** Linha para o prompt do assistente. */
export function instrucaoVocabulario(v) {
  if (v.ramo === 'geral') return '';
  return 'A empresa é do ramo ' + v.rotulo + '. Fale com as palavras desse ramo: diga "' + v.clientes + '" para clientes, "' + v.agendamentos + '" para agendamentos e "' + v.vendas + '" para vendas. Nos títulos das telas use essas palavras (ex.: "' + v.clientes.charAt(0).toUpperCase() + v.clientes.slice(1) + ' por etapa").';
}

/** Valida o ramo pedido (chave fixa). */
export function ramoValido(r) { const k = norm(r); return RAMOS[k] ? k : null; }
