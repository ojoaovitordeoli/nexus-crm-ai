'use client';
import {useEffect,useMemo,useState} from 'react';
import {Command} from 'cmdk';
import {
 Activity,ArrowRight,BriefcaseBusiness,CalendarDays,ContactRound,
 LayoutDashboard,ListTodo,MessageCircle,Moon,RefreshCw,Search,
 Settings2,ShieldCheck,Sun,UsersRound,Play,Wallet,Zap
} from 'lucide-react';

const routes=[
  ['dashboard','Visão geral',LayoutDashboard,'Abrir o dashboard','painel indicadores'],
  ['leads','Leads e oportunidades',UsersRound,'Acompanhar o funil de atendimento','kanban comercial'],
  ['contacts','Contatos',ContactRound,'Consultar base de pessoas','clientes'],
  ['tasks','Minhas tarefas',ListTodo,'Organizar prioridades','atividades'],
  ['agenda','Agenda',CalendarDays,'Compromissos e agendamentos','reuniões calendário'],
  ['whatsapp','WhatsApp',MessageCircle,'Central de atendimento e conexão','mensagens'],
  ['reports','Relatórios',Activity,'Análises e exportação CSV','dados vendas'],
  ['settings','Configurações',Settings2,'Preferências e permissões','personalização'],
  ['minha-area','Meu perfil',BriefcaseBusiness,'Informações da minha conta','perfil usuário']
];
const fullName=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ')||'Contato sem nome';

export default function NexusCommandMenu({
  open,onOpenChange,onNavigate,onRefresh,onTheme,dark,
  isSuperAdmin=false,onReplay,leads=[],contacts=[],tasks=[]
}){
  const [text,setText]=useState('');
  useEffect(()=>{if(!open)setText('')},[open]);
  useEffect(()=>{
    const down=e=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown',down);
    return ()=>window.removeEventListener('keydown',down);
  },[onOpenChange,open]);
  const matches=useMemo(()=>{
    const q=text.trim().toLocaleLowerCase('pt-BR');
    if(q.length<2)return [];
    return [
      ...leads.filter(l=>[fullName(l.contact),l.contact?.whatsapp,l.source].join(' ').toLocaleLowerCase('pt-BR').includes(q))
        .slice(0,4).map(l=>({id:'lead-'+l.id,title:fullName(l.contact),detail:'Lead · '+(l.source||'Sem origem'),route:'leads',query:fullName(l.contact),Icon:UsersRound})),
      ...contacts.filter(c=>[fullName(c),c.whatsapp].join(' ').toLocaleLowerCase('pt-BR').includes(q))
        .slice(0,4).map(c=>({id:'contact-'+c.id,title:fullName(c),detail:'Contato · '+(c.whatsapp||'Sem telefone'),route:'contacts',query:fullName(c),Icon:ContactRound})),
      ...tasks.filter(t=>(t.title||'').toLocaleLowerCase('pt-BR').includes(q))
        .slice(0,4).map(t=>({id:'task-'+t.id,title:t.title,detail:'Tarefa',route:'tasks',query:t.title,Icon:ListTodo}))
    ].slice(0,10);
  },[text,leads,contacts,tasks]);
  const select=(route,query)=>{
    onOpenChange(false);
    onNavigate(route,query);
  };
  return <Command.Dialog
    open={open} onOpenChange={onOpenChange}
    label="Comandos rápidos do NEXUS CRM"
    className="nexus-command-dialog" overlayClassName="nexus-command-overlay"
    shouldFilter={false}>
    <div className="nexus-command-input-wrap">
      <Search size={19} strokeWidth={2}/>
      <Command.Input value={text} onValueChange={setText}
        placeholder="O que você deseja encontrar ou fazer?"
        aria-label="Pesquisar comandos, contatos e tarefas"/>
      <span className="nexus-command-esc">ESC</span>
    </div>
    <Command.List className="nexus-command-list">
      <Command.Empty className="nexus-command-empty">
        Nenhum comando ou contato encontrado nos registros carregados.
      </Command.Empty>
      {matches.length>0&&<Command.Group heading="RESULTADOS DA EMPRESA">
        {matches.map(({id,title,detail,route,query,Icon})=>
          <Command.Item key={id} value={id} onSelect={()=>select(route,query)}>
            <span className="nexus-command-item-icon"><Icon size={18}/></span>
            <span className="nexus-command-item-copy"><strong>{title}</strong><small>{detail}</small></span>
            <ArrowRight size={16} className="nexus-command-arrow"/>
          </Command.Item>)}
      </Command.Group>}
      <Command.Group heading="NAVEGAÇÃO">
        {routes.filter(([path,title,,description,keywords])=>
          !text||[title,description,keywords].join(' ').toLocaleLowerCase('pt-BR').includes(text.toLocaleLowerCase('pt-BR')))
          .map(([path,title,Icon,description])=>
            <Command.Item key={'route-'+path} value={'route-'+path} onSelect={()=>select(path)}>
              <span className="nexus-command-item-icon"><Icon size={18}/></span>
              <span className="nexus-command-item-copy"><strong>{title}</strong><small>{description}</small></span>
              <ArrowRight size={16} className="nexus-command-arrow"/>
            </Command.Item>)}
        {isSuperAdmin&&(!text||'super admin administração empresas usuários'.includes(text.toLocaleLowerCase('pt-BR')))&&
          <Command.Item value="route-admin" onSelect={()=>select('admin')}>
            <span className="nexus-command-item-icon"><ShieldCheck size={18}/></span>
            <span className="nexus-command-item-copy"><strong>Super Admin</strong><small>Gerenciar empresas, usuários e acessos</small></span>
            <ArrowRight size={16} className="nexus-command-arrow"/>
          </Command.Item>}
      </Command.Group>
      <Command.Group heading="AÇÕES">
        {(!text||'atualizar sincronizar dados'.includes(text.toLocaleLowerCase('pt-BR')))&&
          <Command.Item value="action-refresh" onSelect={()=>{onOpenChange(false);onRefresh()}}>
            <span className="nexus-command-item-icon"><RefreshCw size={18}/></span>
            <span className="nexus-command-item-copy"><strong>Atualizar dados</strong><small>Recarregar dados da empresa selecionada</small></span>
            <ArrowRight size={16} className="nexus-command-arrow"/>
          </Command.Item>}
        {(!text||'tema aparência claro escuro'.includes(text.toLocaleLowerCase('pt-BR')))&&
          <Command.Item value="action-theme" onSelect={()=>{onOpenChange(false);onTheme()}}>
            <span className="nexus-command-item-icon">{dark?<Sun size={18}/>:<Moon size={18}/>}</span>
            <span className="nexus-command-item-copy"><strong>{dark?'Ativar modo claro':'Ativar modo escuro'}</strong><small>Alterar aparência do painel</small></span>
            <ArrowRight size={16} className="nexus-command-arrow"/>
          </Command.Item>}
        {(!text||'rever efeitos animações replay dashboard'.includes(text.toLocaleLowerCase('pt-BR')))&&
          <Command.Item value="action-motion" onSelect={()=>{onOpenChange(false);onReplay()}}>
            <span className="nexus-command-item-icon"><Play size={18}/></span>
            <span className="nexus-command-item-copy"><strong>Rever efeitos</strong><small>Reproduzir a sequência do dashboard</small></span>
            <ArrowRight size={16} className="nexus-command-arrow"/>
          </Command.Item>}
      </Command.Group>
    </Command.List>
    <footer className="nexus-command-footer">
      <span><kbd>↑</kbd><kbd>↓</kbd> Navegar</span>
      <span><kbd>↵</kbd> Abrir</span>
      <span><kbd>ESC</kbd> Fechar</span>
      <strong>NEXUS / COMMAND CENTER</strong>
    </footer>
  </Command.Dialog>;
}
