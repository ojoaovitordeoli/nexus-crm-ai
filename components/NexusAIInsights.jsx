'use client';
import {useCallback,useEffect,useState} from 'react';
import {ArrowRight,CheckCircle2,ClipboardCopy,Info} from 'lucide-react';
import {db} from '../lib/supabase';

const suggestions=[
  'Quais são as três prioridades da operação nesta semana?',
  'O que meus indicadores revelam sobre os follow-ups?',
  'Quais métricas devo acompanhar para melhorar as vendas?',
  'Como organizar as tarefas sem deixar leads parados?'
];
export default function NexusAIInsights({organizationId}){
  const [configured,setConfigured]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [question,setQuestion]=useState('');
  const [consent,setConsent]=useState(false);
  const [answer,setAnswer]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const request=useCallback(async(body=null)=>{
    const {data:{session}}=await db.auth.getSession();
    if(!session?.access_token)throw new Error('Faça login novamente.');
    const response=await fetch(body?'/api/insights':'/api/insights?org_id='+encodeURIComponent(organizationId),{
      method:body?'POST':'GET',
      headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},
      ...(body?{body:JSON.stringify({org_id:organizationId,...body})}:{})
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||'Não foi possível consultar o copiloto.');
    return data;
  },[organizationId]);
  useEffect(()=>{
    let current=true;
    (async()=>{
      setLoading(true);
      try{const data=await request();if(current){setConfigured(Boolean(data.configured));setError('')}}
      catch(e){if(current&&!/migra|instalad|OPENAI|Render|Supabase/i.test(e.message))setError(e.message)}
      finally{if(current)setLoading(false)}
    })();
    return ()=>{current=false};
  },[request]);
  async function analyze(e){
    e.preventDefault();if(busy||!consent||question.trim().length<8)return;
    setBusy(true);setAnswer('');setError('');setNotice('');
    try{
      const response=await request({question:question.trim(),consent:true});
      setAnswer(response.answer);
    }catch(e){
      // Mensagens de configuração do servidor não são úteis para o usuário final.
      setError(/migra|instalad|OPENAI|Render|Supabase/i.test(e.message)?'O copiloto não está disponível nesta empresa no momento. Fale com o administrador.':e.message);
    }
    finally{setBusy(false)}
  }
  const copy=async()=>{
    if(!answer)return;
    try{await navigator.clipboard.writeText(answer);setNotice('Análise copiada.')}
    catch{setNotice('Não foi possível copiar automaticamente neste navegador.')}
  };
  const ready=!loading&&configured;
  return <div className="fx-page fx-int fx-ai">
    <header className="fx-pagehead">
      <div className="fx-pagehead-title"><h1>Copiloto</h1><span className="fx-count">{loading?'Verificando...':configured?'Consultivo · somente leitura':'Não ativado'}</span></div>
    </header>
    {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    {notice&&<div className="fx-alert fx-alert--ok" role="status"><CheckCircle2 size={16}/>{notice}</div>}

    {!loading&&!configured&&<section className="fx-box fx-int-off" aria-labelledby="fx-ai-off">
      <div className="fx-int-off-body">
        <Info size={18} aria-hidden="true"/>
        <div><h2 id="fx-ai-off">Copiloto ainda não ativado</h2>
          <p>O administrador da sua empresa precisa ativar e configurar o copiloto. Até lá, nenhuma pergunta é enviada a provedores de IA.</p></div>
      </div>
      <p className="fx-boxfoot">Quando ativado, o copiloto responde perguntas sobre a operação usando apenas indicadores agregados do CRM, sempre com sua autorização a cada envio. Ele não contata clientes, não cria tarefas e não altera dados.</p>
    </section>}

    {ready&&<div className="fx-ai-grid">
      <section className="fx-box">
        <div className="fx-boxhead"><h2>Nova análise</h2><span className="fx-boxmeta">Usa só a pergunta e indicadores agregados</span></div>
        <form onSubmit={analyze} className="fx-ai-form">
          <label htmlFor="nxai-question">Pergunta</label>
          <textarea id="nxai-question" value={question} onChange={e=>setQuestion(e.target.value)}
            maxLength={900} minLength={8} required rows={5}
            placeholder="Ex.: Com base no funil e nas tarefas pendentes, onde concentrar o atendimento nesta semana?"/>
          <div className="fx-ai-counter">{question.length}/900</div>
          <label className="fx-ai-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Autorizo o envio desta pergunta e dos indicadores agregados ao provedor de IA. Não incluirei dados pessoais, telefones ou informações confidenciais.</span></label>
          <div className="fx-ai-submit">
            {!consent&&<small>Marque a autorização para gerar a análise.</small>}
            <button type="submit" className="fx-btn fx-btn--primary" disabled={busy||!consent||question.trim().length<8}>{busy?'Analisando...':'Gerar análise'}</button>
          </div>
        </form>
      </section>
      <section className="fx-box">
        <div className="fx-boxhead"><h2>Sugestões de pergunta</h2></div>
        {suggestions.map(item=><button type="button" className="fx-row fx-ai-suggestion" key={item} onClick={()=>{setQuestion(item);setError('')}}><span>{item}</span><ArrowRight size={15} aria-hidden="true"/></button>)}
      </section>
    </div>}

    {ready&&<section className="fx-box">
      <div className="fx-boxhead"><h2>Resultado</h2>{answer&&<button type="button" className="fx-link fx-ai-copy" onClick={copy}><ClipboardCopy size={14}/> Copiar</button>}</div>
      {answer?<p className="fx-ai-answer">{answer}</p>:<div className="fx-empty"><strong>Nenhuma análise ainda</strong><p>Escolha ou escreva uma pergunta e autorize o envio.</p></div>}
      <p className="fx-boxfoot">As respostas são recomendações. A IA não contata clientes, não cria tarefas e não altera etapas.</p>
    </section>}
  </div>;
}
