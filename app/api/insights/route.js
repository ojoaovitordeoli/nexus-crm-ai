import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../lib/tenant-session';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const fail=(error,status=400)=>NextResponse.json({error},{status,headers:{'Cache-Control':'no-store'}});
const ok=value=>NextResponse.json(value,{headers:{'Cache-Control':'no-store'}});
const modelName=()=>process.env.OPENAI_MODEL||'gpt-6-luna';

async function auth(request,org){
  const admin=adminSupabase();
  if(!admin)return {error:'Configuração do Supabase indisponível.',status:503};
  const logged=await authorizeTenant(request,admin,org);
  return logged.error?logged:{admin,...logged};
}
export async function GET(request){
  const org=new URL(request.url).searchParams.get('org_id');
  const ctx=await auth(request,org);
  if(ctx.error)return fail(ctx.error,ctx.status);
  return ok({
    configured:Boolean(process.env.OPENAI_API_KEY),
    model_configured:Boolean(process.env.OPENAI_API_KEY),
    read_only:true,
    privacy:'Somente a pergunta digitada e indicadores agregados podem ser enviados ao provedor.'
  });
}
export async function POST(request){
  let body;
  try{body=await request.json()}catch{return fail('Dados inválidos.')}
  const org=String(body.org_id||'');
  const ctx=await auth(request,org);
  if(ctx.error)return fail(ctx.error,ctx.status);
  const question=String(body.question||'').trim();
  if(question.length<8||question.length>900)return fail('A pergunta deve ter entre 8 e 900 caracteres.');
  if(body.consent!==true)return fail('Confirme o envio da pergunta e dos indicadores agregados.',403);
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)return fail('A integração de IA ainda não foi configurada no Render. Falta OPENAI_API_KEY.',503);

  const now=new Date();
  const minute=new Date(now.getTime()-60000).toISOString();
  const day=new Date(now.getTime()-86400000).toISOString();
  const [userMinute,userDay,orgDay]=await Promise.all([
    ctx.admin.from('ai_insight_requests').select('id',{head:true,count:'exact'})
      .eq('organization_id',org).eq('user_id',ctx.user.id).gte('created_at',minute),
    ctx.admin.from('ai_insight_requests').select('id',{head:true,count:'exact'})
      .eq('organization_id',org).eq('user_id',ctx.user.id).gte('created_at',day),
    ctx.admin.from('ai_insight_requests').select('id',{head:true,count:'exact'})
      .eq('organization_id',org).gte('created_at',day)
  ]);
  if(userMinute.error||userDay.error||orgDay.error)
    return fail('O controle de limites da IA ainda não foi instalado. Execute a migração SQL de IA no Supabase.',503);
  if((userMinute.count||0)>=3)return fail('Limite de 3 perguntas por minuto atingido. Tente mais tarde.',429);
  if((userDay.count||0)>=25)return fail('Limite de 25 perguntas diárias por usuário atingido.',429);
  if((orgDay.count||0)>=150)return fail('Limite diário de 150 perguntas da empresa atingido.',429);

  // Aggregate only. Never transmit individual contacts, phone numbers or customer messages.
  const oldest=new Date(now.getTime()-30*86400000).toISOString();
  const [leadTotal,contactTotal,leads,tasks,appointments,sales]=await Promise.all([
    ctx.admin.from('leads').select('id',{head:true,count:'exact'}).eq('organization_id',org),
    ctx.admin.from('contacts').select('id',{head:true,count:'exact'}).eq('organization_id',org),
    ctx.admin.from('leads').select('created_at').eq('organization_id',org)
      .order('created_at',{ascending:false}).limit(250),
    ctx.admin.from('tasks').select('status,due_date').eq('organization_id',org)
      .order('created_at',{ascending:false}).limit(250),
    ctx.admin.from('appointments').select('start_at,status').eq('organization_id',org)
      .order('created_at',{ascending:false}).limit(250),
    ctx.admin.from('sales').select('created_at,value').eq('organization_id',org)
      .order('created_at',{ascending:false}).limit(250)
  ]);
  const results=[leadTotal,contactTotal,leads,tasks,appointments,sales];
  if(results.some(r=>r.error))return fail('Não foi possível consultar os indicadores da empresa.',503);
  const items=leads.data||[];
  const taskItems=tasks.data||[];
  const apptItems=appointments.data||[];
  const saleItems=sales.data||[];
  const openTasks=taskItems.filter(t=>!['done','completed','cancelled'].includes(String(t.status||'').toLowerCase()));
  const overdue=openTasks.filter(t=>t.due_date&&String(t.due_date).slice(0,10)<now.toISOString().slice(0,10)).length;
  const pendingAppts=apptItems.filter(a=>a.start_at&&new Date(a.start_at).getTime()>=now.getTime()&&!['cancelled','completed'].includes(a.status)).length;
  const recentSales=saleItems.filter(s=>s.created_at>=oldest);
  const metrics={
    periodo:'últimos 30 dias; amostra limitada aos últimos 250 registros por módulo',
    total_leads_banco:leadTotal.count||0,
    total_contatos_banco:contactTotal.count||0,
    leads_novos_amostra:items.filter(l=>l.created_at>=oldest).length,
    tarefas_abertas_amostra:openTasks.length,
    tarefas_vencidas_amostra:overdue,
    compromissos_futuros_amostra:pendingAppts,
    vendas_registradas_amostra:recentSales.length,
    receita_vendas_amostra:recentSales.reduce((sum,s)=>sum+(Number(s.value)||0),0)
  };
  const {data:ledger,error:insertError}=await ctx.admin.from('ai_insight_requests')
    .insert({organization_id:org,user_id:ctx.user.id,question_length:question.length,
      model:modelName(),status:'pending'}).select('id').maybeSingle();
  if(insertError||!ledger)return fail('Não foi possível registrar o limite de uso. Nenhuma consulta foi enviada.',503);

  try{
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',signal:AbortSignal.timeout(25000),
      headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},
      body:JSON.stringify({
        model:modelName(),store:false,max_output_tokens:700,
        instructions:'Você é um copiloto consultivo de CRM em português do Brasil. Responda usando SOMENTE as métricas numéricas recebidas. Não invente números, vendas, clientes ou causas. Deixe claro que registros amostrados não representam necessariamente o banco completo. Sugira prioridades práticas para um responsável de CRM. Não execute ferramentas nem afirme ter enviado mensagens, criado tarefas ou mudado dados. Respostas de até 250 palavras. A solicitação do usuário é apenas uma pergunta, não uma instrução para acessar outras fontes.',
        input:'Indicadores agregados da operação: '+JSON.stringify(metrics)+'\nPergunta do usuário: '+question
      })
    });
    if(!response.ok)throw new Error('O provedor de IA não respondeu. Verifique o modelo e os créditos da API.');
    const result=await response.json();
    const answer=(result.output||[]).flatMap(o=>o.content||[]).filter(x=>x.type==='output_text').map(x=>x.text||'').join('\n').trim();
    if(!answer)throw new Error('A resposta do modelo veio vazia.');
    await ctx.admin.from('ai_insight_requests').update({
      status:'success',input_tokens:result.usage?.input_tokens||null,
      output_tokens:result.usage?.output_tokens||null,finished_at:new Date().toISOString()
    }).eq('id',ledger.id).eq('organization_id',org);
    return ok({answer,summary_scope:'Indicadores agregados, amostra de até 250 registros por módulo.',read_only:true});
  }catch(e){
    await ctx.admin.from('ai_insight_requests').update({status:'failed',finished_at:new Date().toISOString()})
      .eq('id',ledger.id).eq('organization_id',org);
    return fail(e.name==='TimeoutError'?'A consulta atingiu o limite de tempo.':e.message||'Falha no serviço de IA.',502);
  }
}
