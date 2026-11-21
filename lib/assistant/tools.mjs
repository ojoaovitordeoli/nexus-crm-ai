// Ferramentas do Assistente. Consultas executam no servidor (só dados da empresa).
// "propor_*" NÃO gravam nada: devolvem uma proposta que a pessoa confirma na tela.

const obj=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const str=description=>({type:'string',description});

export const TOOL_DEFS={
  resumo_do_dia:{description:'Resumo do dia: tarefas vencidas e de hoje, compromissos de hoje e próximos, leads novos e vendas do mês.',parameters:obj({})},
  buscar_cliente:{description:'Busca contatos/leads da empresa por nome ou telefone e mostra a etapa do atendimento.',parameters:obj({termo:str('Nome ou parte do telefone')},['termo'])},
  ver_funil:{description:'Quantidade e valor dos leads abertos em cada etapa do funil.',parameters:obj({funil:str('Nome do funil (opcional; padrão da empresa se vazio)')})},
  ver_vendas:{description:'Vendas registradas nos últimos N dias: quantidade, total e ticket médio.',parameters:obj({dias:{type:'integer',minimum:1,maximum:365,description:'Período em dias (padrão 30)'}})},
  leads_parados:{description:'Leads abertos sem mudar de etapa há N dias ou mais.',parameters:obj({dias:{type:'integer',minimum:1,maximum:180,description:'Dias parado (padrão 3)'}})},
  ajuda_nexus:{description:'Como fazer algo no NEXUS CRM (cadastrar equipe, importar planilha, configurar funil, etc.).',parameters:obj({tema:str('O que a pessoa quer fazer')},['tema'])},
  propor_tarefa:{description:'Propõe criar uma tarefa/retorno. A pessoa confirma antes de salvar.',parameters:obj({titulo:str('O que precisa ser feito'),prazo:str('Data AAAA-MM-DD (opcional)'),cliente:str('Nome do cliente para vincular (opcional)')},['titulo'])},
  propor_compromisso:{description:'Propõe agendar um compromisso. A pessoa confirma antes de salvar.',parameters:obj({titulo:str('Título'),inicio:str('Data e hora no horário de Brasília: AAAA-MM-DDTHH:MM'),local:str('Local (opcional)'),cliente:str('Nome do cliente (opcional)')},['titulo','inicio'])},
  propor_mover_etapa:{description:'Propõe mover o lead de um cliente para outra etapa do funil. A pessoa confirma.',parameters:obj({cliente:str('Nome do cliente'),etapa:str('Nome da etapa de destino')},['cliente','etapa'])},
  propor_venda:{description:'Propõe registrar uma venda. A pessoa confirma antes de salvar.',parameters:obj({valor:{type:'number',minimum:0.01,description:'Valor em reais'},cliente:str('Nome do cliente (opcional)')},['valor'])},
  montar_tela:{description:'Monta uma TELA na hora para a pessoa ver (lista, quadro de etapas, gráfico ou número) a partir dos dados da empresa. Use sempre que pedirem para ver, mostrar, montar, listar, comparar ou acompanhar algo ("me mostra os leads quentes", "quadro por etapa", "vendas por vendedor no mês", "quantos contatos de Curitiba"). A tela aparece para a pessoa, que pode salvar em "Minhas telas". Não invente campos: use só as opções.',
    parameters:obj({
      titulo:str('Título curto da tela, em português (ex.: "Leads quentes por etapa")'),
      tipo:{type:'string',enum:['lista','quadro','grafico','numero'],description:'lista = tabela; quadro = colunas por etapa (só leads); grafico = barras por grupo; numero = um total'},
      fonte:{type:'string',enum:['leads','vendas','tarefas','contatos'],description:'De onde vêm os dados'},
      agrupar_por:{type:'string',enum:['etapa','origem','temperatura','mes','vendedor','situacao','prioridade','cidade','campo'],description:'leads: etapa|origem|temperatura|mes|campo · vendas: vendedor|mes|origem · tarefas: situacao|prioridade · contatos: cidade|mes|campo (campo = um campo extra da empresa, informado em "campo")'},
      campo:str('Nome de um CAMPO EXTRA da empresa (veja ver_campos) para agrupar por ele ou mostrar como coluna na lista — só leads e contatos'),
      medida:{type:'string',enum:['quantidade','valor'],description:'Contar itens ou somar valor (valor só leads/vendas)'},
      filtros:{type:'object',additionalProperties:false,description:'Filtros opcionais',properties:{
        periodo_dias:{type:'integer',minimum:1,maximum:365,description:'Só os criados/vendidos nos últimos N dias'},
        etapa:str('Nome (ou parte) da etapa do funil — leads'),
        origem:str('Origem/campanha (ex.: Instagram, Google) — leads e vendas'),
        temperatura:{type:'string',enum:['quente','morno','frio'],description:'Temperatura do lead'},
        parados_dias:{type:'integer',minimum:1,maximum:365,description:'Leads sem mudar de etapa há N dias ou mais'},
        somente_abertos:{type:'boolean',description:'Leads: só abertos (padrão sim)'},
        situacao:{type:'string',enum:['abertas','vencidas','hoje','concluidas'],description:'Tarefas'},
        cidade:str('Cidade — contatos')}},
      ordenar:{type:'string',enum:['recentes','mais_antigos','maior_valor','parados','prazo','nome'],description:'Ordem da lista'},
      limite:{type:'integer',minimum:1,maximum:100,description:'Máximo de linhas na lista (padrão 30)'}
    },['tipo','fonte'])},
  ver_campos:{description:'Lista os campos extras que a empresa já tem (nome, tipo e se fica no lead ou no contato). Use antes de propor um campo novo e quando perguntarem que informações o CRM guarda.',parameters:obj({})},
  propor_campo:{description:'Propõe criar um CAMPO EXTRA para guardar uma informação que o CRM ainda não tem ("quero guardar o grau do cliente", "anota o convênio", "preciso saber se já fez exame"). Escolha o tipo que combina com a informação. Um gerente/admin confirma antes de criar. Não serve para preencher valor em cliente.',
    parameters:obj({
      nome:str('Nome curto do campo, como aparece na ficha (ex.: "Grau OD", "Convênio", "Já fez exame?")'),
      tipo:{type:'string',enum:['texto','numero','dinheiro','sim_nao','lista','varias_opcoes','data','telefone','email'],description:'texto livre · numero · dinheiro (R$) · sim_nao · lista (uma opção) · varias_opcoes · data · telefone · email'},
      onde:{type:'string',enum:['lead','contato'],description:'lead = muda a cada negócio/atendimento (ex.: produto de interesse) · contato = é da pessoa e vale sempre (ex.: data de nascimento, convênio)'},
      opcoes:{type:'array',items:{type:'string'},description:'Só para lista/varias_opcoes: 2 a 50 opções'}
    },['nome','tipo','onde'])},
  propor_ramo:{description:'Propõe registrar o RAMO da empresa (ex.: "somos uma ótica", "aqui é uma clínica"). Com o ramo, o NEXUS passa a falar com as palavras do negócio (paciente, consulta, exame de vista...). Um gerente/admin confirma.',
    parameters:obj({ramo:{type:'string',enum:['geral','otica','clinica','odontologia','estetica','academia','imobiliaria','varejo'],description:'Ramo que mais combina com a empresa'}},['ramo'])},
  ver_automacoes:{description:'Lista as automações da empresa (o que dispara, a tarefa que criam, o prazo e se estão ligadas).',parameters:obj({})},
  propor_automacao:{description:'Propõe uma AUTOMAÇÃO que cria TAREFA sozinha ("quando alguém faltar, me lembra de remarcar no outro dia", "quando o lead entrar em Proposta, cria retorno em 2 dias", "quando comparecer, pedir avaliação no Google"). O NEXUS NÃO envia mensagem sozinho: se pedirem para "mandar mensagem", a tarefa vira "Mandar mensagem para..." e uma pessoa envia. Gerente/admin confirma e a regra já começa ligada.',
    parameters:obj({
      quando:{type:'string',enum:['entrar_na_etapa','faltou','compareceu'],description:'entrar_na_etapa = lead entrou numa etapa do funil · faltou = falta registrada no agendamento · compareceu = presença registrada'},
      etapa:str('Nome da etapa (só para entrar_na_etapa)'),
      tarefa:str('Título da tarefa que será criada (ex.: "Remarcar exame", "Mandar mensagem pedindo avaliação no Google")'),
      dias:{type:'integer',minimum:0,maximum:30,description:'Prazo da tarefa em dias depois do evento (0 = no mesmo dia)'},
      nome:str('Nome curto da automação (opcional)')
    },['quando','tarefa','dias'])},
  propor_pausar_automacao:{description:'Propõe pausar (desligar) uma automação existente pelo nome. Gerente/admin confirma.',parameters:obj({nome:str('Nome da automação')},['nome'])},
  propor_lead:{description:'Propõe abrir um lead (atendimento) para um contato já cadastrado. A pessoa confirma.',parameters:obj({cliente:str('Nome do contato'),origem:str('Origem (opcional)')},['cliente'])}
};

export const HELP=[
  ['equipe','Configurações › Equipe › "Adicionar pessoa": nome, e-mail, função e senha inicial (gerada sozinha). Só o administrador da empresa vê essa seção. Para tirar alguém, use "Desativar" — o histórico continua.'],
  ['importar planilha contatos','Contatos › "Importar planilha". Salve a planilha como CSV (Excel: Arquivo › Salvar como › CSV). Precisa de uma coluna Nome; WhatsApp, E-mail, Origem e Cidade são opcionais. Mostra uma prévia antes de gravar e não duplica WhatsApp já cadastrado.'],
  ['funil etapas campos obrigatórios','Leads › "Configurar funil" muda as etapas. Configurações › Cadastros do funil › "Campos obrigatórios" define o que o vendedor precisa preencher para mover o lead para cada etapa.'],
  ['novo lead','Leads › "Novo lead": escolha o contato e a origem. O lead entra na primeira etapa do funil.'],
  ['mover etapa','Abra o lead e troque a "Etapa do funil" na ficha, ou arraste o card no Quadro. Se a etapa exigir campos, o sistema pede antes de salvar.'],
  ['venda','Vendas › "Registrar venda": valor (use vírgula para centavos) e o cliente. "Corrigir" ajusta depois; excluir é só para gestor.'],
  ['tarefa retorno','Minhas tarefas › "Adicionar tarefa", ou na ficha do lead › "Criar retorno" (fica vinculada ao cliente).'],
  ['agenda compromisso','Agenda › "Novo compromisso": título, data e hora, tipo, local e cliente. "Reagendar" muda data e hora.'],
  ['whatsapp','A caixa oficial do WhatsApp depende da ativação com a Meta. Enquanto isso, WhatsApp › "Abrir conversa" abre o WhatsApp do seu aparelho com o cliente.'],
  ['excluir corrigir','Contato, lead, venda, tarefa e compromisso podem ser corrigidos. Excluir é só para gestor/administrador e pede confirmação em dois toques.'],
  ['senha','Na tela de login, "Esqueci minha senha".'],
  ['tema escuro','Configurações › Aparência › Claro ou Escuro.']
];
export function helpFor(tema){
  const t=String(tema||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
  const words=t.split(/\W+/).filter(w=>w.length>2);
  const scored=HELP.map(([k,v])=>[words.filter(w=>k.includes(w)||v.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().includes(w)).length,k,v]).filter(x=>x[0]>0).sort((a,b)=>b[0]-a[0]);
  return scored.length?scored.slice(0,3).map(x=>x[2]):HELP.map(x=>x[1]);
}
