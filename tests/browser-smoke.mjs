import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:3000';
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start'],{env:{...process.env,PORT:'3000'},stdio:['ignore','pipe','pipe']});
let serverLog='';
server.stdout.on('data',b=>{serverLog+=b.toString();});
server.stderr.on('data',b=>{serverLog+=b.toString();});
async function waitForServer(){
 for(let n=0;n<90;n++){
  if(server.exitCode!==null)throw Error('Server exited: '+serverLog.slice(-1000));
  try{const r=await fetch(origin+'/login');if(r.status===200)return}catch{}
  await new Promise(r=>setTimeout(r,1000));
 }
 throw Error('Timeout starting server: '+serverLog.slice(-1000));
}
let browser;
let failures=[];
try{
 await waitForServer();
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR'});
 const page=await context.newPage();
 page.on('pageerror',e=>failures.push('Page exception: '+e.stack));
 page.on('console',e=>{if(e.type()==='error')failures.push('Console: '+e.text());});
 page.on('requestfailed',req=>{
  if(req.url().startsWith(origin)&&!req.failure()?.errorText?.includes('ERR_ABORTED'))
   failures.push('Request failed: '+req.url()+' '+req.failure()?.errorText);
 });
 for(const url of ['/login','/dashboard','/admin']){
  const before=failures.length;
  const response=await page.goto(origin+url,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(2300);
  const detail=await page.evaluate(()=>({title:document.title,body:document.body?.innerText?.slice(0,350),url:location.pathname}));
  console.log(JSON.stringify({route:url,status:response?.status(),loaded:detail,errorCount:failures.length-before}));
  const content=detail.body||'';
  if(/Application error: a client-side exception has occurred/i.test(content))
    failures.push('Application error displayed on '+url);
  if((response?.status()||0)>=500)failures.push('HTTP 5xx loading '+url);
 }
 // Simulate an authorized user using test-only, fake Supabase responses.
 // This detects crashes in the operational workspace that the login smoke cannot see.
 const fakeUserId='d44b4e72-3279-4477-8c1e-e3d14dc3ee99';
 const fakeOrgId='73bf7bcb-9b3a-427e-9851-a892e17328de';
 const fakeUser={id:fakeUserId,aud:'authenticated',role:'authenticated',email:'teste@example.invalid',
  app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
 const profile={id:fakeUserId,full_name:'Usuário de Teste',is_super_admin:false,status:'active'};
 const org={id:fakeOrgId,name:'Empresa de Teste',status:'active',plan:'test'};
 await page.route('https://qhizuqcdxivdvjtefofz.supabase.co/**',async route=>{
  const req=route.request();
  const url=new URL(req.url());
  const name=url.pathname.split('/').pop();
  const headers={'access-control-allow-origin':'*','content-type':'application/json'};
  if(url.pathname.startsWith('/auth/v1/user'))
    return route.fulfill({status:200,headers,body:JSON.stringify(fakeUser)});
  const records=name==='profiles'?
    (url.searchParams.has('id')?profile:[profile]):
    name==='organization_members'?[{organization_id:fakeOrgId,role:'AGENCY_ADMIN',status:'active',organization:org}]:
    name==='organizations'?[org]:[];
  return route.fulfill({status:200,headers,body:JSON.stringify(records)});
 });
 const jwtPart=obj=>Buffer.from(JSON.stringify(obj)).toString('base64url');
 const fakeToken=[jwtPart({alg:'HS256',typ:'JWT'}),jwtPart({sub:fakeUserId,role:'authenticated',aud:'authenticated',exp:2000000000}),'test'].join('.');
 await page.goto(origin+'/login');
 await page.evaluate(({user,token})=>{
  const session={access_token:token,token_type:'bearer',expires_in:99999999,
   expires_at:2000000000,refresh_token:'mock-refresh-token',user};
  localStorage.setItem('sb-qhizuqcdxivdvjtefofz-auth-token',JSON.stringify(session));
 },{user:fakeUser,token:fakeToken});
 const errorsBefore=failures.length;
 const signedResponse=await page.goto(origin+'/dashboard',{waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(3400);
 const signed=await page.evaluate(()=>({body:document.body?.innerText?.slice(0,600),url:location.pathname}));
 console.log(JSON.stringify({route:'/dashboard (mock signed-in user)',status:signedResponse?.status(),signed,errorCount:failures.length-errorsBefore}));
 if(/Application error: a client-side exception has occurred/i.test(signed.body))
   failures.push('Client exception on authenticated dashboard');
 if(!signed.body?.includes('Visão geral')&&!signed.body?.includes('Workspace'))
   failures.push('Authenticated workspace did not render');

 await browser.close();
 if(failures.length){for(const f of failures)console.error('BROWSER FAILURE:',f);process.exitCode=1;}
 else console.log('Browser smoke passed without page exceptions for unauthenticated routes.');
}catch(e){console.error('Browser diagnostic failed:',e.stack);process.exitCode=1;}
finally{await browser?.close().catch(()=>{});server.kill('SIGTERM');server.stdout.destroy();server.stderr.destroy();}
