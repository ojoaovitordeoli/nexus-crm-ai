'use client';

// V63 — Visão da agência: todas as empresas que a pessoa gerencia numa tela, a mais
// urgente primeiro. Só leitura; os números vêm de /api/agencia, que decide no servidor
// quais empresas a pessoa pode ver.
import {useCallback,useEffect,useMemo,useState} from 'react';
import {db} from '../lib/supabase';
import {resumoAgencia,brl} from '../lib/agencia.mjs';
import {ArrowUpRight,Building2,RefreshCw} from 'lucide-react';

async function headers(){
  const {data:{session}}=await db.auth.getSession();
  return {'content-type':'application/json',...(session?.access_token?{authorization:'Bearer '+session.access_token}:{})};
}

export default function NexusAgencia({onOpen}){
  const [estado,setEstado]=useState({status:'loading',empresas:[],aviso:'',erro:'',geradoEm:''});
  const carregar=useCallback(async()=>{
    setEstado(e=>({...e,status:'loading',erro:''}));
    try{
      const res=await fetch('/api/agencia',{headers:await headers()});
      const body=await res.json().catch(()=>({}));
      if(!res.ok)throw new Error(body.error||'Não foi possível carregar a visão da agência.');
      setEstado({status:'ready',empresas:body.empresas||[],aviso:body.aviso||'',erro:'',geradoEm:body.geradoEm||''});
    }catch(e){setEstado(s=>({...s,status:'error',erro:e.message}))}
  },[]);
  useEffect(()=>{carregar()},[carregar]);
  const resumo=useMemo(()=>resumoAgencia(estado.empresas.filter(e=>e.metricas)),[estado.empresas]);
  const comErro=estado.empresas.filter(e=>!e.metricas);
  const hora=estado.geradoEm?new Date(estado.geradoEm).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';

  return <div className="nx63">
    <header className="nx-hoje-head">
      <div>
        <h1>{estado.status==='loading'&&!estado.empresas.length?'Carregando as empresas…':estado.status==='error'?'Visão da agência':resumo.frase}</h1>
        {estado.status==='ready'&&resumo.linhas.length>0&&<p>Faturamento somado no mês: {brl(resumo.faturamentoTotal)} · {resumo.linhas.length===1?'1 empresa':resumo.linhas.length+' empresas'}{hora?' · números de '+hora:''}.</p>}
      </div>
      <div className="nx-hoje-side"><button type="button" className="fx-btn" onClick={carregar} disabled={estado.status==='loading'}><RefreshCw size={15} aria-hidden="true"/> Atualizar</button></div>
    </header>
    {estado.status==='error'&&<div className="fx-alert fx-alert--error" role="alert">{estado.erro} <button type="button" className="nx13-linkbutton" onClick={carregar}>Tentar de novo</button></div>}
    {estado.aviso&&<div className="nx-empty"><Building2 size={20} aria-hidden="true"/><strong>Nada para mostrar aqui</strong><p>{estado.aviso}</p></div>}
    {resumo.linhas.length>0&&<section className="nx63-lista" aria-label="Empresas, a mais urgente primeiro">
      <div className="nx63-head" aria-hidden="true"><span>Empresa</span><span>Mês</span><span>O que pede atenção</span><span/></div>
      {resumo.linhas.map(l=>{const a=l.aval,m=l.metricas;return <div key={l.id} className={'nx63-row is-'+a.situacao}>
        <div className="nx63-nome"><i aria-hidden="true"/><span><strong>{l.nome}</strong><small>{m.leadsAbertos} {m.leadsAbertos===1?'lead aberto':'leads abertos'} · {m.leadsNovos30} {m.leadsNovos30===1?'novo':'novos'} em 30 dias</small></span></div>
        <div className="nx63-mes">
          <span><b>{brl(a.feito)}</b>{a.alvo?<> de {brl(a.alvo)}</>:<> · sem meta</>}</span>
          {a.alvo?<span className="nx63-bar" role="img" aria-label={a.pctMeta+'% da meta; o mês está em '+a.esperado+'%'}><span style={{width:Math.min(100,a.pctMeta)+'%'}}/><i style={{left:a.esperado+'%'}}/></span>
            :<small>fecha em {brl(a.projecao)} no ritmo atual</small>}
        </div>
        <div className="nx63-alertas">{a.alertas.length?a.alertas.slice(0,3).map(x=><span key={x.txt} className={'nx63-tag is-'+x.tom}>{x.txt}</span>):<span className="nx63-ok">Tudo em dia</span>}</div>
        <div><button type="button" className="nx-mini" onClick={()=>onOpen?.(l.id)} aria-label={'Abrir '+l.nome}>Abrir<ArrowUpRight size={14} aria-hidden="true"/></button></div>
      </div>})}
    </section>}
    {comErro.length>0&&<p className="nx-foot">Sem números agora: {comErro.map(e=>e.nome).join(', ')}. Tente atualizar em instantes.</p>}
    {resumo.linhas.length>0&&<p className="nx-foot">Mostra só as empresas em que você é administrador ou gestor. Faltas contam a partir de 5 atendimentos encerrados em 30 dias.</p>}
  </div>;
}
