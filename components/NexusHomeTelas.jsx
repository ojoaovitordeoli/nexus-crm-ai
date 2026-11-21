'use client';
import {useCallback,useEffect,useState} from 'react';
import {db} from '../lib/supabase';
import NexusViewCanvas from './NexusViewCanvas';

// V53 — telas que a pessoa fixou na tela inicial (até 4). Cada uma é aberta de novo pelo servidor
// (/api/views acao=abrir), então os dados são sempre os de agora e da empresa da sessão.
async function headers(){
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
  return {'Content-Type':'application/json',Authorization:'Bearer '+session.access_token};
}

export default function NexusHomeTelas({organizationId}){
  const [telas,setTelas]=useState([]); // {id,nome,spec,tela,estado,erro}
  const abrir=useCallback(async item=>{
    setTelas(ts=>ts.map(t=>t.id===item.id?{...t,estado:'carregando',erro:''}:t));
    try{
      const res=await fetch('/api/views',{method:'POST',headers:await headers(),body:JSON.stringify({org_id:organizationId,acao:'abrir',spec:item.spec})});
      const json=await res.json().catch(()=>null);
      if(!res.ok)throw new Error(json?.error||'Não consegui abrir a tela.');
      setTelas(ts=>ts.map(t=>t.id===item.id?{...t,tela:{...json.tela,titulo:item.nome},estado:'',erro:''}:t));
    }catch(e){setTelas(ts=>ts.map(t=>t.id===item.id?{...t,estado:'',erro:e.message}:t))}
  },[organizationId]);

  useEffect(()=>{
    if(!organizationId)return;
    let vivo=true;
    (async()=>{
      try{
        const res=await fetch('/api/views?org_id='+encodeURIComponent(organizationId),{headers:await headers()});
        const json=await res.json().catch(()=>null);
        if(!vivo||!res.ok)return;
        const fixadas=(json?.telas||[]).filter(t=>t.inicio).slice(0,4).map(t=>({...t,tela:null,estado:'carregando',erro:''}));
        setTelas(fixadas);
        fixadas.forEach(abrir);
      }catch{/* tela inicial continua funcionando sem as telas fixadas */}
    })();
    return()=>{vivo=false};
  },[organizationId,abrir]);

  if(!telas.length)return null;
  return <section className="nx-home-telas" aria-label="Minhas telas fixadas">
    {telas.map(t=><div key={t.id} className={'nx-home-tela nx-home-tela--'+(t.spec?.tipo||'lista')}>
      {t.tela?<NexusViewCanvas tela={t.tela} estado={t.estado} erro={t.erro} onAtualizar={()=>abrir(t)}/>
        :<article className="nx-view"><header className="nx-view-head"><div><h3>{t.nome}</h3></div></header>
          <p className={t.erro?'nx-view-warn is-error':'nx-view-empty'} role={t.erro?'alert':'status'}>{t.erro||'Carregando…'}</p></article>}
    </div>)}
  </section>;
}
