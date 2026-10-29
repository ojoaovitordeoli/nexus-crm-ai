'use client';

import {useEffect,useMemo,useState} from 'react';
import {Command} from 'cmdk';
import {
  Activity,ArrowRight,BriefcaseBusiness,CalendarDays,CheckCircle2,
  ContactRound,CornerDownLeft,LayoutDashboard,ListTodo,MessageCircle,
  Moon,Play,Plus,RefreshCw,Search,Settings2,ShieldCheck,
  Sparkles,Sun,UsersRound,Workflow,X,Zap
} from 'lucide-react';

const destinations=[
  {path:'dashboard',title:'Visão geral',description:'Indicadores e desempenho da operação',keywords:'dashboard resumo resultados',Icon:LayoutDashboard},
  {path:'leads',title:'Leads e funil',description:'Negociações, etapas e oportunidades',keywords:'leads kanban pipeline clientes',Icon:UsersRound},
  {path:'contacts',title:'Contatos',description:'Pessoas e números de telefone',keywords:'contatos pessoas telefone',Icon:ContactRound},
  {path:'whatsapp',title:'WhatsApp Business',description:'Conversas e canais da empresa',keywords:'mensagens atendimento',Icon:MessageCircle},
  {path:'automations',title:'Automações',description:'Regras de follow-up',keywords:'rotina fluxo gatilho tarefa',Icon:Workflow},
  {path:'insights',title:'Copiloto IA',description:'Analisar indicadores da operação',keywords:'copiloto inteligência artificial análise',Icon:Sparkles},
  {path:'agenda',title:'Agenda',description:'Compromissos e reuniões',keywords:'calendário compromissos reunião',Icon:CalendarDays},
  {path:'tasks',title:'Minhas tarefas',description:'Prazos e prioridades',keywords:'atividades tarefas produtividade',Icon:ListTodo},
  {path:'reports',title:'Relatórios',description:'Resultados e exportação CSV',keywords:'analytics gráficos exportar',Icon:Activity},
  {path:'settings',title:'Configurações',description:'Preferências e permissões',keywords:'configuração tema aparência',Icon:Settings2},
  {path:'minha-area',title:'Meu perfil',description:'Informações da minha conta',keywords:'usuário conta meu espaço',Icon:BriefcaseBusiness}
];
const simplify=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
const who=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'Contato sem nome';

function Item({id,title,description,Icon,onSelect,accent=false}){
  return <Command.Item value={id} onSelect={onSelect} className={'nexus-command-item '+(accent?'nexus-command-item--accent':'')}>
    <span className="nexus-command-item-icon"><Icon size={18} strokeWidth={1.9}/></span>
    <span className="nexus-command-item-copy"><strong>{title}</strong><small>{description}</small></span>
    <ArrowRight size={16} className="nexus-command-arrow" aria-hidden="true"/>
  </Command.Item>;
}
export default function NexusCommandMenu({
  open,onOpenChange,onNavigate,onRefresh,onTheme,dark,
  isSuperAdmin=false,onReplay,leads=[],contacts=[],tasks=[]
}){
  const [term,setTerm]=useState('');
  useEffect(()=>{if(!open)setTerm('')},[open]);
  useEffect(()=>{
    const listener=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
        e.preventDefault();onOpenChange(!open);
      }
    };
    window.addEventListener('keydown',listener);
    return ()=>window.removeEventListener('keydown',listener);
  },[open,onOpenChange]);
  const query=simplify(term.trim());
  const records=useMemo(()=>{
    if(query.length<2)return [];
    return [
      ...leads.filter(l=>simplify([who(l.contact),l.contact?.whatsapp,l.source].join(' ')).includes(query))
        .slice(0,5).map(l=>({id:'lead-'+l.id,title:who(l.contact),description:'Lead · '+(l.source||'Sem origem'),path:'leads',search:who(l.contact),Icon:UsersRound})),
      ...contacts.filter(c=>simplify([who(c),c.whatsapp].join(' ')).includes(query))
        .slice(0,5).map(c=>({id:'contact-'+c.id,title:who(c),description:'Contato · '+(c.whatsapp||'Sem telefone'),path:'contacts',search:who(c),Icon:ContactRound})),
      ...tasks.filter(t=>simplify(t.title).includes(query))
        .slice(0,5).map(t=>({id:'task-'+t.id,title:t.title||'Tarefa',description:'Tarefa cadastrada',path:'tasks',search:t.title,Icon:ListTodo}))
    ].slice(0,12);
  },[query,leads,contacts,tasks]);
  const places=destinations.filter(d=>!query||simplify(d.title+' '+d.description+' '+d.keywords).includes(query));
  const adminVisible=isSuperAdmin&&(!query||simplify('super admin administração empresas usuários').includes(query));
  const extras=[
    {id:'create-task',title:'Criar nova tarefa',description:'Abrir o formulário de tarefas',Icon:Plus,keywords:'criar tarefa adicionar nova atividade',run:()=>{onOpenChange(false);onNavigate('tasks','', 'new')}},
    {id:'refresh',title:'Atualizar dados',description:'Recarregar os registros da empresa',Icon:RefreshCw,keywords:'atualizar sincronizar dados recarregar',run:()=>{onOpenChange(false);onRefresh()}},
    {id:'theme',title:dark?'Ativar modo claro':'Ativar modo escuro',description:'Mudar aparência do CRM',Icon:dark?Sun:Moon,keywords:'tema aparência claro escuro',run:()=>{onOpenChange(false);onTheme()}},
    {id:'motion',title:'Rever apresentação',description:'Reproduzir a entrada animada do Dashboard',Icon:Play,keywords:'animações replay efeitos apresentação',run:()=>{onOpenChange(false);onReplay()}}
  ].filter(item=>!query||simplify(item.title+' '+item.description+' '+item.keywords).includes(query));
  const hasResults=records.length+places.length+extras.length+(adminVisible?1:0)>0;
  const go=(path,search)=>{onOpenChange(false);onNavigate(path,search)};

  return <Command.Dialog
    open={open}
    onOpenChange={onOpenChange}
    label="Central de Comandos NEXUS"
    className="nexus-command-dialog"
    overlayClassName="nexus-command-overlay"
    shouldFilter={false}
    loop>
    <header className="nexus-command-heading">
      <span className="nexus-command-brand"><Zap size={15} fill="currentColor"/> NEXUS / COMMAND CENTER</span>
      <button type="button" aria-label="Fechar comandos" onClick={()=>onOpenChange(false)} className="nexus-command-close"><X size={17}/></button>
    </header>
    <div className="nexus-command-input-wrap">
      <Search size={20} strokeWidth={1.9} aria-hidden="true"/>
      <Command.Input
        autoFocus
        value={term}
        onValueChange={setTerm}
        placeholder="Buscar uma pessoa, tarefa ou ação..."
        aria-label="Buscar na Central de Comandos"/>
      <kbd className="nexus-command-esc">ESC</kbd>
    </div>
    <Command.List className="nexus-command-list">
      {records.length>0&&<Command.Group heading="REGISTROS DA EMPRESA">
        {records.map(r=><Item key={r.id} {...r} onSelect={()=>go(r.path,r.search)}/>)}
      </Command.Group>}
      {places.length>0&&<Command.Group heading="IR PARA">
        {places.map(d=><Item key={d.path} id={'route-'+d.path} title={d.title} description={d.description} Icon={d.Icon} onSelect={()=>go(d.path)}/>)}
        {adminVisible&&<Item id="route-admin" title="Super Admin" description="Empresas, usuários e acessos" Icon={ShieldCheck} onSelect={()=>go('admin')}/>}
      </Command.Group>}
      {adminVisible&&places.length===0&&<Command.Group heading="ADMINISTRAÇÃO">
        <Item id="route-admin" title="Super Admin" description="Empresas, usuários e acessos" Icon={ShieldCheck} onSelect={()=>go('admin')}/>
      </Command.Group>}
      {extras.length>0&&<Command.Group heading="AÇÕES RÁPIDAS">
        {extras.map(a=><Item key={a.id} {...a} onSelect={a.run} accent={a.id==='create-task'}/>)}
      </Command.Group>}
      {!hasResults&&<div className="nexus-command-empty">
        <Search size={24}/><strong>Nada encontrado</strong>
        <span>Experimente pesquisar pelo nome, telefone ou outra ação.</span>
      </div>}
    </Command.List>
    <footer className="nexus-command-footer">
      <span><kbd>↑</kbd><kbd>↓</kbd> Navegar</span>
      <span><kbd>↵</kbd> Abrir</span>
      <span><kbd>ESC</kbd> Fechar</span>
      <strong>CTRL / ⌘ + K</strong>
    </footer>
  </Command.Dialog>;
}
