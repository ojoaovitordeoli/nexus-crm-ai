import {NextResponse} from 'next/server';
import {adminSupabase,authorizeTenant} from '../../../lib/tenant-session';
import {openSecret,sealSecret} from '../../../lib/nexus-secrets.mjs';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const out=(data,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
const fail=(error,status=400)=>out({error},status);
const canManage=role=>['AGENCY_ADMIN','ORGANIZATION_ADMIN','MANAGER'].includes(role);
const graphVersion=()=>/^v\d{1,2}\.\d$/.test(process.env.META_GRAPH_API_VERSION||'')?process.env.META_GRAPH_API_VERSION:'v25.0';
async function ctxFor(request,org){
 const db=adminSupabase();
 if(!db)return {error:'Supabase não configurado.',status:503};
 const auth=await authorizeTenant(request,db,org);
 return auth.error?auth:{db,...auth};
}
async function graph(path,token,params={}){
 const url=new URL('https://graph.facebook.com/'+graphVersion()+'/'+path);
 for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 const res=await fetch(url.toString(),{headers:{Authorization:'Bearer '+token},
    cache:'no-store',signal:AbortSignal.timeout(11000)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error('A Meta recusou a consulta ('+res.status+'). Verifique ads_read e o acesso à conta.');
 return data;
}
export async function GET(request){
 const org=new URL(request.url).searchParams.get('org_id');
 const ctx=await ctxFor(request,org);if(ctx.error)return fail(ctx.error,ctx.status);
 const {data:connections,error}=await ctx.db.from('nexus_meta_ads_connections')
   .select('id,account_id,label,token_ciphertext').eq('organization_id',org).order('created_at',{ascending:false}).limit(6);
 if(error)return fail('Migração Meta Ads pendente no Supabase.',503);
 if(!connections?.length)return out({connected:false,accounts:[],manager:canManage(ctx.role)});
 const key=process.env.NEXUS_SECRETS_KEY;
 if(!key)return fail('Chave segura dos conectores não configurada no servidor.',503);
 const accounts=[];
 for(const c of connections){
   try{
     const token=openSecret(c.token_ciphertext,key);
     const [account,insights,campaigns]=await Promise.all([
       graph(c.account_id,token,{fields:'id,name,account_status,currency,balance,amount_spent,spend_cap,is_prepay_account'}),
       graph(c.account_id+'/insights',token,{level:'campaign',date_preset:'last_7d',fields:'campaign_id,campaign_name,spend,impressions,reach,clicks,ctr,cpc',limit:100}),
       graph(c.account_id+'/campaigns',token,{fields:'id,name,status,effective_status,daily_budget,lifetime_budget',limit:100})
     ]);
     const performance=new Map((insights.data||[]).map(x=>[String(x.campaign_id),x]));
     const campaignsOut=(campaigns.data||[]).map(x=>({
       id:x.id,name:x.name,status:x.effective_status||x.status,
       daily_budget_minor:x.daily_budget||null,lifetime_budget_minor:x.lifetime_budget||null,
       spend_7d:performance.get(x.id)?.spend||'0',impressions_7d:Number(performance.get(x.id)?.impressions||0),
       reach_7d:Number(performance.get(x.id)?.reach||0),clicks_7d:Number(performance.get(x.id)?.clicks||0),
       ctr_7d:Number(performance.get(x.id)?.ctr||0),cpc_7d:Number(performance.get(x.id)?.cpc||0)
     }));
     const spent7=Number((insights.data||[]).reduce((n,x)=>n+Number(x.spend||0),0).toFixed(2));
     accounts.push({id:c.id,account_id:c.account_id,name:account.name||c.label,currency:account.currency||'BRL',
        account_status:account.account_status,is_prepay_account:Boolean(account.is_prepay_account),
        billing_balance_minor:account.balance??null,amount_spent_minor:account.amount_spent??null,
        spend_cap_minor:account.spend_cap??null,spend_7d:spent7,
        campaigns:campaignsOut,limited_to_first_100:true});
   }catch(e){accounts.push({id:c.id,account_id:c.account_id,name:c.label,error:e.message,campaigns:[]})}
 }
 return out({connected:true,accounts,manager:canManage(ctx.role),period:'Últimos 7 dias',read_only:true});
}
export async function POST(request){
 let body;try{body=await request.json()}catch{return fail('Dados inválidos.')}
 const org=String(body?.org_id||''),action=String(body?.action||'');
 const ctx=await ctxFor(request,org);if(ctx.error)return fail(ctx.error,ctx.status);
 if(!canManage(ctx.role))return fail('Somente administradores ou gerentes podem alterar contas vinculadas.',403);
 if(action==='disconnect'){
   const id=String(body?.connection_id||'');
   if(!/^[\da-f-]{36}$/i.test(id))return fail('Conta inválida.');
   const {data,error}=await ctx.db.from('nexus_meta_ads_connections').delete().eq('id',id).eq('organization_id',org).select('id').maybeSingle();
   if(error)return fail('Falha ao desvincular a conta.',503);
   return data?out({ok:true,message:'Conta desvinculada do Nexus.'}):fail('Conta não encontrada.',404);
 }
 if(action!=='connect')return fail('Ação desconhecida.');
 const raw=String(body?.account_id||'').replace(/^act_/,'').trim(),token=String(body?.access_token||'').trim();
 if(!/^\d{5,30}$/.test(raw))return fail('Informe o ID numérico da conta de anúncios.');
 if(token.length<20||token.length>6000)return fail('Token Meta inválido.');
 const key=process.env.NEXUS_SECRETS_KEY;
 if(!key)return fail('Configure NEXUS_SECRETS_KEY no servidor.',503);
 let account;
 try{account=await graph('act_'+raw,token,{fields:'id,name,currency,account_status'});}
 catch(e){return fail(e.message,403)}
 const encrypted=sealSecret(token,key);
 const {error}=await ctx.db.from('nexus_meta_ads_connections').upsert({
   organization_id:org,account_id:'act_'+raw,label:String(account.name||'Conta de anúncios').slice(0,90),
   token_ciphertext:encrypted,configured_by:ctx.user.id,updated_at:new Date().toISOString()
 },{onConflict:'organization_id,account_id'});
 if(error)return fail('Não foi possível salvar a conta de anúncios.',503);
 return out({ok:true,message:'Conta vinculada para leitura de resultados; credencial protegida no servidor.'});
}
