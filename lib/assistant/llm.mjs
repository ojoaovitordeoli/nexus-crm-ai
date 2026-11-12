// Adaptador de IA trocável. Configuração só por variáveis de ambiente do servidor:
//   ANTHROPIC_API_KEY              -> Claude (recomendado; modelo padrão claude-haiku-5-5)
//   ASSISTANT_BASE_URL (+ ASSISTANT_API_KEY opcional) -> qualquer API compatível com OpenAI
//                                     (OpenRouter, Groq, Ollama local: http://servidor:11434/v1)
//   ASSISTANT_MODEL                -> troca o modelo
// As chaves nunca vão para o navegador.

export function assistantConfig(env=process.env){
  if(env.ANTHROPIC_API_KEY)return {provider:'anthropic',apiKey:env.ANTHROPIC_API_KEY,model:env.ASSISTANT_MODEL||'claude-haiku-5-5'};
  if(env.ASSISTANT_BASE_URL)return {provider:'openai',baseUrl:String(env.ASSISTANT_BASE_URL).replace(/\/+$/,''),apiKey:env.ASSISTANT_API_KEY||'',model:env.ASSISTANT_MODEL||'llama3.1'};
  return null;
}

/**
 * Roda a conversa com ferramentas até a IA responder em texto (no máximo maxSteps rodadas).
 * runTool(name,input) executa a ferramenta no servidor e devolve um objeto (vira JSON para a IA).
 * Retorna {text, steps}.
 */
export async function runAgent({config,system,history,tools,runTool,maxSteps=5,fetchImpl=fetch,timeoutMs=45000}){
  return config.provider==='anthropic'
    ?runAnthropic({config,system,history,tools,runTool,maxSteps,fetchImpl,timeoutMs})
    :runOpenAI({config,system,history,tools,runTool,maxSteps,fetchImpl,timeoutMs});
}

async function post(fetchImpl,url,headers,body,timeoutMs){
  const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),timeoutMs);
  try{
    const res=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(body),signal:ctrl.signal});
    const json=await res.json().catch(()=>null);
    if(!res.ok){const err=new Error('provider_error');err.status=res.status;err.detail=json?.error?.message||json?.error||'';throw err}
    return json;
  }finally{clearTimeout(t)}
}

// Envia a chave por x-api-key; se o provedor recusar (401), tenta uma vez como Authorization: Bearer,
// formato aceito por alguns tipos de chave. Depois da primeira resposta, guarda o formato que funcionou.
async function anthropicCall(fetchImpl,config,body,timeoutMs){
  const url='https://api.anthropic.com/v1/messages';
  const base={'anthropic-version':'2023-06-01'};
  const viaHeader={...base,'x-api-key':config.apiKey};
  const viaBearer={...base,authorization:'Bearer '+config.apiKey};
  if(config.authMode==='bearer')return post(fetchImpl,url,viaBearer,body,timeoutMs);
  try{const r=await post(fetchImpl,url,viaHeader,body,timeoutMs);config.authMode='header';return r}
  catch(e){
    if(e.status!==401||config.authMode==='header')throw e;
    const r=await post(fetchImpl,url,viaBearer,body,timeoutMs);config.authMode='bearer';return r;
  }
}

async function runAnthropic({config,system,history,tools,runTool,maxSteps,fetchImpl,timeoutMs}){
  const messages=history.map(m=>({role:m.role,content:m.content}));
  const toolDefs=tools.map(t=>({name:t.name,description:t.description,input_schema:t.parameters}));
  for(let step=1;step<=maxSteps;step++){
    const r=await anthropicCall(fetchImpl,config,{model:config.model,max_tokens:1024,system,tools:toolDefs,messages},timeoutMs);
    const blocks=Array.isArray(r?.content)?r.content:[];
    const calls=blocks.filter(b=>b.type==='tool_use');
    const text=blocks.filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
    if(!calls.length||r.stop_reason!=='tool_use')return {text,steps:step};
    messages.push({role:'assistant',content:blocks});
    const results=[];
    for(const c of calls)results.push({type:'tool_result',tool_use_id:c.id,content:JSON.stringify(await runTool(c.name,c.input||{}))});
    messages.push({role:'user',content:results});
  }
  return {text:'',steps:maxSteps};
}

async function runOpenAI({config,system,history,tools,runTool,maxSteps,fetchImpl,timeoutMs}){
  const messages=[{role:'system',content:system},...history.map(m=>({role:m.role,content:m.content}))];
  const toolDefs=tools.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters}}));
  const headers=config.apiKey?{authorization:'Bearer '+config.apiKey}:{};
  for(let step=1;step<=maxSteps;step++){
    const r=await post(fetchImpl,config.baseUrl+'/chat/completions',headers,{model:config.model,messages,tools:toolDefs,temperature:0.2},timeoutMs);
    const msg=r?.choices?.[0]?.message||{};
    const calls=Array.isArray(msg.tool_calls)?msg.tool_calls:[];
    if(!calls.length)return {text:String(msg.content||'').trim(),steps:step};
    messages.push({role:'assistant',content:msg.content||null,tool_calls:calls});
    for(const c of calls){
      let input={};try{input=JSON.parse(c.function?.arguments||'{}')}catch{}
      messages.push({role:'tool',tool_call_id:c.id,content:JSON.stringify(await runTool(c.function?.name,input))});
    }
  }
  return {text:'',steps:maxSteps};
}
