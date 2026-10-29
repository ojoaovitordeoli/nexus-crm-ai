import {spawn} from 'node:child_process';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const host='http://127.0.0.1:3000';
const app=spawn(process.execPath,['node_modules/next/dist/bin/next','start'],{
  env:{...process.env,PORT:'3000'},stdio:['ignore','pipe','pipe']
});
let serverOutput='';
app.stdout.on('data',v=>serverOutput+=v.toString());
app.stderr.on('data',v=>serverOutput+=v.toString());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){
  for(let k=0;k<70;k++){
    if(app.exitCode!==null)throw new Error('Next stopped: '+serverOutput.slice(-1200));
    try{const r=await fetch(host+'/login');if(r.status===200)return}catch{}
    await sleep(1000);
  }
  throw new Error('Next did not start: '+serverOutput.slice(-1200));
}
const errors=[];
let browser;
try{
  await ready();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'pt-BR'});
  const page=await ctx.newPage();
  page.on('pageerror',e=>errors.push('Page exception: '+e.stack));
  page.on('console',m=>{if(m.type()==='error'&&!/favicon/i.test(m.text()))errors.push('Console: '+m.text())});
  await page.goto(host+'/login',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Bem-vindo de volta'}).waitFor();
  await page.getByRole('button',{name:'Esqueci minha senha'}).click();
  await page.getByRole('heading',{name:'Recuperar acesso'}).waitFor({timeout:5000});
  await page.getByRole('button',{name:'Voltar ao login'}).click();
  await page.getByRole('heading',{name:'Bem-vindo de volta'}).waitFor({timeout:5000});

  const userId='d44b4e72-3279-4477-8c1e-e3d14dc3ee99';
  const organizationId='73bf7bcb-9b3a-427e-9851-a892e17328de';
  const contactId='c976b347-e4c2-4bef-8b77-00ed16f46883';
  const leadId='c8b1b747-0e46-4c32-80a1-938afde9ae66';
  const user={id:userId,aud:'authenticated',role:'authenticated',email:'test@example.invalid',
    app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
  const profile={id:userId,full_name:'Operador de Teste',is_super_admin:false,status:'active'};
  const organization={id:organizationId,name:'Empresa de Teste',status:'active',plan:'test'};
  const contact={id:contactId,first_name:'Ana',last_name:'Teste',whatsapp:'5548999991111',created_at:'2026-10-20T12:00:00Z'};
  const lead={id:leadId,organization_id:organizationId,status:'new',source:'Instagram',
    temperature:'warm',created_at:'2026-10-20T12:00:00Z',pipeline_stage_id:null,contact};
  const data={
    leads:[lead],contacts:[contact],tasks:[{
      id:'92618c31-e9af-41a1-8b48-7e7dac9ae0ef',title:'Retornar para Ana',
      status:'pending',priority:'medium',due_date:'2026-11-04',created_at:'2026-10-25T12:00:00Z'
    }],appointments:[],sales:[]
  };
  await page.route('https://qhizuqcdxivdvjtefofz.supabase.co/**',async route=>{
    const url=new URL(route.request().url());
    const table=url.pathname.split('/').pop();
    const headers={'access-control-allow-origin':'*','content-type':'application/json'};
    if(url.pathname.startsWith('/auth/v1/user'))
      return route.fulfill({status:200,headers,body:JSON.stringify(user)});
    const rows=table==='profiles'?(url.searchParams.has('id')?profile:[profile]):
      table==='organization_members'?[{organization_id:organizationId,role:'AGENCY_ADMIN',status:'active',organization}]:
      table==='organizations'?[organization]:[];
    return route.fulfill({status:200,headers,body:JSON.stringify(rows)});
  });
  await page.route('**/api/operation**',async route=>{
    const response={data,counts:{leads:1,contacts:1,tasks:1,appointments:0,sales:0},
      stages:[],warnings:[],read_only:false};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.route('**/api/personal-ai**',async route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({threads:[],configured:false})
  }));
  await page.route('**/api/meta-ads**',async route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({accounts:[],manager:true,connected:false})
  }));
  await page.route('**/api/direct-whatsapp**',async route=>route.fulfill({
    status:200,contentType:'application/json',body:JSON.stringify({connections:[],bridge_configured:false})
  }));
  const jwt=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
  const token=[jwt({alg:'HS256',typ:'JWT'}),jwt({sub:userId,role:'authenticated',aud:'authenticated',exp:2000000000}),'mock'].join('.');
  await page.evaluate(({user,token})=>{
    localStorage.setItem('sb-qhizuqcdxivdvjtefofz-auth-token',JSON.stringify({
      access_token:token,token_type:'bearer',expires_in:99999999,
      expires_at:2000000000,refresh_token:'fake-refresh-token',user
    }));
  },{user,token});
  await page.goto(host+'/dashboard',{waitUntil:'domcontentloaded'});
  await page.getByText('Operador de Teste',{exact:false}).first().waitFor({timeout:12000});
  await page.getByText('Ana Teste',{exact:false}).first().waitFor({timeout:12000});
  if(await page.getByText('Application error: a client-side exception',{exact:false}).count())
    throw new Error('React client exception while rendering dashboard');
  await page.keyboard.press('Control+k');
  const dialog=page.getByRole('dialog',{name:'Central de Comandos NEXUS'});
  await dialog.waitFor({state:'visible',timeout:5000});
  const search=dialog.getByRole('combobox');
  await search.fill('Ana Teste');
  await dialog.getByText('Ana Teste',{exact:false}).first().waitFor({timeout:5000});
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden',timeout:5000});
  await page.getByRole('button',{name:'Abrir paleta de comandos Ctrl K'}).click();
  await dialog.waitFor({state:'visible'});
  await search.fill('Minhas tarefas');
  await dialog.getByText('Minhas tarefas',{exact:true}).first().click();
  await page.waitForURL('**/tasks',{timeout:8000});
  await page.getByText('Retornar para Ana',{exact:false}).first().waitFor({timeout:10000});
  await page.keyboard.press('Control+k');
  await dialog.waitFor({state:'visible'});
  await search.fill('Criar nova tarefa');
  await dialog.getByText('Criar nova tarefa',{exact:true}).first().click();
  await page.locator('input[aria-label="Título da tarefa"]').waitFor({timeout:6000});
  mkdirSync('test-artifacts',{recursive:true});
  await page.goto(host+'/dashboard',{waitUntil:'domcontentloaded'});
  await page.getByText('Operador de Teste',{exact:false}).first().waitFor();
  await page.waitForTimeout(2800); // allow staged cards/charts to reach their final state
  await page.screenshot({path:'test-artifacts/dashboard-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.keyboard.press('Control+k');
  await dialog.waitFor({state:'visible'});
  await page.waitForTimeout(650); // capture fully opaque command dialog, not entry animation
  const bounds=await dialog.boundingBox();
  if(!bounds||bounds.x<0||bounds.x+bounds.width>400)throw new Error('Command dialog overflows mobile viewport');
  await page.screenshot({path:'test-artifacts/command-mobile.png'});
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1440,height:900});
  await page.goto(host+'/insights',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Seu copiloto de trabalho.'}).waitFor({timeout:12000});
  await page.screenshot({path:'test-artifacts/ai-chat.png',fullPage:true});
  await page.goto(host+'/ads',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Visão dos anúncios.'}).waitFor({timeout:12000});
  await page.screenshot({path:'test-artifacts/meta-ads.png',fullPage:true});
  await page.goto(host+'/whatsapp',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Seu WhatsApp dentro do CRM.'}).waitFor({timeout:12000});
  await page.screenshot({path:'test-artifacts/direct-whatsapp.png',fullPage:true});
  console.log('PASS: login, command center, mobile and three new integration screens');
  if(errors.length)throw new Error(errors.join('\n').slice(0,2500));
}catch(e){
  console.error('BROWSER SMOKE FAILED:',e.stack||e);
  console.error('OTHER ERRORS:',errors.join('\n'));
  process.exitCode=1;
}finally{
  await browser?.close().catch(()=>{});
  app.kill('SIGTERM');app.stdout.destroy();app.stderr.destroy();
}
