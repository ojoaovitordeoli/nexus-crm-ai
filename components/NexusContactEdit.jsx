'use client';
import {useState} from 'react';
import {ExternalLink,X} from 'lucide-react';
import ConfirmButton from './ConfirmButton';
import {formatPhoneBR} from '../lib/format.mjs';

const waLink=v=>{let d=String(v||'').replace(/\D/g,'');if(d.length===10||d.length===11)d='55'+d;return d.length>=12&&d.length<=13?'https://wa.me/'+d:''};

// Ficha do contato: ver, corrigir e (gestão) excluir.
export default function NexusContactEdit({contact,readonly=false,canDelete=false,onOperation,onReload,onClose}){
  const [form,setForm]=useState({first_name:contact.first_name||'',last_name:contact.last_name||'',whatsapp:formatPhoneBR(contact.whatsapp)||'',email:contact.email||'',city:contact.city||''});
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const set=k=>e=>setForm(f=>({...f,[k]:e.target.value}));
  async function save(e){
    e.preventDefault();if(busy||readonly)return;
    setBusy(true);setError('');setNotice('');
    try{const r=await onOperation({action:'contact_update',id:contact.id,...form});setNotice(r.message||'Contato atualizado.');await onReload?.()}
    catch(err){setError(err.message||'Não foi possível salvar.')}finally{setBusy(false)}
  }
  async function remove(){
    setBusy(true);setError('');
    try{await onOperation({action:'contact_delete',id:contact.id});await onReload?.();onClose?.()}
    catch(err){setError(err.message||'Não foi possível excluir.')}finally{setBusy(false)}
  }
  const wa=waLink(contact.whatsapp);
  return <section className="fx-panel fx-contact-edit" aria-label={'Contato '+form.first_name}>
    <div className="fx-import-head">
      <div><h2>{[contact.first_name,contact.last_name].filter(Boolean).join(' ')||'Contato'}</h2>
        {wa&&<a className="nx13-linkbutton" href={wa} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/> Abrir conversa no WhatsApp</a>}</div>
      <button type="button" className="fx-iconbtn" aria-label="Fechar contato" onClick={onClose}><X size={16}/></button>
    </div>
    <form className="fx-contact-form" onSubmit={save}>
      <label>Nome<input required minLength={2} maxLength={130} value={form.first_name} onChange={set('first_name')} disabled={readonly}/></label>
      <label>Sobrenome<input maxLength={130} value={form.last_name} onChange={set('last_name')} disabled={readonly}/></label>
      <label>WhatsApp<input inputMode="tel" placeholder="(48) 99999-9999" value={form.whatsapp} onChange={set('whatsapp')} disabled={readonly}/></label>
      <label>E-mail<input type="email" maxLength={200} value={form.email} onChange={set('email')} disabled={readonly}/></label>
      <label>Cidade<input maxLength={120} value={form.city} onChange={set('city')} disabled={readonly}/></label>
      {!readonly&&<div className="fx-contact-actions">
        <button type="submit" className="fx-btn fx-btn--primary" disabled={busy}>{busy?'Salvando...':'Salvar'}</button>
        {canDelete&&<ConfirmButton label="Excluir contato" onConfirm={remove} disabled={busy}/>}
      </div>}
    </form>
    {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    {notice&&<div className="fx-alert fx-alert--ok" role="status">{notice}</div>}
  </section>;
}
