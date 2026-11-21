'use client';
import {useEffect,useRef,useState} from 'react';
import {Check,Pencil,X} from 'lucide-react';
import {mostrarValor} from '../lib/custom-fields-chat.mjs';

// V52 — "Campos extras" na ficha do lead. Os campos são criados pelo gerente/admin (em Configurações
// ou pedindo ao assistente); aqui a equipe vê e preenche. Leitura e gravação pela API de operação
// (lead_fields / lead_field_set), sempre conferindo empresa, lead e campo no servidor.
function Editor({field,value,onChange,id}){
  const common={id,className:'nx-lf-input'};
  switch(field.type){
    case 'checkbox':return <label className="nx-lf-check"><input type="checkbox" checked={value===true} onChange={e=>onChange(e.target.checked)}/> Sim</label>;
    case 'select':return <select {...common} value={value??''} onChange={e=>onChange(e.target.value)}><option value="">Sem resposta</option>{field.options.map(o=><option key={o} value={o}>{o}</option>)}</select>;
    case 'multiselect':{const cur=Array.isArray(value)?value:[];return <div className="nx-lf-multi" role="group" aria-labelledby={id+'-l'}>{field.options.map(o=><label key={o}><input type="checkbox" checked={cur.includes(o)} onChange={e=>onChange(e.target.checked?[...cur,o]:cur.filter(x=>x!==o))}/> {o}</label>)}</div>}
    case 'date':return <input {...common} type="date" value={value??''} onChange={e=>onChange(e.target.value)}/>;
    case 'number':case 'currency':return <input {...common} inputMode="decimal" placeholder={field.type==='currency'?'0,00':'0'} value={value??''} onChange={e=>onChange(e.target.value)}/>;
    case 'phone':return <input {...common} type="tel" inputMode="tel" value={value??''} onChange={e=>onChange(e.target.value)}/>;
    case 'email':return <input {...common} type="email" value={value??''} onChange={e=>onChange(e.target.value)}/>;
    default:return <input {...common} maxLength={500} value={value??''} onChange={e=>onChange(e.target.value)}/>;
  }
}

export default function NexusLeadFields({leadId,readonly=false,onOperation}){
  const [state,setState]=useState({status:'idle',fields:[],error:''});
  const [editing,setEditing]=useState(null),[draft,setDraft]=useState(null),[saving,setSaving]=useState(false),[note,setNote]=useState('');
  const ticket=useRef(0);
  useEffect(()=>{
    if(!leadId||!onOperation)return;
    const t=++ticket.current;
    setState({status:'loading',fields:[],error:''});setEditing(null);setNote('');
    Promise.resolve().then(()=>onOperation({action:'lead_fields',lead_id:leadId}))
      .then(r=>{if(ticket.current===t)setState({status:'ready',fields:r?.fields||[],error:''})})
      .catch(e=>{if(ticket.current===t)setState({status:'error',fields:[],error:e?.message||'Falha ao carregar os campos extras.'})});
  },[leadId,onOperation]);

  if(!onOperation)return null;
  const start=f=>{setEditing(f.id);setDraft(f.type==='number'||f.type==='currency'?(f.value==null?'':String(f.value).replace('.',',')):f.value);setNote('')};
  const save=async f=>{
    setSaving(true);setNote('');
    try{
      const r=await onOperation({action:'lead_field_set',lead_id:leadId,field_id:f.id,value:draft});
      setState(s=>({...s,fields:s.fields.map(x=>x.id===f.id?{...x,value:r?.value??null}:x)}));
      setEditing(null);setNote(r?.message||'Salvo.');
    }catch(e){setNote(e?.message||'Não consegui salvar.')}
    finally{setSaving(false)}
  };
  const grupos=[['lead','Deste atendimento'],['contact','Da pessoa (vale em todos os atendimentos)']];
  return <section className="v11-detail-section nx-lf" aria-busy={state.status==='loading'}>
    <h3>Campos extras</h3>
    {state.status==='loading'&&<p className="v11-detail-help">Carregando…</p>}
    {state.status==='error'&&<p className="v11-detail-error" role="alert">{state.error}</p>}
    {state.status==='ready'&&!state.fields.length&&<p className="v11-detail-help">Nenhum campo extra ainda. Gerente ou administrador cria em <a href="/personalizar">Personalizar → Campos extras</a> (sem custo) ou pede ao Assistente, por exemplo: “quero guardar o convênio de cada cliente”.</p>}
    {note&&<p className="v11-detail-help" role="status">{note}</p>}
    {grupos.map(([ent,titulo])=>{
      const fs=state.fields.filter(f=>f.entity_type===ent);
      if(!fs.length)return null;
      return <div key={ent} className="nx-lf-group"><h4>{titulo}</h4>
        {fs.map(f=>{const id='lf-'+f.id;return <div key={f.id} className="nx-lf-row">
          <span id={id+'-l'} className="nx-lf-label">{editing===f.id&&f.type!=='multiselect'&&f.type!=='checkbox'?<label htmlFor={id}>{f.name}</label>:f.name}</span>
          {editing===f.id?<div className="nx-lf-edit">
            <Editor field={f} value={draft} onChange={setDraft} id={id}/>
            <button type="button" className="fx-iconbtn" onClick={()=>save(f)} disabled={saving} aria-label={'Salvar '+f.name}><Check size={15}/></button>
            <button type="button" className="fx-iconbtn" onClick={()=>setEditing(null)} disabled={saving} aria-label="Cancelar"><X size={15}/></button>
          </div>:<div className="nx-lf-view">
            <strong>{mostrarValor(f,f.value)||<em>Sem resposta</em>}</strong>
            {!readonly&&<button type="button" className="fx-iconbtn" onClick={()=>start(f)} aria-label={'Editar '+f.name}><Pencil size={14}/></button>}
          </div>}
        </div>})}
      </div>;
    })}
  </section>;
}
