'use client';
import {useCallback,useEffect,useState} from 'react';
import {
  ArrowRight,BookOpen,CheckCircle2,ClipboardCopy,Clock3,Lightbulb,
  LockKeyhole,MessageSquareText,ShieldCheck,Sparkles,TrendingUp,Zap
} from 'lucide-react';
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
      catch(e){if(current)setError(e.message)}
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
    }catch(e){setError(e.message)}
    finally{setBusy(false)}
  }
  const copy=async()=>{
    if(!answer)return;
    try{await navigator.clipboard.writeText(answer);setNotice('Análise copiada.')}
    catch{setNotice('Não foi possível copiar automaticamente neste navegador.')}
  };
  return <div className="nxai-page">
    <div className="nxai-header"><span className="nxai-kicker"><Sparkles size={15}/> NEXUS / COPILOTO</span><h1>Inteligência para sua operação.</h1><p>Transforme os números reais da empresa em prioridades, ideias e próximos passos — sem ações automáticas sobre clientes.</p></div>
    <div className="nxai-hero"><div className="nxai-hero-copy"><span className="nxai-kicker"><Zap size={14}/> ANÁLISE OPERACIONAL</span><h2>Um segundo olhar para suas decisões.</h2><p>O copiloto utiliza apenas dados agregados do CRM e a pergunta digitada, quando você autoriza. Não lê conversas individuais nem altera dados.</p>
      <div className="nxai-hero-tags"><span><ShieldCheck size={15}/> Somente leitura</span><span><LockKeyhole size={15}/> Proteção por empresa</span><span><Clock3 size={15}/> Limites de custo</span></div>
    </div><div className="nxai-orbit" aria-hidden="true"><span className="nxai-orbit-ring"/><span className="nxai-orbit-center"><Sparkles size={42}/></span><span className="nxai-orbit-light"/></div></div>
    {!loading&&!configured&&<div className="nxai-setup">
      <LockKeyhole size={22}/><div><strong>Integração de IA ainda não ativada</strong><p>O administrador precisa configurar <code>OPENAI_API_KEY</code> no Render e aplicar a migração <code>supabase/20261028_ai_insights_quota.sql</code>. Até isso acontecer, o copiloto não faz consultas externas.</p></div>
    </div>}
    {error&&<div className="nxai-alert nxai-alert--error" role="alert">{error}</div>}
    {notice&&<div className="nxai-alert nxai-alert--success" role="status"><CheckCircle2 size={16}/>{notice}</div>}
    <div className="nxai-grid">
      <section className="nxai-panel nxai-compose"><div className="nxai-panel-top"><div><span className="nxai-kicker">PERGUNTE AO NEXUS</span><h3>O que você quer analisar?</h3></div><MessageSquareText size={22}/></div>
        <form onSubmit={analyze}>
          <label htmlFor="nxai-question">Pergunta operacional</label>
          <textarea id="nxai-question" value={question} onChange={e=>setQuestion(e.target.value)}
            maxLength={900} minLength={8} required rows={5}
            placeholder="Ex.: Com base no meu funil e nas tarefas pendentes, onde devo concentrar meu atendimento nesta semana?"/>
          <div className="nxai-counter">{question.length}/900 caracteres</div>
          <label className="nxai-consent"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>Autorizo o envio desta pergunta e dos indicadores agregados ao provedor de IA para gerar a análise. Não incluirei dados pessoais, números de telefone ou informações confidenciais.</span></label>
          <button type="submit" className="nxai-primary" disabled={loading||!configured||busy||!consent||question.trim().length<8}>
            <Sparkles size={17}/>{busy?'Analisando indicadores...':'Gerar análise'}<ArrowRight size={16}/>
          </button>
        </form>
      </section>
      <section className="nxai-panel nxai-suggestions"><div className="nxai-panel-top"><div><span className="nxai-kicker">IDEIAS DE PERGUNTAS</span><h3>Comece por aqui</h3></div><Lightbulb size={21}/></div>
        {suggestions.map((item,i)=><button type="button" key={item} onClick={()=>{setQuestion(item);setError('')}}><span>{'0'+(i+1)}</span><strong>{item}</strong><ArrowRight size={15}/></button>)}
        <div className="nxai-scope"><BookOpen size={18}/><p>As respostas são recomendações. Ninguém é contatado, tarefas não são criadas e nenhuma etapa é alterada pela IA.</p></div>
      </section>
    </div>
    <section className="nxai-panel nxai-output"><div className="nxai-panel-top"><div><span className="nxai-kicker">RESULTADO CONSULTIVO</span><h3>Plano de ação sugerido</h3></div>{answer&&<button type="button" className="nxai-copy" onClick={copy}><ClipboardCopy size={16}/> Copiar</button>}</div>
      {answer?<div className="nxai-answer"><Sparkles size={21}/><p>{answer}</p></div>:<div className="nxai-empty"><TrendingUp size={30}/><strong>Seu resumo aparecerá aqui.</strong><p>Escolha uma pergunta e autorize a análise para receber recomendações baseadas nos indicadores disponíveis.</p></div>}
    </section>
  </div>;
}
