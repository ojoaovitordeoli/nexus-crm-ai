import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantConfig,runAgent} from '../lib/assistant/llm.mjs';

const tools=[{name:'ver_funil',description:'x',parameters:{type:'object',properties:{}}}];
const reply=json=>({ok:true,status:200,json:async()=>json});

test('configuração: Claude tem prioridade; sem nada = desligado',()=>{
  assert.equal(assistantConfig({}),null);
  assert.equal(assistantConfig({ANTHROPIC_API_KEY:'k'}).model,'claude-haiku-5-5');
  assert.equal(assistantConfig({ASSISTANT_BASE_URL:'http://x:11434/v1/'}).baseUrl,'http://x:11434/v1');
});
test('Claude: chama ferramenta e depois responde em texto',async()=>{
  const calls=[];let n=0;
  const fetchImpl=async(url,opt)=>{calls.push(JSON.parse(opt.body));n++;
    return n===1?reply({stop_reason:'tool_use',content:[{type:'tool_use',id:'t1',name:'ver_funil',input:{}}]})
      :reply({stop_reason:'end_turn',content:[{type:'text',text:'Você tem 3 leads.'}]})};
  const ran=[];
  const r=await runAgent({config:{provider:'anthropic',apiKey:'k',model:'m'},system:'s',history:[{role:'user',content:'funil?'}],tools,runTool:async(name)=>{ran.push(name);return {total:3}},fetchImpl});
  assert.equal(r.text,'Você tem 3 leads.');assert.deepEqual(ran,['ver_funil']);
  assert.equal(calls[1].messages.at(-1).content[0].type,'tool_result');
  assert.equal(calls[0].tools[0].input_schema.type,'object');
});
test('compatível com OpenAI: mesmo fluxo',async()=>{
  let n=0;const fetchImpl=async(url)=>{n++;assert.match(url,/\/chat\/completions$/);
    return n===1?reply({choices:[{message:{content:null,tool_calls:[{id:'c1',function:{name:'ver_funil',arguments:'{}'}}]}}]})
      :reply({choices:[{message:{content:'Feito.'}}]})};
  const r=await runAgent({config:{provider:'openai',baseUrl:'http://x/v1',apiKey:'',model:'m'},system:'s',history:[{role:'user',content:'oi'}],tools,runTool:async()=>({ok:true}),fetchImpl});
  assert.equal(r.text,'Feito.');assert.equal(r.steps,2);
});
test('erro do provedor vira exceção com status',async()=>{
  const fetchImpl=async()=>({ok:false,status:401,json:async()=>({error:{message:'invalid x-api-key'}})});
  await assert.rejects(runAgent({config:{provider:'anthropic',apiKey:'k',model:'m'},system:'s',history:[{role:'user',content:'oi'}],tools,runTool:async()=>({}),fetchImpl}),e=>e.status===401);
});
test('para depois do limite de rodadas',async()=>{
  const fetchImpl=async()=>reply({stop_reason:'tool_use',content:[{type:'tool_use',id:'t',name:'ver_funil',input:{}}]});
  const r=await runAgent({config:{provider:'anthropic',apiKey:'k',model:'m'},system:'s',history:[{role:'user',content:'oi'}],tools,runTool:async()=>({}),maxSteps:3,fetchImpl});
  assert.equal(r.steps,3);assert.equal(r.text,'');
});
