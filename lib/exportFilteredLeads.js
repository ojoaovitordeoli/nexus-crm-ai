/** Download only the leads already filtered and authorized for this workspace.
 * No request for cross-tenant data; this export reflects the current 250-record window.
 * Escape spreadsheet formulas to prevent CSV injection.
 */
const safeText=v=>{
  const text=String(v??'').replace(/\r\n?/g,'\n').replace(/\u0000/g,'');
  return /^[\s]*[=+\-@\t\r]/.test(text)?"'"+text:text;
};
const field=v=>'"'+safeText(v).replace(/"/g,'""')+'"';
const date=v=>v&&!Number.isNaN(new Date(v).getTime())?
  new Date(v).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
export function exportFilteredLeads(leads,stageName,organizationName){
  const header=['Nome','Telefone','Origem','Etapa','Status','Temperatura','Cadastro'];
  const body=(leads||[]).map(l=>[
    [l.contact?.first_name,l.contact?.last_name].filter(Boolean).join(' ')||'Contato sem nome',
    l.contact?.whatsapp||'',l.source||'',stageName(l),l.status||'',l.temperature||'',date(l.created_at)
  ]);
  const csv='\ufeff'+[header,...body].map(row=>row.map(field).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');
  const slug=String(organizationName||'empresa').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-').slice(0,45)||'empresa';
  anchor.href=url;anchor.download='nexus-leads-'+slug+'-'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
