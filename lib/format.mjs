// Formatação de exibição. Não altera o que é gravado no banco.

/** Telefone brasileiro: 48996867104 -> (48) 99686-7104; 5548996867104 -> +55 (48) 99686-7104. */
export function formatPhoneBR(value){
  const raw=String(value??'').trim();
  if(!raw)return '';
  let d=raw.replace(/\D/g,'');
  let ddi='';
  if((d.length===12||d.length===13)&&d.startsWith('55')){ddi='+55 ';d=d.slice(2)}
  if(d.length===11)return ddi+'('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);
  if(d.length===10)return ddi+'('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);
  return raw; // formato desconhecido: mostra como veio
}
