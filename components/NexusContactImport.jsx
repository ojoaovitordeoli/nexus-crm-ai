'use client';
import {useRef,useState} from 'react';
import {Download,FileUp,X} from 'lucide-react';
import {buildContacts,parseCsv,IMPORT_LIMIT} from '../lib/contact-import.mjs';
import {formatPhoneBR} from '../lib/format.mjs';

// Excel no Brasil costuma salvar CSV em Windows-1252: tenta UTF-8 e cai para ele.
async function readText(file){
  const buf=await file.arrayBuffer();
  try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}
  catch{return new TextDecoder('windows-1252').decode(buf)}
}
const SAMPLE='Nome;WhatsApp;E-mail;Origem;Cidade\nMaria Souza;(48) 99999-1111;maria@exemplo.com;Instagram;Florianópolis\n';

export default function NexusContactImport({onOperation,onReload,onClose}){
  const input=useRef(null);
  const [fileName,setFileName]=useState('');
  const [csv,setCsv]=useState('');
  const [preview,setPreview]=useState(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [result,setResult]=useState(null);

  async function pick(e){
    const file=e.target.files?.[0];
    setError('');setResult(null);setPreview(null);setCsv('');
    if(!file)return;
    if(/\.xlsx?$/i.test(file.name)){setError('Arquivo do Excel (.xlsx) ainda não é lido direto. No Excel: Arquivo › Salvar como › CSV, e envie o .csv.');return}
    if(file.size>1500000){setError('Arquivo grande demais. Divida em partes de até '+IMPORT_LIMIT+' linhas.');return}
    setFileName(file.name);
    const text=await readText(file);
    const built=buildContacts(parseCsv(text));
    if(built.error){setError(built.error);return}
    setCsv(text);setPreview(built);
  }
  async function send(){
    if(!csv||busy)return;
    setBusy(true);setError('');
    try{const r=await onOperation({action:'contacts_import',csv});setResult(r);setPreview(null);setCsv('');await onReload?.()}
    catch(e){setError(e.message||'Não foi possível importar.')}
    finally{setBusy(false)}
  }
  function sample(){
    const blob=new Blob(['﻿'+SAMPLE],{type:'text/csv;charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='modelo-contatos-nexus.csv';a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  return <section className="fx-panel fx-import" aria-label="Importar contatos">
    <div className="fx-import-head">
      <div><h2>Importar contatos de planilha</h2>
        <p>Envie um arquivo CSV com uma coluna de <strong>Nome</strong> e, se tiver, <strong>WhatsApp</strong>, E-mail, Origem e Cidade. Contatos com WhatsApp já cadastrado não são duplicados.</p></div>
      <button type="button" className="fx-iconbtn" aria-label="Fechar importação" onClick={onClose}><X size={16}/></button>
    </div>
    <div className="fx-import-actions">
      <input ref={input} type="file" accept=".csv,text/csv,.txt" onChange={pick} hidden/>
      <button type="button" className="fx-btn fx-btn--primary" onClick={()=>input.current?.click()} disabled={busy}><FileUp size={16}/> Escolher arquivo</button>
      <button type="button" className="nx13-linkbutton" onClick={sample}><Download size={14}/> Baixar modelo</button>
      {fileName&&<span className="fx-muted">{fileName}</span>}
    </div>
    <p className="fx-muted fx-import-tip">Tem a lista no Excel ou no Google Planilhas? Use <em>Arquivo › Salvar como / Fazer download › CSV</em>.</p>
    {error&&<div className="fx-alert fx-alert--error" role="alert">{error}</div>}
    {preview&&<div className="fx-import-preview">
      <p><strong>{preview.contacts.length}</strong> {preview.contacts.length===1?'contato pronto':'contatos prontos'} para importar
        {preview.duplicates>0&&<> · {preview.duplicates} repetido(s) na planilha</>}
        {preview.invalid.length>0&&<> · {preview.invalid.length} linha(s) com problema</>}
        {preview.truncated&&<> · só as primeiras {IMPORT_LIMIT} linhas</>}</p>
      {preview.contacts.length>0&&<div className="fx-table fx-table--import" role="table" aria-label="Prévia da importação">
        <div className="fx-thead" role="row"><span role="columnheader">Nome</span><span role="columnheader">WhatsApp</span><span role="columnheader">Origem</span></div>
        {preview.contacts.slice(0,5).map((c,i)=><div className="fx-tr" role="row" key={i}><span role="cell">{[c.first_name,c.last_name].filter(Boolean).join(' ')}</span><span role="cell" className="fx-muted">{formatPhoneBR(c.whatsapp)||'—'}</span><span role="cell" className="fx-muted">{c.source||'—'}</span></div>)}
      </div>}
      {preview.invalid.length>0&&<details className="fx-import-invalid"><summary>Ver linhas com problema</summary>
        <ul>{preview.invalid.slice(0,20).map(x=><li key={x.line}>Linha {x.line}: {x.reason}</li>)}</ul></details>}
      <div className="fx-import-actions">
        <button type="button" className="fx-btn fx-btn--primary" onClick={send} disabled={busy||!preview.contacts.length}>{busy?'Importando...':'Importar '+preview.contacts.length+' '+(preview.contacts.length===1?'contato':'contatos')}</button>
        <button type="button" className="fx-btn" onClick={()=>{setPreview(null);setCsv('');setFileName('');if(input.current)input.current.value=''}} disabled={busy}>Cancelar</button>
      </div>
    </div>}
    {result&&<div className="fx-alert fx-alert--ok" role="status">{result.message}</div>}
  </section>;
}
