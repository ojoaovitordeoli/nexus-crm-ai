// Montagem pura de CSV para Excel pt-BR (separador ";", BOM UTF-8, CRLF).
// Testado em tests/csv-export.test.mjs.
import {codeLabel} from './lead-view.mjs';

// Neutraliza fórmulas (CSV injection) e normaliza quebras de linha.
const safeText=v=>{
  const text=String(v??'').replace(/\r\n?/g,'\n').replace(/\u0000/g,'');
  return /^[\s]*[=+\-@\t\r]/.test(text)?"'"+text:text;
};
export const csvField=v=>'"'+safeText(v).replace(/"/g,'""')+'"';
export const toCsv=rows=>'﻿'+rows.map(row=>row.map(csvField).join(';')).join('\r\n');

const shortDate=v=>{
  if(!v)return '';
  if(/^\d{4}-\d{2}-\d{2}$/.test(String(v)))return String(v).split('-').reverse().join('/');
  const d=new Date(v);
  return Number.isNaN(d.getTime())?'':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
};
const nameOf=c=>[c?.first_name,c?.last_name].filter(Boolean).join(' ').trim()||'Contato sem nome';

export function leadCsvRows(leads,stageName=()=>''){
  const header=['Nome','Telefone','Origem','Etapa','Status','Temperatura','Cadastro'];
  return [header,...(leads||[]).map(l=>[
    nameOf(l.contact),l.contact?.whatsapp||'',l.source||'',stageName(l)||'',
    l.status?codeLabel(l.status):'',l.temperature?codeLabel(l.temperature):'',shortDate(l.created_at)
  ])];
}
export function contactCsvRows(contacts){
  return [['Nome','WhatsApp','Cadastrado'],...(contacts||[]).map(c=>[nameOf(c),c.whatsapp||'',shortDate(c.created_at)])];
}
export function fileSlug(value,fallback='empresa'){
  return String(value||fallback).normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,45)||fallback;
}
