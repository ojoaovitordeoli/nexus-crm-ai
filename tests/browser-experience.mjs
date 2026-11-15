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
  // PLAYWRIGHT_EXECUTABLE_PATH permite usar um Chrome já instalado quando o download do Chromium é bloqueado.
  browser=await chromium.launch({headless:true,args:['--no-sandbox'],...(process.env.PLAYWRIGHT_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH}:{})});
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
  // V36: indicação. Bruno indicou a Ana; a venda vinculada ao lead entra no "Quem mais indica".
  const referrerId='5f3a1c2e-8d4b-4c6a-9e7f-1a2b3c4d5e6f';
  const referrer={id:referrerId,first_name:'Bruno',last_name:'Indicador',whatsapp:'5548999993333',created_at:'2026-10-10T12:00:00Z'};
  const lead={id:leadId,organization_id:organizationId,status:'new',source:'Indicação',
    temperature:'warm',created_at:new Date(Date.now()-2*86400000).toISOString(),pipeline_stage_id:null,contact,referred_by_contact_id:referrerId};
  const data={
    leads:[lead],contacts:[contact,referrer],tasks:[{
      id:'92618c31-e9af-41a1-8b48-7e7dac9ae0ef',title:'Retornar para Ana',
      status:'pending',priority:'medium',due_date:'2026-11-04',created_at:'2026-10-25T12:00:00Z'
    }],appointments:[],sales:[{id:'7e1d2c3b-4a5f-4e6d-8c7b-9a0b1c2d3e4f',value:1500,created_at:new Date().toISOString(),
      sale_date:new Date().toISOString(),lead_id:leadId,contact_id:contactId,seller_id:userId,contact}]
  };
  let referralUpdates=0;
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
  let createdTasks=0;let completedTasks=0;let linkedTasks=0;let timelineCalls=0;
  await page.route('**/api/operation**',async route=>{
    if(route.request().method()==='POST'){
      const payload=route.request().postDataJSON();
      if(payload.action==='lead_timeline'){
        timelineCalls+=1;
        if(payload.lead_id!==leadId)return route.fulfill({status:404,contentType:'application/json',body:JSON.stringify({error:'Lead não encontrado nesta empresa.'})});
        return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,warnings:[],truncated:false,events:[
          {id:'task-x',kind:'task',at:'2026-11-02T12:00:00Z',title:'Retorno: Retornar orçamento — Ana Teste',detail:'pendente'},
          {id:'stage-x',kind:'stage_changed',at:'2026-10-21T12:00:00Z',title:'Etapa alterada',detail:'Definida como Novo Lead'},
          {id:'lead-x',kind:'lead_created',at:'2026-10-20T12:00:00Z',title:'Lead cadastrado',detail:'Origem: Instagram'}
        ]})});
      }
      if(payload.action==='lead_update'&&'referred_by_contact_id' in payload)referralUpdates+=1;
      if(payload.action==='task_create')createdTasks+=1;
      if(payload.action==='task_create'&&payload.lead_id===leadId)linkedTasks+=1;
      if(payload.action==='task_status'&&payload.status==='completed')completedTasks+=1;
      return route.fulfill({status:201,contentType:'application/json',body:JSON.stringify({ok:true,message:'Tarefa criada com sucesso.',item:{id:'test-task'}})});
    }
    const response={data,counts:{leads:1,contacts:2,tasks:1,appointments:0,sales:1},
      stages:[],warnings:[],read_only:false,referrals_ready:true};
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  // Optional integrations are not provisioned in CI. Exercise their explicit
  // disconnected states instead of allowing server-side 503 responses to pollute
  // visual regression results.
  await page.route('**/api/whatsapp/inbox**',async route=>{
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({connections:[],messages:[],verified_server:false})});
  });
  await page.route('**/api/crm-settings**',async route=>{
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({can_manage:true,catalogs:{
      lost_reasons:{kind:'lost_reasons',installed:true,items:[]},lead_origins:{kind:'lead_origins',installed:true,items:[]},
      contact_categories:{kind:'contact_categories',installed:false,items:[]},company_sectors:{kind:'company_sectors',installed:false,items:[]}},
      fields:[],pipelines:[],stages:[],requirements:[]})});
  });
  await page.route('**/api/team**',async route=>{
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({members:[
      {id:'m1',user_id:userId,role:'AGENCY_ADMIN',role_label:'Admin da agência',status:'active',full_name:'Operador de Teste',email:'test@example.invalid',is_me:true,editable:false}
    ],can_assign:[{value:'SELLER',label:'Vendedor'}]})});
  });
  // Avisos fictícios SÓ dentro do teste, para validar layout e ações da aba Prospecção (V34).
  let prospStatusCalls=0;
  await page.route('**/api/prospecting-alerts**',async route=>{
    if(route.request().method()==='POST'){
      const payload=route.request().postDataJSON();
      if(payload.action==='status')prospStatusCalls+=1;
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,message:'Situação atualizada.'})});
    }
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({connection:{active:true,hint:'Ab12Cd',last_used_at:'2026-11-14T13:05:00Z'},
      totals:{available:true,lines:[{channel:'email',label:'E-mail',sent:600,replied:18,interested:6,sales:2,revenue:594,measured_at:'2026-11-14T13:00:00Z'},
        {channel:'whatsapp',label:'WhatsApp',sent:40,replied:9,interested:3,sales:1,revenue:997,measured_at:'2026-11-14T13:00:00Z'}],
        total:{channel:'total',label:'Total',sent:640,replied:27,interested:9,sales:3,revenue:1591,measured_at:null}},alerts:[
      {id:'11111111-1111-4111-8111-111111111111',source:'harvey_email',channel:'email',kind:'interesse',kind_label:'Interesse',status:'novo',status_label:'Novo',
        company_name:'Ótica Exemplo',contact_name:'Pessoa Teste',contact_email:'contato@example.invalid',contact_phone:'5548999990000',
        whatsapp_url:'https://wa.me/5548999990000',mail_url:'mailto:contato@example.invalid',message:'Tenho interesse, pode me mandar os valores?',occurred_at:'2026-11-14T12:00:00Z'},
      {id:'22222222-2222-4222-8222-222222222222',source:'whatsapp_agent',channel:'whatsapp',kind:'venda',kind_label:'Venda',status:'em_atendimento',status_label:'Em atendimento',
        company_name:'Clínica Exemplo',contact_name:'',contact_email:'',contact_phone:'5548999992222',whatsapp_url:'https://wa.me/5548999992222',mail_url:null,
        message:'Fechou o plano anual pelo WhatsApp.',occurred_at:'2026-11-13T09:30:00Z'}]})});
  });
  await page.route('**/api/automations**',async route=>{
    return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({rules:[],executions:[],can_manage:true})});
  });
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
  await page.keyboard.press('Control+k'); // atalho segue ativo; o botão saiu do topo na V27
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
  await page.screenshot({path:'test-artifacts/dashboard-v14-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Nova tarefa'}).click();
  await page.locator('.v14-compose input[placeholder="Ex.: Retornar orçamento"]').fill('Confirmar orçamento');
  await page.locator('.v14-compose button[type="submit"]').click();
  for(let k=0;k<40&&createdTasks!==1;k++)await sleep(100); // aguarda a requisição em vez de checar no mesmo tick
  if(createdTasks!==1)throw new Error('Dashboard did not create the task through the operation API');
  await page.getByRole('button',{name:'Concluir Retornar para Ana'}).click();
  for(let k=0;k<40&&completedTasks!==1;k++)await sleep(100);
  if(completedTasks!==1)throw new Error('Dashboard did not complete the task through the operation API');
  for(const [route,file] of [['leads','leads-desktop'],['contacts','contacts-desktop'],['sales','sales-desktop']]){
    await page.goto(host+'/'+route,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(500);
    if(await page.getByText('Application error: a client-side exception',{exact:false}).count())throw new Error('Client exception on '+route);
    await page.screenshot({path:'test-artifacts/'+file+'.png',fullPage:true});
    if(route==='leads'){
      const search=page.getByRole('searchbox',{name:'Pesquisar leads'});
      await search.fill('não existe');
      await page.getByText('Nenhum lead encontrado').waitFor({timeout:5000});
      await search.fill('Ana');
      await page.getByRole('region',{name:'Ficha de Ana Teste'}).waitFor({timeout:5000});
      if(await page.getByRole('combobox',{name:'Ordenar leads'}).count())throw new Error('Filtro de ordenação voltou (removido na V27)');
      const downloadPromise=page.waitForEvent('download');
      await page.getByRole('button',{name:'Exportar'}).click();
      const download=await downloadPromise;
      if(!download.suggestedFilename().endsWith('.csv'))throw new Error('Export did not create CSV');
      const detail=page.getByRole('region',{name:'Ficha de Ana Teste'});
      // V36: indicação na ficha, na edição e no formulário de novo lead.
      await detail.getByText('Bruno Indicador').waitFor({timeout:5000});
      await detail.getByRole('button',{name:'Editar valor, origem e indicação'}).click();
      const refSelect=detail.getByRole('combobox',{name:'Indicado por'});
      if(await refSelect.inputValue()!==referrerId)throw new Error('Edição não carregou quem indicou');
      if(await refSelect.locator('option',{hasText:'Ana Teste'}).count())throw new Error('O próprio contato aparece como indicador');
      await refSelect.selectOption('');
      await detail.getByRole('button',{name:'Salvar'}).click();
      for(let k=0;k<40&&!referralUpdates;k++)await sleep(100);
      if(referralUpdates!==1)throw new Error('Edição da indicação não enviou referred_by_contact_id');
      await page.getByRole('button',{name:'Novo lead'}).click();
      await page.getByRole('combobox',{name:'Contato que indicou este lead'}).waitFor({timeout:5000});
      await page.getByRole('button',{name:'Fechar',exact:true}).first().click();
      await detail.getByRole('tab',{name:'Retorno'}).click();
      await detail.getByRole('textbox',{name:'O que precisa ser feito?'}).fill('Retornar orçamento');
      await detail.getByRole('button',{name:'Adicionar tarefa'}).click();
      await detail.getByText('Tarefa criada com sucesso.').waitFor({timeout:5000});
      if(createdTasks!==2)throw new Error('Lead workspace did not create follow-up');
      if(linkedTasks!==1)throw new Error('Follow-up from lead desk was not linked by lead_id');
      await detail.getByRole('tab',{name:'Atividade'}).click();
      await detail.getByText('Retorno: Retornar orçamento — Ana Teste').waitFor({timeout:5000});
      await detail.getByText('Definida como Novo Lead',{exact:false}).waitFor({timeout:5000});
      if(timelineCalls<1)throw new Error('Activity tab did not request persisted timeline');
      await page.screenshot({path:'test-artifacts/leads-v17-timeline.png',fullPage:true});
      await detail.getByRole('tab',{name:'Retorno'}).click();
      await page.screenshot({path:'test-artifacts/leads-v13-split-desk.png',fullPage:true});
      await detail.getByRole('button',{name:'Fechar ficha'}).click();
      await page.getByRole('button',{name:/Ana Teste/}).click();
      await detail.waitFor({timeout:5000});
      await page.getByRole('button',{name:/Quadro/}).click();
      const hint=page.locator('.w10-kanban-notice');
      await hint.waitFor({timeout:7000});
      if(await page.locator('.w10-kanban-setup').count())throw new Error('Old oversized Kanban configuration panel still visible');
      await hint.getByRole('button',{name:/Configurar funil/}).click();
      await page.getByRole('dialog',{name:'Configurar funil de vendas'}).waitFor({timeout:5000});
      await page.getByRole('dialog',{name:'Configurar funil de vendas'}).getByRole('button',{name:'Fechar',exact:true}).first().click();
      await page.getByRole('button',{name:'Lista'}).click();
      await page.locator('.nx13-layout').waitFor({timeout:5000});
      await page.setViewportSize({width:390,height:844});
      await page.waitForTimeout(200);
      if(await page.evaluate(()=>document.documentElement.scrollWidth)>395)throw new Error('Leads page horizontal overflow mobile');
      await page.screenshot({path:'test-artifacts/leads-v13-mobile.png',fullPage:true});
      await page.setViewportSize({width:1440,height:900});
    }
  }
  await page.goto(host+'/reports',{waitUntil:'domcontentloaded'});
  const refBox=page.getByRole('region',{name:'Quem mais indica'});
  await refBox.waitFor({timeout:10000});
  await refBox.getByText('Bruno Indicador').waitFor({timeout:5000});
  if(!await refBox.getByText('1 virou venda',{exact:false}).count())throw new Error('Ranking de indicação sem a venda vinculada');
  for(const [w,h,name] of [[768,1024,'tablet'],[390,844,'mobile']]){
    await page.setViewportSize({width:w,height:h});await sleep(250);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(overflow>1)throw new Error('Relatórios com rolagem horizontal em '+w+'px ('+overflow+'px)');
    await page.screenshot({path:'test-artifacts/reports-indicacao-'+name+'.png',fullPage:true});
  }
  await page.setViewportSize({width:1440,height:900});
  for(const route of ['tasks','agenda','reports','settings','whatsapp','automations']){
    await page.goto(host+'/'+route,{waitUntil:'domcontentloaded'});
    await page.waitForTimeout(550);
    if(await page.getByText('Application error: a client-side exception',{exact:false}).count()){
      throw new Error('Client exception on extended route: '+route);
    }
    await page.screenshot({path:'test-artifacts/'+route+'-desktop.png',fullPage:true});
  }
  await page.goto(host+'/prospeccao',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:'Prospecção'}).waitFor({timeout:12000});
  await page.getByText('Ótica Exemplo').first().waitFor({timeout:8000});
  await page.getByRole('heading',{name:'Números da prospecção'}).waitFor({timeout:5000});
  if(!await page.getByText('R$ 1.591').count())throw new Error('Total vendido do quadro não aparece');
  const waLink=page.getByRole('link',{name:/Abrir no WhatsApp/}).first();
  if(await waLink.getAttribute('href')!=='https://wa.me/5548999990000')throw new Error('Link do WhatsApp da prospecção incorreto');
  if(!await page.getByRole('link',{name:/Prospecção/}).count())throw new Error('Menu Prospecção não aparece para o admin');
  await page.getByLabel(/Situação do aviso de Ótica Exemplo/).selectOption('resolvido');
  for(let k=0;k<20&&!prospStatusCalls;k++)await sleep(100);
  if(!prospStatusCalls)throw new Error('Mudança de situação não chamou a API');
  for(const [w,h,name] of [[1440,900,'desktop'],[768,1024,'tablet'],[390,844,'mobile']]){
    await page.setViewportSize({width:w,height:h});await sleep(250);
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    if(overflow>1)throw new Error('Prospecção com rolagem horizontal em '+w+'px ('+overflow+'px)');
    await page.screenshot({path:'test-artifacts/prospeccao-'+name+'.png',fullPage:true});
  }
  await page.setViewportSize({width:1440,height:900});
  await page.goto(host+'/dashboard',{waitUntil:'domcontentloaded'});
  await page.getByRole('heading',{name:/Visão geral/}).waitFor();
  await page.waitForTimeout(400);
  const themeAndFonts=await page.evaluate(()=>{
    const heading=document.querySelector('.v14-hero h1');
    const body=document.body;
    return {dark:body.classList.contains('dark'),font:heading?getComputedStyle(heading).fontFamily:'',glass:getComputedStyle(document.documentElement).getPropertyValue('--glass-bg').trim()};
  });
  if(themeAndFonts.dark)throw new Error('Light theme must be the default for a new workspace');
  if(!themeAndFonts.font.includes('Archivo'))throw new Error('Dashboard titles are not using Archivo (tema Fluxo): '+themeAndFonts.font);
  if(!await page.locator('.v14-tasks-panel .v14-rows').count())throw new Error('Operational task list missing');
  await page.screenshot({path:'test-artifacts/dashboard-dark.png',fullPage:true});
  if(!await page.locator('.v14-stats').count())throw new Error('V14 metrics section missing');
  if(!await page.locator('.v14-workgrid').count())throw new Error('V14 actionable work section missing');
  if(!await page.locator('.fx-funnel').count())throw new Error('Funnel overview missing');
  if(await page.locator('.v16-brief').count())throw new Error('Duplicated task summary (removed in V26) is back');
  if(await page.locator('.v14-hero-motif').count())throw new Error('Legacy decorative hero motif still present');
  if(await page.locator('.n9-kpi').count())throw new Error('Legacy KPI template still visible');
  await page.getByRole('button',{name:'Vencidas'}).click();
  await page.getByRole('button',{name:'Em aberto'}).click();
  // V27: topo enxuto — busca e notificações. Tema fica em Configurações; dados atualizam sozinhos.
  for(const name of ['Alternar tema','Atualizar dados','Abrir paleta de comandos Ctrl K','Iniciar tour do CRM'])
    if(await page.getByRole('button',{name}).count())throw new Error('Topbar voltou a ter o botão: '+name);
  if(await page.locator('.staff-nav-title').count())throw new Error('Menu voltou a ter títulos de grupo');
  await page.screenshot({path:'test-artifacts/dashboard-light.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(450);
  await page.getByRole('heading',{name:/Visão geral/}).waitFor();
  const pageWidth=await page.evaluate(()=>document.documentElement.scrollWidth);
  if(pageWidth>395)throw new Error('Dashboard overflows 390px mobile viewport: '+pageWidth);
  await page.screenshot({path:'test-artifacts/dashboard-mobile.png',fullPage:true});
  await page.keyboard.press('Control+k');
  await dialog.waitFor({state:'visible'});
  await page.waitForTimeout(650); // capture fully opaque command dialog, not entry animation
  const bounds=await dialog.boundingBox();
  if(!bounds||bounds.x<0||bounds.x+bounds.width>400)throw new Error('Command dialog overflows mobile viewport');
  await page.screenshot({path:'test-artifacts/command-mobile.png'});
  console.log('PASS: login transitions, authenticated dashboard, Ctrl+K, search, menu click, task shortcut, mobile dialog');
  if(errors.length)throw new Error(errors.join('\n').slice(0,2500));
}catch(e){
  console.error('BROWSER SMOKE FAILED:',e.stack||e);
  console.error('OTHER ERRORS:',errors.join('\n'));
  process.exitCode=1;
}finally{
  await browser?.close().catch(()=>{});
  app.kill('SIGTERM');app.stdout.destroy();app.stderr.destroy();
}
