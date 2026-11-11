'use client';
import {useEffect,useRef,useState} from 'react';
import {AlertCircle,ArrowRight,Loader2,ShieldCheck,X} from 'lucide-react';

// Diálogo de campos obrigatórios da etapa.
// O servidor é a fonte de verdade: aqui apenas coletamos as respostas e
// exibimos o que a API recusou. Sem requisitos, a mudança é enviada direto.
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(v)||0);
const initialValue=req=>{
  const v=req.value;
  if(req.type==='checkbox')return v===true||v==='true';
  if(req.type==='multiselect'||req.type==='products')return Array.isArray(v)?v:[];
  if(v===null||v===undefined)return '';
  // closed_at vem como timestamp; o campo de data só aceita AAAA-MM-DD (senão aparecia vazio e era recusado).
  if(req.type==='date')return String(v).slice(0,10);
  return String(v);
};

function Field({req,value,onChange,ctx,first}){
  const id='nxg-'+req.key.replace(/[^a-z0-9]/gi,'');
  const common={id,ref:first||undefined,'aria-required':'true'};
  const labelEl=<label htmlFor={id} className="nxg-label">{req.label}<span aria-hidden="true"> *</span></label>;
  if(req.type==='checkbox')return <div className="nxg-field nxg-check">
    <input type="checkbox" {...common} checked={value===true} onChange={e=>onChange(e.target.checked)}/>
    <label htmlFor={id}>{req.label}<span aria-hidden="true"> *</span></label>
  </div>;
  if(req.type==='select'||req.type==='lost_reason'){
    const options=req.type==='lost_reason'?ctx.lostReasons:req.options;
    return <div className="nxg-field">{labelEl}
      <select {...common} value={value} onChange={e=>onChange(e.target.value)}>
        <option value="">Selecione...</option>{options.map(o=><option key={o} value={o}>{o}</option>)}
      </select>
      {req.type==='lost_reason'&&!options.length&&<small className="nxg-help">Nenhum motivo de perda ativo cadastrado para a empresa.</small>}
      {req.type==='select'&&!options.length&&<small className="nxg-help">Este campo não tem opções cadastradas. Peça ao gestor para revisar o campo em Configurações.</small>}
    </div>;
  }
  if(req.type==='multiselect')return <fieldset className="nxg-field nxg-multi"><legend className="nxg-label">{req.label}<span aria-hidden="true"> *</span></legend>
    {req.options.map((o,i)=><label key={o} className="nxg-option"><input type="checkbox" ref={i===0?first:undefined} checked={value.includes(o)}
      onChange={e=>onChange(e.target.checked?[...value,o]:value.filter(x=>x!==o))}/>{o}</label>)}
    {!req.options.length&&<small className="nxg-help">Este campo não tem opções cadastradas. Peça ao gestor para revisar o campo em Configurações.</small>}
  </fieldset>;
  if(req.type==='products'){
    const qty=pid=>value.find(x=>x.product_id===pid)?.quantity;
    const set=(pid,q)=>onChange(q>0?[...value.filter(x=>x.product_id!==pid),{product_id:pid,quantity:q}]:value.filter(x=>x.product_id!==pid));
    return <fieldset className="nxg-field nxg-multi"><legend className="nxg-label">{req.label}<span aria-hidden="true"> *</span></legend>
      {ctx.products.length?ctx.products.map((p,i)=><div key={p.id} className="nxg-product">
        <label className="nxg-option"><input type="checkbox" ref={i===0?first:undefined} checked={Boolean(qty(p.id))} onChange={e=>set(p.id,e.target.checked?1:0)}/>
          <span>{p.name}{p.price!=null&&<small> · {brl(p.price)}{p.unit?' / '+p.unit:''}</small>}</span></label>
        {qty(p.id)?<input type="number" min="1" step="1" aria-label={'Quantidade de '+p.name} value={qty(p.id)} onChange={e=>set(p.id,Math.max(1,Number(e.target.value)||1))}/>:null}
      </div>):<small className="nxg-help">Nenhum produto ativo cadastrado para a empresa.</small>}
    </fieldset>;
  }
  const type=req.type==='date'?'date':req.type==='number'||req.type==='currency'?'number':req.type==='phone'?'tel':req.type==='email'?'email':'text';
  return <div className="nxg-field">{labelEl}
    <input {...common} type={type} inputMode={type==='number'?'decimal':undefined} min={type==='number'?'0':undefined}
      step={req.type==='currency'?'0.01':undefined} maxLength={type==='text'?500:undefined}
      value={value} onChange={e=>onChange(e.target.value)} placeholder={req.type==='currency'?'0,00':undefined}/>
  </div>;
}

export default function NexusStageGate({request,onOperation,onDone,onCancel}){
  const [phase,setPhase]=useState('loading');
  const [info,setInfo]=useState(null);
  const [values,setValues]=useState({});
  const [error,setError]=useState('');
  const [missing,setMissing]=useState([]);
  const first=useRef(null);
  const {lead,stageId,transfer=false}=request;
  const leadName=[lead?.contact?.first_name,lead?.contact?.last_name].filter(Boolean).join(' ')||'Contato sem nome';

  const move=async answers=>{
    setPhase('saving');setError('');setMissing([]);
    try{
      const result=await onOperation({action:'lead_stage',id:lead.id,stage_id:stageId,transfer,answers});
      onDone(result);
    }catch(e){
      setError(e.message||'Não foi possível mover o lead.');
      setMissing([...(Array.isArray(e.missing)?e.missing:[]),...(Array.isArray(e.invalid)?e.invalid:[])]);
      setPhase(info?.requirements?.length?'form':'error');
    }
  };
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const res=await onOperation({action:'lead_stage_requirements',id:lead.id,stage_id:stageId,transfer});
        if(!alive)return;
        setInfo(res);
        if(!res.requirements?.length){await move({});return}
        setValues(Object.fromEntries(res.requirements.map(r=>[r.key,initialValue(r)])));
        setPhase('form');
      }catch(e){if(alive){setError(e.message||'Não foi possível carregar os requisitos da etapa.');setPhase('error')}}
    })();
    return ()=>{alive=false};
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[lead.id,stageId,transfer]);
  useEffect(()=>{if(phase==='form')first.current?.focus()},[phase]);
  useEffect(()=>{
    // Captura no window e interrompe: sem isso o Esc também fechava a ficha do lead aberta por baixo.
    const onKey=e=>{if(e.key!=='Escape')return;e.stopPropagation();e.preventDefault();if(phase!=='saving')onCancel()};
    window.addEventListener('keydown',onKey,true);return ()=>window.removeEventListener('keydown',onKey,true);
  },[phase,onCancel]);

  // Sem formulário (etapa sem requisitos): só um aviso discreto de progresso/erro.
  if(phase==='loading'||(phase==='saving'&&!info?.requirements?.length))return <div className="nxg-toast" role="status"><Loader2 size={16} className="nxg-spin"/> Movendo lead…</div>;
  if(phase==='error'&&!info?.requirements?.length)return <div className="nxg-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel()}}>
    <section className="nxg-dialog" role="alertdialog" aria-modal="true" aria-labelledby="nxg-title">
      <header className="nxg-head"><div><h2 id="nxg-title">Não foi possível mover</h2></div><button type="button" className="nxg-close" onClick={onCancel} aria-label="Fechar"><X size={18}/></button></header>
      <div className="nxg-alert" role="alert"><AlertCircle size={16}/>{error}</div>
      <footer className="nxg-foot"><button type="button" className="nxg-primary" onClick={onCancel}>Entendi</button></footer>
    </section>
  </div>;

  const ctx={lostReasons:info?.lost_reasons||[],products:info?.products||[]};
  const reqs=info?.requirements||[];
  const submit=e=>{e.preventDefault();if(phase!=='saving')move(values)};
  return <div className="nxg-overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&phase!=='saving')onCancel()}}>
    <form className="nxg-dialog" role="dialog" aria-modal="true" aria-labelledby="nxg-title" aria-describedby="nxg-desc" onSubmit={submit} noValidate>
      <header className="nxg-head">
        <div><span className="nxg-overline">{transfer?'TRANSFERIR DE FUNIL':'MUDAR DE ETAPA'}</span>
          <h2 id="nxg-title">{info?.stage?.name}</h2>
          <p id="nxg-desc">{leadName} · {info?.pipeline?.name}. Preencha os campos obrigatórios para concluir.</p></div>
        <button type="button" className="nxg-close" onClick={onCancel} disabled={phase==='saving'} aria-label="Cancelar e fechar"><X size={18}/></button>
      </header>
      <div className="nxg-body">
        {error&&<div className="nxg-alert" role="alert"><AlertCircle size={16}/><span>{error}</span></div>}
        {reqs.map((r,i)=><div key={r.key} className={missing.includes(r.label)?'nxg-missing':''}>
          <Field req={r} ctx={ctx} first={i===0?first:null} value={values[r.key]} onChange={v=>setValues(p=>({...p,[r.key]:v}))}/>
        </div>)}
      </div>
      <footer className="nxg-foot">
        <small><ShieldCheck size={14}/> Validado no servidor e registrado no histórico do lead.</small>
        <div><button type="button" className="nxg-secondary" onClick={onCancel} disabled={phase==='saving'}>Cancelar</button>
          <button type="submit" className="nxg-primary" disabled={phase==='saving'}>{phase==='saving'?<><Loader2 size={15} className="nxg-spin"/> Salvando…</>:<>Salvar e mover <ArrowRight size={15}/></>}</button></div>
      </footer>
    </form>
  </div>;
}
