import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const origin='http://127.0.0.1:3000';
const server=spawn('npm',['start'],{env:{...process.env,PORT:'3000'},stdio:['ignore','pipe','pipe']});
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
 await browser.close();
 if(failures.length){for(const f of failures)console.error('BROWSER FAILURE:',f);process.exitCode=1;}
 else console.log('Browser smoke passed without page exceptions for unauthenticated routes.');
}catch(e){console.error('Browser diagnostic failed:',e.stack);process.exitCode=1;}
finally{await browser?.close().catch(()=>{});server.kill('SIGTERM');server.stdout.destroy();server.stderr.destroy();}
