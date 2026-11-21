'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {Eye,LayoutGrid,ListChecks,Pin,Save,Sparkles,Store,Workflow} from 'lucide-react';
import {db} from '../lib/supabase';
import {FONTES,LIMITE_MAX} from '../lib/views/spec.mjs';
import {RAMOS} from '../lib/vocabulario.mjs';
import NexusViewCanvas from './NexusViewCanvas';
import NexusAutomations from './NexusAutomations';
import NexusCrmSettings from './NexusCrmSettings';
import ConfirmButton from './ConfirmButton';

// V55 — "Personalizar": tudo o que o Assistente monta também pode ser montado clicando, SEM IA (sem custo).
// Usa a MESMA receita (lib/views/spec.mjs) e as MESMAS APIs (/api/views, /api/crm-settings, /api/automations),
// com as mesmas travas de empresa e papel no servidor.
const ROT={fonte:{leads:'Leads',vendas:'Vendas',tarefas:'Tarefas',contatos:'Contatos',agendamentos:'Agendamentos'},
  tipo:{lista:'Lista',quadro:'Quadro de etapas',grafico:'Gráfico',numero:'Número'},
  estilo:{barras:'Barras',pizza:'Pizza',linha:'Linha (evolução)'},
  agrupar:{etapa:'Etapa',origem:'Origem',temperatura:'Temperatura',mes:'Mês',semana:'Semana',dia_semana:'Dia da semana',tipo:'Tipo',vendedor:'Vendedor',situacao:'Situação',prioridade:'Prioridade',cidade:'Cidade',campo:'Campo extra'},
  ordenar:{recentes:'Mais recentes',mais_antigos:'Mais antigos',maior_valor:'Maior valor',parados:'Parados há mais tempo',prazo:'Prazo',nome:'Nome',proximos:'Próximos primeiro'}};
const SIT={tarefas:['abertas','vencidas','hoje','concluidas'],agendamentos:['agendados','compareceram','faltaram','cancelados']};
const SIT_ROT={abertas:'Abertas',vencidas:'Vencidas',hoje:'De hoje',concluidas:'Concluídas',agendados:'Agendados',compareceram:'Compareceram',faltaram:'Faltaram',cancelados:'Cancelados'};

async function headers(){
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
  return {'Content-Type':'application/json',Authorization:'Bearer '+session.access_token};
}
const inicial={fonte:'leads',tipo:'grafico',estilo:'barras',agrupar_por:'etapa',medida:'quantidade',campo:'',ordenar:'',limite:30,titulo:'',
  filtros:{periodo_dias:'',etapa:'',origem:'',temperatura:'',parados_dias:'',situacao:'',cidade:'',proximos_dias:''}};

function Montador({organizationId,stages,campos,onSalvo}){
  const [r,setR]=useState(inicial);
  const [tela,setTela]=useState(null),[estado,setEstado]=useState(''),[erro,setErro]=useState(''),[fixar,setFixar]=useState(true),[aviso,setAviso]=useState('');
  const cfg=FONTES[r.fonte];
  const set=(k,v)=>{setR(x=>({...x,[k]:v}));setTela(null);setAviso('')};
  const setF=(k,v)=>{setR(x=>({...x,filtros:{...x.filtros,[k]:v}}));setTela(null);setAviso('')};
  useEffect(()=>{ // ao trocar a fonte, volta para opções válidas
    setR(x=>({...x,agrupar_por:FONTES[x.fonte].agrupar.includes(x.agrupar_por)?x.agrupar_por:FONTES[x.fonte].agrupar[0],
      medida:FONTES[x.fonte].medidas.includes(x.medida)?x.medida:'quantidade',ordenar:'',tipo:x.tipo==='quadro'&&x.fonte!=='leads'?'grafico':x.tipo}));
  },[r.fonte]);
  const receita=useMemo(()=>{
    const f={};for(const [k,v] of Object.entries(r.filtros))if(v!==''&&v!=null)f[k]=['periodo_dias','parados_dias','proximos_dias'].includes(k)?Number(v):v;
    return {titulo:r.titulo||undefined,fonte:r.fonte,tipo:r.tipo,...(r.tipo==='grafico'?{estilo:r.estilo}:{}),...(r.tipo!=='numero'?{agrupar_por:r.agrupar_por}:{}),
      medida:r.medida,...(r.campo?{campo:r.campo}:{}),filtros:f,...(r.ordenar?{ordenar:r.ordenar}:{}),limite:Number(r.limite)||30};
  },[r]);
  const chamar=async acao=>{
    const res=await fetch('/api/views',{method:'POST',headers:await headers(),body:JSON.stringify({org_id:organizationId,acao,spec:receita,nome:r.titulo})});
    const json=await res.json().catch(()=>null);if(!res.ok)throw new Error(json?.error||'Não deu certo.');return json;
  };
  const previa=async()=>{setEstado('carregando');setErro('');try{setTela((await chamar('abrir')).tela)}catch(e){setErro(e.message)}finally{setEstado('')}};
  const salvar=async()=>{
    setEstado('salvando');setErro('');
    try{
      const s=await chamar('salvar');
      let msg='Tela salva em "Minhas telas".';
      if(fixar){const res=await fetch('/api/views',{method:'POST',headers:await headers(),body:JSON.stringify({org_id:organizationId,acao:'fixar',id:s.tela.id,inicio:true})});const j=await res.json().catch(()=>null);msg=res.ok?'Tela salva e fixada na Visão geral.':msg+' '+(j?.error||'')}
      setAviso(msg);setEstado('salvo');onSalvo?.();
    }catch(e){setErro(e.message);setEstado('')}
  };
  const camposDaFonte=campos.filter(c=>r.fonte==='contatos'?c.entity_type==='contact':true);
  const agruparOpcoes=cfg.agrupar.filter(a=>a!=='campo'||camposDaFonte.length);
  return <div className="nx-pz-builder">
    <form className="nx-pz-form" onSubmit={e=>{e.preventDefault();previa()}}>
      <fieldset><legend>1. O que mostrar</legend>
        <label>Dados de<select value={r.fonte} onChange={e=>set('fonte',e.target.value)}>{Object.keys(FONTES).map(k=><option key={k} value={k}>{ROT.fonte[k]}</option>)}</select></label>
        <div className="nx-pz-seg" role="radiogroup" aria-label="Formato">{Object.keys(ROT.tipo).filter(t=>t!=='quadro'||r.fonte==='leads').map(t=><button type="button" key={t} role="radio" aria-checked={r.tipo===t} onClick={()=>set('tipo',t)}>{ROT.tipo[t]}</button>)}</div>
        {r.tipo==='grafico'&&<div className="nx-pz-seg" role="radiogroup" aria-label="Estilo do gráfico">{Object.keys(ROT.estilo).map(t=><button type="button" key={t} role="radio" aria-checked={r.estilo===t} onClick={()=>set('estilo',t)}>{ROT.estilo[t]}</button>)}</div>}
        {r.tipo!=='numero'&&<label>Agrupar por<select value={r.agrupar_por} onChange={e=>set('agrupar_por',e.target.value)}>{agruparOpcoes.map(a=><option key={a} value={a}>{ROT.agrupar[a]}</option>)}</select></label>}
        {(r.agrupar_por==='campo'||r.tipo==='lista')&&camposDaFonte.length>0&&(r.fonte==='leads'||r.fonte==='contatos')&&<label>{r.agrupar_por==='campo'?'Campo extra':'Coluna extra (opcional)'}<select value={r.campo} required={r.agrupar_por==='campo'} onChange={e=>set('campo',e.target.value)}><option value="">{r.agrupar_por==='campo'?'Escolha…':'Nenhuma'}</option>{camposDaFonte.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}</select></label>}
        {cfg.medidas.length>1&&<label>Medir por<select value={r.medida} onChange={e=>set('medida',e.target.value)}><option value="quantidade">Quantidade</option><option value="valor">Valor (R$)</option></select></label>}
      </fieldset>
      <fieldset><legend>2. Filtros (opcional)</legend>
        <label>Criados nos últimos<select value={r.filtros.periodo_dias} onChange={e=>setF('periodo_dias',e.target.value)}><option value="">Qualquer data</option>{[7,15,30,60,90,180,365].map(d=><option key={d} value={d}>{d} dias</option>)}</select></label>
        {r.fonte==='leads'&&<>
          <label>Etapa<select value={r.filtros.etapa} onChange={e=>setF('etapa',e.target.value)}><option value="">Todas</option>{[...new Set(stages.map(s=>s.name))].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
          <label>Temperatura<select value={r.filtros.temperatura} onChange={e=>setF('temperatura',e.target.value)}><option value="">Todas</option><option value="quente">Quente</option><option value="morno">Morno</option><option value="frio">Frio</option></select></label>
          <label>Parados há pelo menos<select value={r.filtros.parados_dias} onChange={e=>setF('parados_dias',e.target.value)}><option value="">—</option>{[1,3,7,15,30].map(d=><option key={d} value={d}>{d} dia(s)</option>)}</select></label>
        </>}
        {(r.fonte==='leads'||r.fonte==='vendas')&&<label>Origem contém<input value={r.filtros.origem} maxLength={60} placeholder="Ex.: Instagram" onChange={e=>setF('origem',e.target.value)}/></label>}
        {SIT[r.fonte]&&<label>Situação<select value={r.filtros.situacao} onChange={e=>setF('situacao',e.target.value)}><option value="">{r.fonte==='tarefas'?'Abertas':'Todas'}</option>{SIT[r.fonte].map(s=><option key={s} value={s}>{SIT_ROT[s]}</option>)}</select></label>}
        {r.fonte==='agendamentos'&&<label>Próximos<select value={r.filtros.proximos_dias} onChange={e=>setF('proximos_dias',e.target.value)}><option value="">—</option>{[1,7,15,30].map(d=><option key={d} value={d}>{d} dia(s)</option>)}</select></label>}
        {r.fonte==='contatos'&&<label>Cidade contém<input value={r.filtros.cidade} maxLength={60} onChange={e=>setF('cidade',e.target.value)}/></label>}
      </fieldset>
      <fieldset><legend>3. Nome e ordem</legend>
        <label>Título da tela<input value={r.titulo} maxLength={80} placeholder="Ex.: Exames da semana" onChange={e=>set('titulo',e.target.value)}/></label>
        {r.tipo==='lista'&&<><label>Ordenar<select value={r.ordenar} onChange={e=>set('ordenar',e.target.value)}><option value="">Padrão</option>{cfg.ordenar.map(o=><option key={o} value={o}>{ROT.ordenar[o]}</option>)}</select></label>
          <label>Até quantas linhas<select value={r.limite} onChange={e=>set('limite',e.target.value)}>{[10,30,50,LIMITE_MAX].map(n=><option key={n} value={n}>{n}</option>)}</select></label></>}
      </fieldset>
      <div className="nx-pz-actions">
        <button type="submit" className="fx-btn" disabled={estado==='carregando'}><Eye size={15}/> {estado==='carregando'?'Montando…':'Ver prévia'}</button>
        <label className="nx-pz-check"><input type="checkbox" checked={fixar} onChange={e=>setFixar(e.target.checked)}/> Fixar na Visão geral</label>
        <button type="button" className="fx-btn fx-btn--primary" onClick={salvar} disabled={estado==='salvando'||estado==='salvo'}><Save size={15}/> {estado==='salvando'?'Salvando…':estado==='salvo'?'Salva':'Salvar tela'}</button>
      </div>
      {erro&&<p className="nx-view-warn is-error" role="alert">{erro}</p>}
      {aviso&&<p className="nx-view-warn" role="status">{aviso}</p>}
      <p className="nx-pz-free">Montar por aqui não usa IA: não tem custo. Prefere pedir em português? Use o <Sparkles size={13} aria-hidden="true"/> Assistente.</p>
    </form>
    <div className="nx-pz-preview" aria-live="polite">{tela?<NexusViewCanvas tela={tela} estado={estado==='carregando'?'carregando':''}/>
      :<div className="nx-pz-empty"><LayoutGrid size={22} aria-hidden="true"/><p>Escolha as opções e clique em <b>Ver prévia</b>. A tela aparece aqui com os dados de agora.</p></div>}</div>
  </div>;
}

function MinhasTelas({organizationId,versao}){
  const [lista,setLista]=useState(null),[erro,setErro]=useState(''),[aberta,setAberta]=useState(null);
  const carregar=useCallback(async()=>{try{const res=await fetch('/api/views?org_id='+encodeURIComponent(organizationId),{headers:await headers()});const j=await res.json().catch(()=>null);if(!res.ok)throw new Error(j?.error||'Não consegui carregar.');setLista(j.telas||[]);setErro(j.indisponivel?j.aviso:'')}catch(e){setErro(e.message);setLista([])}},[organizationId]);
  useEffect(()=>{carregar()},[carregar,versao]);
  const post=async body=>{const res=await fetch('/api/views',{method:'POST',headers:await headers(),body:JSON.stringify({org_id:organizationId,...body})});const j=await res.json().catch(()=>null);if(!res.ok)throw new Error(j?.error||'Não deu certo.');return j};
  const fixar=async t=>{try{await post({acao:'fixar',id:t.id,inicio:!t.inicio});carregar()}catch(e){setErro(e.message)}};
  const apagar=async t=>{try{const res=await fetch('/api/views?org_id='+encodeURIComponent(organizationId)+'&id='+t.id,{method:'DELETE',headers:await headers()});if(!res.ok)throw new Error('Não consegui apagar.');setAberta(null);carregar()}catch(e){setErro(e.message)}};
  const abrir=async t=>{setAberta({...t,tela:null});try{const j=await post({acao:'abrir',spec:t.spec});setAberta({...t,tela:{...j.tela,titulo:t.nome}})}catch(e){setErro(e.message)}};
  if(!lista)return <p className="nx-view-empty">Carregando…</p>;
  return <div className="nx-pz-mine">
    {erro&&<p className="nx-view-warn" role="status">{erro}</p>}
    {!lista.length&&<p className="nx-view-empty">Nenhuma tela salva ainda. Monte a primeira no formulário.</p>}
    <ul>{lista.map(t=><li key={t.id} className={aberta?.id===t.id?'is-open':''}>
      <button type="button" className="nx-pz-mine-name" onClick={()=>abrir(t)}><LayoutGrid size={14}/>{t.nome}</button>
      <button type="button" className="nx-ai-pin" aria-pressed={t.inicio===true} onClick={()=>fixar(t)}><Pin size={13}/>{t.inicio?'Na inicial':'Fixar'}</button>
      <ConfirmButton onConfirm={()=>apagar(t)} label="Apagar" confirmLabel="Confirmar" className="fx-btn nx-view-delete"/>
    </li>)}</ul>
    {aberta&&(aberta.tela?<NexusViewCanvas tela={aberta.tela}/>:<p className="nx-view-empty">Abrindo…</p>)}
  </div>;
}

function Ramo({organizationId}){
  const [atual,setAtual]=useState(''),[escolha,setEscolha]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{(async()=>{try{const res=await fetch('/api/views?org_id='+encodeURIComponent(organizationId),{headers:await headers()});const j=await res.json();setAtual(j?.vocab?.ramo||'geral');setEscolha(j?.vocab?.ramo||'geral')}catch{}})()},[organizationId]);
  const salvar=async()=>{setBusy(true);setMsg('');try{const res=await fetch('/api/crm-settings',{method:'POST',headers:await headers(),body:JSON.stringify({org_id:organizationId,action:'segment_save',ramo:escolha})});const j=await res.json().catch(()=>null);if(!res.ok)throw new Error(j?.error||'Não consegui salvar.');setAtual(escolha);setMsg(j.message)}catch(e){setMsg(e.message)}finally{setBusy(false)}};
  const v=RAMOS[escolha]||RAMOS.geral;
  return <div className="nx-pz-ramo">
    <p>O ramo muda as palavras que o NEXUS usa no Assistente e nas sugestões.</p>
    <div className="nx-pz-ramos" role="radiogroup" aria-label="Ramo da empresa">{Object.entries(RAMOS).map(([k,x])=><button type="button" key={k} role="radio" aria-checked={escolha===k} onClick={()=>setEscolha(k)}>{x.rotulo}</button>)}</div>
    <p className="nx-pz-ramo-ex">Vai falar: <b>{v.clientes}</b> · <b>{v.agendamentos}</b> · <b>{v.vendas}</b></p>
    <button type="button" className="fx-btn fx-btn--primary" onClick={salvar} disabled={busy||escolha===atual}>{busy?'Salvando…':'Salvar ramo'}</button>
    {msg&&<p className="nx-view-warn" role="status">{msg}</p>}
  </div>;
}

export default function NexusPersonalizar({organizationId,stages=[],canManage=false,readonly=false}){
  const [aba,setAba]=useState('telas'),[campos,setCampos]=useState([]),[versao,setVersao]=useState(0);
  useEffect(()=>{if(!organizationId)return;(async()=>{try{const res=await fetch('/api/crm-settings?org_id='+encodeURIComponent(organizationId),{headers:await headers()});const j=await res.json().catch(()=>null);if(res.ok)setCampos(j?.fields||[])}catch{}})()},[organizationId,aba]);
  const abas=[['telas','Telas',LayoutGrid],...(canManage?[['campos','Campos extras',ListChecks],['automacoes','Automações',Workflow],['ramo','Ramo',Store]]:[])];
  return <div className="fx-page nx-pz">
    <header className="fx-pagehead"><div className="fx-pagehead-title"><h1>Personalizar</h1><span className="fx-count">sem IA, sem custo</span></div></header>
    <nav className="nx-pz-tabs" role="tablist" aria-label="O que personalizar">{abas.map(([k,l,I])=><button key={k} type="button" role="tab" aria-selected={aba===k} onClick={()=>setAba(k)}><I size={15}/> {l}</button>)}</nav>
    {aba==='telas'&&<div className="nx-pz-telas"><Montador organizationId={organizationId} stages={stages} campos={campos} onSalvo={()=>setVersao(v=>v+1)}/>
      <aside className="fx-box nx-pz-side"><div className="fx-boxhead"><h2>Minhas telas</h2></div><MinhasTelas organizationId={organizationId} versao={versao}/></aside></div>}
    {aba==='campos'&&canManage&&<NexusCrmSettings organizationId={organizationId} initialTab="fields"/>}
    {aba==='automacoes'&&canManage&&<NexusAutomations organizationId={organizationId} stages={stages} readonly={readonly}/>}
    {aba==='ramo'&&canManage&&<section className="fx-box"><div className="fx-boxhead"><h2>Ramo da empresa</h2></div><Ramo organizationId={organizationId}/></section>}
  </div>;
}
