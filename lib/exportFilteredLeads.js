/** Download only the leads already filtered and authorized for this workspace.
 * No request for cross-tenant data; this export reflects the current 250-record window.
 * Escape spreadsheet formulas to prevent CSV injection (see lib/csv.mjs).
 */
import {contactCsvRows,fileSlug,leadCsvRows,toCsv} from './csv.mjs';

export function downloadCsv(rows,filename){
  const blob=new Blob([toCsv(rows)],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  anchor.href=url;anchor.download=filename;
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  // Revogar na hora cancela o download em alguns navegadores (Firefox/Safari).
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
// Data local (toISOString usaria UTC e marcaria o dia seguinte após as 21h no Brasil).
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
export function exportFilteredLeads(leads,stageName,organizationName){
  downloadCsv(leadCsvRows(leads,stageName),'nexus-leads-'+fileSlug(organizationName)+'-'+today()+'.csv');
}
export function exportContacts(contacts,organizationName){
  downloadCsv(contactCsvRows(contacts),'nexus-contatos-'+fileSlug(organizationName)+'-'+today()+'.csv');
}
