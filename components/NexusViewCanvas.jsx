'use client';
import {Bookmark,BookmarkCheck,RefreshCw} from 'lucide-react';
import ConfirmButton from './ConfirmButton';

// V51 — desenha uma tela montada pelo assistente (lista, quadro de etapas, gráfico de barras ou número).
// Só desenha o que o servidor devolveu; não busca nada sozinho.
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(Number(v)||0);
const num=v=>new Intl.NumberFormat('pt-BR').format(Number(v)||0);
const usaValor=t=>t?.spec?.medida==='valor';
const COLUNAS_DINHEIRO=new Set(['Valor']);

function Numero({tela}){
  const t=tela.total||{quantidade:0,valor:0};
  return <div className="nx-view-number">
    <strong>{usaValor(tela)?brl(t.valor):num(t.quantidade)}</strong>
    <span>{usaValor(tela)?num(t.quantidade)+' '+(t.quantidade===1?'registro':'registros'):(t.valor?'somando '+brl(t.valor):'')}</span>
  </div>;
}

function Grafico({tela}){
  const grupos=tela.grupos||[];
  const chave=usaValor(tela)?'valor':'quantidade';
  const max=Math.max(1,...grupos.map(g=>g[chave]));
  return <ul className="nx-view-bars" aria-label={tela.titulo}>
    {grupos.slice(0,20).map(g=><li key={g.grupo}>
      <span className="nx-view-bars-label" title={g.grupo}>{g.grupo}</span>
      <span className="nx-view-bars-track" aria-hidden="true"><span style={{width:Math.max(2,Math.round(g[chave]/max*100))+'%'}}/></span>
      <span className="nx-view-bars-value">{usaValor(tela)?brl(g.valor):num(g.quantidade)}{usaValor(tela)&&<small> · {num(g.quantidade)}</small>}</span>
    </li>)}
    {grupos.length>20&&<li className="nx-view-more">+ {grupos.length-20} grupos</li>}
  </ul>;
}

// V55 — pizza (rosca) e linha. O número de cada grupo fica sempre escrito ao lado: não depende só da cor.
const CORES=6;
function Pizza({tela}){
  const chave=usaValor(tela)?'valor':'quantidade';
  let grupos=(tela.grupos||[]).filter(g=>g[chave]>0);
  if(grupos.length>CORES){const resto=grupos.slice(CORES-1);grupos=[...grupos.slice(0,CORES-1),{grupo:'Outros ('+resto.length+')',quantidade:resto.reduce((s,g)=>s+g.quantidade,0),valor:resto.reduce((s,g)=>s+g.valor,0)}]}
  const total=grupos.reduce((s,g)=>s+g[chave],0)||1;
  let acum=0;
  const fmt=g=>usaValor(tela)?brl(g.valor):num(g.quantidade);
  return <div className="nx-view-pie">
    <svg viewBox="0 0 120 120" role="img" aria-label={tela.titulo+': '+grupos.map(g=>g.grupo+' '+fmt(g)).join(', ')}>
      <circle cx="60" cy="60" r="44" fill="none" className="nx-view-pie-bg" strokeWidth="18"/>
      {grupos.map((g,i)=>{const p=g[chave]/total*100;const el=<circle key={g.grupo} cx="60" cy="60" r="44" fill="none" pathLength="100" strokeWidth="18"
        className={'nx-cat-'+(i+1)} strokeDasharray={Math.max(0,p-0.6)+' '+(100-Math.max(0,p-0.6))} strokeDashoffset={-acum} transform="rotate(-90 60 60)"/>;acum+=p;return el})}
      <text x="60" y="57" textAnchor="middle" className="nx-view-pie-total">{usaValor(tela)?brl(total):num(total)}</text>
      <text x="60" y="72" textAnchor="middle" className="nx-view-pie-sub">total</text>
    </svg>
    <ul>{grupos.map((g,i)=><li key={g.grupo}><span className={'nx-view-dot nx-cat-bg-'+(i+1)} aria-hidden="true"/><span className="nx-view-pie-label">{g.grupo}</span><b>{fmt(g)}</b><small>{Math.round(g[chave]/total*100)}%</small></li>)}</ul>
  </div>;
}
function Linha({tela}){
  const chave=usaValor(tela)?'valor':'quantidade';
  const grupos=(tela.grupos||[]).slice(-24);
  const W=320,H=120,P=8,max=Math.max(1,...grupos.map(g=>g[chave]));
  const x=i=>grupos.length<2?W/2:P+i*(W-2*P)/(grupos.length-1);
  const y=v=>H-P-(v/max)*(H-2*P);
  const pts=grupos.map((g,i)=>x(i)+','+y(g[chave])).join(' ');
  const fmt=g=>usaValor(tela)?brl(g.valor):num(g.quantidade);
  return <div className="nx-view-line">
    <svg viewBox={'0 0 '+W+' '+(H+18)} preserveAspectRatio="none" role="img" aria-label={tela.titulo+': '+grupos.map(g=>g.grupo+' '+fmt(g)).join(', ')}>
      <line x1={P} x2={W-P} y1={H-P} y2={H-P} className="nx-view-line-axis"/>
      <polyline points={pts} fill="none" className="nx-view-line-path"/>
      {grupos.map((g,i)=><circle key={g.grupo} cx={x(i)} cy={y(g[chave])} r="3" className="nx-view-line-dot"><title>{g.grupo+': '+fmt(g)}</title></circle>)}
      {grupos.map((g,i)=>(grupos.length<=8||i%Math.ceil(grupos.length/8)===0||i===grupos.length-1)&&<text key={'t'+g.grupo} x={x(i)} y={H+12} textAnchor="middle" className="nx-view-line-label">{g.grupo}</text>)}
    </svg>
    <p className="nx-view-line-sum">Maior: <b>{fmt(grupos.reduce((a,g)=>g[chave]>a[chave]?g:a,grupos[0]||{quantidade:0,valor:0}))}</b> · Último: <b>{grupos.length?fmt(grupos[grupos.length-1]):'—'}</b></p>
  </div>;
}

function Quadro({tela}){
  return <div className="nx-view-board" role="list" aria-label={tela.titulo}>
    {(tela.grupos||[]).map(g=><section key={g.grupo} className="nx-view-col" role="listitem" aria-label={g.grupo+': '+g.quantidade}>
      <header><strong>{g.grupo}</strong><span>{num(g.quantidade)}{g.valor?' · '+brl(g.valor):''}</span></header>
      <ol>
        {g.itens.map(i=><li key={i.id}>
          <b>{i.titulo}</b>
          {i.detalhe&&<small>{i.detalhe}</small>}
          <span>{i.valor?brl(i.valor):''}{i.extra&&<em>{i.extra}</em>}</span>
        </li>)}
        {!g.quantidade&&<li className="nx-view-more">Nenhum lead aqui</li>}
        {g.quantidade>g.itens.length&&<li className="nx-view-more">+ {num(g.quantidade-g.itens.length)} neste grupo</li>}
      </ol>
    </section>)}
  </div>;
}

function Lista({tela}){
  const cols=tela.colunas||[];
  return <div className="nx-view-table-wrap">
    <table className="nx-view-table">
      <thead><tr>{cols.map(c=><th key={c} scope="col" className={COLUNAS_DINHEIRO.has(c)?'is-num':''}>{c}</th>)}</tr></thead>
      <tbody>{(tela.linhas||[]).map((l,i)=><tr key={i}>{l.map((v,j)=><td key={j} className={COLUNAS_DINHEIRO.has(cols[j])?'is-num':''}>{COLUNAS_DINHEIRO.has(cols[j])?brl(v):v}</td>)}</tr>)}</tbody>
    </table>
    {tela.quantidade>(tela.linhas||[]).length&&<p className="nx-view-more">Mostrando {num(tela.linhas.length)} de {num(tela.quantidade)}.</p>}
  </div>;
}

export default function NexusViewCanvas({tela,estado,onSalvar,onAtualizar,onApagar,erro}){
  if(!tela)return null;
  const vazio=tela.tipo!=='numero'&&!(tela.grupos?.length||tela.linhas?.length)&&!tela.total?.quantidade;
  const tipo=tela.spec?.tipo;
  return <article className={'nx-view nx-view--'+tipo} aria-label={tela.titulo}>
    <header className="nx-view-head">
      <div><h3>{tela.titulo}</h3><p>{tela.descricao}</p></div>
      <div className="nx-view-actions">
        {onAtualizar&&<button type="button" className="fx-iconbtn" onClick={onAtualizar} disabled={estado==='carregando'} aria-label="Atualizar dados" title="Atualizar dados"><RefreshCw size={15}/></button>}
        {onSalvar&&<button type="button" className="fx-btn" onClick={onSalvar} disabled={estado==='salvando'||estado==='salvo'}>
          {estado==='salvo'?<><BookmarkCheck size={15}/> Salva</>:<><Bookmark size={15}/> {estado==='salvando'?'Salvando…':'Salvar nas minhas telas'}</>}
        </button>}
        {onApagar&&<ConfirmButton onConfirm={onApagar} label="Apagar tela" confirmLabel="Confirmar: apagar tela" className="fx-btn nx-view-delete"/>}
      </div>
    </header>
    {tela.aviso&&<p className="nx-view-warn" role="status">{tela.aviso}</p>}
    {erro&&<p className="nx-view-warn is-error" role="alert">{erro}</p>}
    {estado==='carregando'?<p className="nx-view-empty">Atualizando…</p>
      :vazio?<p className="nx-view-empty">Nada encontrado com esses filtros.</p>
      :tipo==='numero'?<Numero tela={tela}/>
      :tipo==='quadro'?<Quadro tela={tela}/>
      :tipo==='grafico'?(tela.spec?.estilo==='pizza'?<Pizza tela={tela}/>:tela.spec?.estilo==='linha'?<Linha tela={tela}/>:<Grafico tela={tela}/>)
      :<Lista tela={tela}/>}
    <footer className="nx-view-foot">Dados de agora · {new Date(tela.geradoEm||Date.now()).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</footer>
  </article>;
}
