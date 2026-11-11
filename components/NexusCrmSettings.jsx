'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Check,ListChecks,Loader2,Pencil,Plus,RotateCcw,Trash2,Wand2,X} from 'lucide-react';
import {db} from '../lib/supabase';

// Cadastros do funil: o que o Agendor chama de "Configurações" (funis e etapas,
// motivos de perda, origens, categorias, setores e campos de formulário).
const TABS=[
  {id:'stages',label:'Etapas e campos obrigatórios'},
  {id:'lost_reasons',label:'Motivos de perda'},
  {id:'lead_origins',label:'Origens'},
  {id:'contact_categories',label:'Categorias'},
  {id:'company_sectors',label:'Setores'},
  {id:'fields',label:'Campos extras'}
];
const HINT={
  lost_reasons:'Aparecem quando um negócio é perdido. Mostram onde o processo pode melhorar.',
  lead_origins:'De onde o cliente veio. Usado no cadastro do lead e nos relatórios por origem.',
  contact_categories:'Agrupam as pessoas da carteira.',
  company_sectors:'Classificam a empresa do cliente.'
};
const CORE={source:'Origem',estimated_value:'Valor total',products:'Produtos e serviços',lost_reason:'Motivo da perda',closed_at:'Data de conclusão'};
const TYPES={text:'Texto',number:'Número',currency:'Valor (R$)',checkbox:'Marcar (sim/não)',select:'Lista (uma opção)',multiselect:'Lista (várias)',date:'Data',phone:'Telefone',email:'E-mail'};

async function call(organizationId,body){
  const {data:{session}}=await db.auth.getSession();
  if(!session?.access_token)throw new Error('Sua sessão expirou. Entre novamente.');
  const res=await fetch('/api/crm-settings'+(body?'':'?org_id='+encodeURIComponent(organizationId)),{
    method:body?'POST':'GET',cache:'no-store',
    headers:{Authorization:'Bearer '+session.access_token,...(body?{'Content-Type':'application/json'}:{})},
    body:body?JSON.stringify({org_id:organizationId,...body}):undefined
  });
  const out=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(out.error||'Não foi possível concluir.');
  return out;
}

function CatalogList({kind,catalog,canManage,run,busy}){
  const [name,setName]=useState('');const [editing,setEditing]=useState(null);const [draft,setDraft]=useState('');
  const [showInactive,setShowInactive]=useState(false);
  if(!catalog?.installed)return <p className="nxs-empty">Este cadastro ainda não está instalado no banco. A migração de categorias e setores precisa ser aplicada.</p>;
  const items=catalog.items.filter(i=>showInactive||i.is_active);
  const inactive=catalog.items.filter(i=>!i.is_active).length;
  return <div className="nxs-catalog">
    <p className="nxs-hint">{HINT[kind]}</p>
    {canManage&&<form className="nxs-add" onSubmit={async e=>{e.preventDefault();if(await run({action:'catalog_add',kind,name}))setName('')}}>
      <label className="nxs-sr" htmlFor={'add-'+kind}>Novo item</label>
      <input id={'add-'+kind} value={name} onChange={e=>setName(e.target.value)} placeholder="Novo item" maxLength={120}/>
      <button type="submit" className="nxs-btn nxs-btn--primary" disabled={busy||!name.trim()}><Plus size={16}/> Adicionar</button>
    </form>}
    {items.length?<ul className="nxs-list">
      {items.map(item=><li key={item.id} className={item.is_active?'':'is-off'}>
        {editing===item.id
          ?<form className="nxs-inline" onSubmit={async e=>{e.preventDefault();if(await run({action:'catalog_update',kind,id:item.id,name:draft}))setEditing(null)}}>
             <input aria-label="Nome" value={draft} onChange={e=>setDraft(e.target.value)} autoFocus maxLength={120}/>
             <button type="submit" className="nxs-icon" aria-label="Salvar" disabled={busy||!draft.trim()}><Check size={16}/></button>
             <button type="button" className="nxs-icon" aria-label="Cancelar" onClick={()=>setEditing(null)}><X size={16}/></button>
           </form>
          :<span>{item.name}{!item.is_active&&<small> · desativado</small>}</span>}
        {canManage&&editing!==item.id&&<div className="nxs-row-actions">
          {item.is_active
            ?<><button type="button" className="nxs-icon" aria-label={'Renomear '+item.name} onClick={()=>{setEditing(item.id);setDraft(item.name)}}><Pencil size={15}/></button>
               <button type="button" className="nxs-icon" aria-label={'Desativar '+item.name} disabled={busy} onClick={()=>run({action:'catalog_delete',kind,id:item.id})}><Trash2 size={15}/></button></>
            :<button type="button" className="nxs-icon" aria-label={'Reativar '+item.name} disabled={busy} onClick={()=>run({action:'catalog_update',kind,id:item.id,is_active:true})}><RotateCcw size={15}/></button>}
        </div>}
      </li>)}
    </ul>:<p className="nxs-empty">Nenhum item cadastrado.</p>}
    <footer className="nxs-foot"><span>{catalog.items.filter(i=>i.is_active).length} ativos</span>
      {inactive>0&&<button type="button" className="nxs-link" onClick={()=>setShowInactive(v=>!v)}>{showInactive?'Ocultar':'Mostrar'} {inactive} desativado{inactive>1?'s':''}</button>}</footer>
  </div>;
}

function FieldsTab({fields,canManage,run,busy}){
  const blank={name:'',type:'text',entity_type:'lead',options:''};
  const [form,setForm]=useState(null);
  const group=e=>fields.filter(f=>f.entity_type===e);
  return <div className="nxs-catalog">
    <p className="nxs-hint">Campos que não existem no cadastro padrão. Os campos do negócio podem ser exigidos ao mudar de etapa.</p>
    {canManage&&!form&&<button type="button" className="nxs-btn nxs-btn--primary" onClick={()=>setForm(blank)}><Plus size={16}/> Novo campo</button>}
    {form&&<form className="nxs-field-form" onSubmit={async e=>{e.preventDefault();if(await run({action:'field_save',field:form}))setForm(null)}}>
      <label>Nome<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} maxLength={80} required/></label>
      <label>Tipo<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{Object.entries(TYPES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <label>Onde aparece<select value={form.entity_type} disabled={Boolean(form.id)} onChange={e=>setForm({...form,entity_type:e.target.value})}><option value="lead">Negócio</option><option value="contact">Pessoa</option></select></label>
      {(form.type==='select'||form.type==='multiselect')&&<label className="nxs-wide">Opções (uma por linha)<textarea rows={3} value={form.options} onChange={e=>setForm({...form,options:e.target.value})}/></label>}
      <div className="nxs-wide nxs-form-actions"><button type="button" className="nxs-btn" onClick={()=>setForm(null)}>Cancelar</button><button type="submit" className="nxs-btn nxs-btn--primary" disabled={busy}>Salvar campo</button></div>
    </form>}
    {[['lead','Negócio'],['contact','Pessoa']].map(([e,label])=><section key={e} className="nxs-group">
      <h4>{label} <small>{group(e).length}</small></h4>
      {group(e).length?<ul className="nxs-list">{group(e).map(f=><li key={f.id}>
        <span>{f.name}<small> · {TYPES[f.type]||f.type}{f.options?.length?' · '+f.options.join(', '):''}</small></span>
        {canManage&&<div className="nxs-row-actions"><button type="button" className="nxs-icon" aria-label={'Editar '+f.name} onClick={()=>setForm({...f,options:(f.options||[]).join('\n')})}><Pencil size={15}/></button></div>}
      </li>)}</ul>:<p className="nxs-empty">Nenhum campo extra.</p>}
    </section>)}
  </div>;
}

function StagesTab({data,canManage,run,busy}){
  const [pipelineId,setPipelineId]=useState('');
  const [editing,setEditing]=useState(null);const [draft,setDraft]=useState([]);
  const pipeline=data.pipelines.find(p=>p.id===pipelineId)||data.pipelines.find(p=>p.is_default)||data.pipelines[0];
  const stages=data.stages.filter(s=>s.pipeline_id===pipeline?.id);
  const leadFields=data.fields.filter(f=>f.entity_type==='lead');
  const fieldName=id=>leadFields.find(f=>f.id===id)?.name||'Campo removido';
  const reqsOf=id=>data.requirements.filter(r=>r.stage_id===id);
  const label=r=>r.core_field?CORE[r.core_field]:fieldName(r.custom_field_id);
  const options=[...Object.entries(CORE).map(([k,v])=>({key:'core:'+k,label:v,core_field:k})),...leadFields.map(f=>({key:'cf:'+f.id,label:f.name,custom_field_id:f.id}))];
  if(!data.pipelines.length)return <p className="nxs-empty">Nenhum funil criado. Use “Aplicar modelo Agendor” ou crie um funil em Leads → Configurar funil.</p>;
  return <div className="nxs-catalog">
    <p className="nxs-hint">Ao mover um negócio para a etapa, o sistema pede estes campos antes de salvar. É a mesma regra do Agendor.</p>
    {data.pipelines.length>1&&<label className="nxs-pipe">Funil <select value={pipeline?.id||''} onChange={e=>{setPipelineId(e.target.value);setEditing(null)}}>
      {data.pipelines.map(p=><option key={p.id} value={p.id}>{p.name}{p.is_default?' (padrão)':''}</option>)}</select></label>}
    <ol className="nxs-stages">
      {stages.map((s,i)=><li key={s.id}>
        <div className="nxs-stage-head">
          <span className="nxs-stage-n">{String(i+1).padStart(2,'0')}</span>
          <div><strong>{s.name}</strong><small>{s.idle_days?'Tempo limite: '+s.idle_days+(s.idle_days>1?' dias':' dia'):'Sem tempo limite'}{s.is_won?' · ganho':''}{s.is_lost?' · perdido':''}</small></div>
          {canManage&&editing!==s.id&&<button type="button" className="nxs-btn nxs-btn--sm" onClick={()=>{setEditing(s.id);setDraft(reqsOf(s.id).map(r=>r.core_field?'core:'+r.core_field:'cf:'+r.custom_field_id))}}><ListChecks size={15}/> Campos obrigatórios</button>}
        </div>
        {editing===s.id
          ?<div className="nxs-req-edit">
             {options.map(o=><label key={o.key} className="nxs-check"><input type="checkbox" checked={draft.includes(o.key)} onChange={e=>setDraft(d=>e.target.checked?[...d,o.key]:d.filter(x=>x!==o.key))}/>{o.label}</label>)}
             <div className="nxs-form-actions"><button type="button" className="nxs-btn" onClick={()=>setEditing(null)}>Cancelar</button>
               <button type="button" className="nxs-btn nxs-btn--primary" disabled={busy} onClick={async()=>{
                 const items=draft.map(k=>options.find(o=>o.key===k)).filter(Boolean).map(o=>({core_field:o.core_field||null,custom_field_id:o.custom_field_id||null}));
                 if(await run({action:'requirements_save',stage_id:s.id,items}))setEditing(null)}}>Salvar</button></div>
           </div>
          :<p className="nxs-reqs">{reqsOf(s.id).length?reqsOf(s.id).map(r=><span key={r.id} className="nxs-chip">{label(r)}</span>):<span className="nxs-muted">Nenhum campo obrigatório</span>}</p>}
      </li>)}
    </ol>
  </div>;
}

export default function NexusCrmSettings({organizationId}){
  const [tab,setTab]=useState('stages');
  const [data,setData]=useState(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);const inFlight=useRef(false);
  const load=useCallback(async()=>{
    if(!organizationId)return;
    setError('');
    try{setData(await call(organizationId))}catch(e){setError(e.message)}
  },[organizationId]);
  useEffect(()=>{load()},[load]);
  const run=useCallback(async body=>{
    // Trava contra duplo envio (Enter duas vezes, clique duplo): o segundo pedido gerava "Já existe".
    if(inFlight.current)return false;
    inFlight.current=true;setBusy(true);setNotice('');setError('');
    try{const out=await call(organizationId,body);setNotice(out.message||'Salvo.');await load();return true}
    catch(e){setError(e.message);return false}
    finally{inFlight.current=false;setBusy(false)}
  },[organizationId,load]);
  const counts=useMemo(()=>data?Object.fromEntries(Object.entries(data.catalogs).map(([k,c])=>[k,c.items.filter(i=>i.is_active).length])):{}, [data]);
  if(!organizationId)return null;
  return <section className="nxs" aria-labelledby="nxs-title">
    <header className="nxs-head">
      <div><h2 id="nxs-title">Cadastros do funil</h2><p>Etapas, motivos de perda, origens, categorias, setores e campos que a equipe preenche.</p></div>
      {data?.can_manage&&<button type="button" className="nxs-btn" disabled={busy} onClick={()=>{
        if(window.confirm('Aplicar o modelo do Agendor? Só será criado o que ainda não existe: listas, campos extras e o funil "Proteção veicular (modelo Agendor)". Nada é apagado.'))run({action:'template_apply'})}}>
        {busy?<Loader2 size={16} className="nxs-spin"/>:<Wand2 size={16}/>} Aplicar modelo Agendor</button>}
    </header>
    {(notice||error)&&<p className={error?'nxs-alert nxs-alert--error':'nxs-alert'} role={error?'alert':'status'}>{error||notice}</p>}
    {!data&&!error&&<p className="nxs-empty"><Loader2 size={16} className="nxs-spin"/> Carregando…</p>}
    {data&&<>
      {!data.can_manage&&<p className="nxs-hint">Você pode consultar. Alterações são feitas por gerente ou administrador.</p>}
      <div className="nxs-tabs" role="tablist" aria-label="Cadastros">
        {TABS.map(t=><button key={t.id} type="button" role="tab" id={'nxs-tab-'+t.id} aria-selected={tab===t.id} aria-controls={'nxs-panel-'+t.id} className={tab===t.id?'is-on':''} onClick={()=>setTab(t.id)}>
          {t.label}{counts[t.id]!==undefined&&<small>{counts[t.id]}</small>}</button>)}
      </div>
      <div role="tabpanel" id={'nxs-panel-'+tab} aria-labelledby={'nxs-tab-'+tab} className="nxs-panel">
        {tab==='stages'&&<StagesTab data={data} canManage={data.can_manage} run={run} busy={busy}/>}
        {tab==='fields'&&<FieldsTab fields={data.fields} canManage={data.can_manage} run={run} busy={busy}/>}
        {data.catalogs[tab]&&<CatalogList key={tab} kind={tab} catalog={data.catalogs[tab]} canManage={data.can_manage} run={run} busy={busy}/>}
      </div>
    </>}
  </section>;
}
