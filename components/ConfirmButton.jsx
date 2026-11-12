'use client';
import {useEffect,useState} from 'react';
// Ação destrutiva em dois toques: "Excluir" vira "Confirmar exclusão" por 4 s.
export default function ConfirmButton({onConfirm,label='Excluir',confirmLabel='Confirmar exclusão',disabled=false,className='nx13-linkbutton fx-danger-link'}){
  const [armed,setArmed]=useState(false);
  useEffect(()=>{if(!armed)return;const t=setTimeout(()=>setArmed(false),4000);return()=>clearTimeout(t)},[armed]);
  return <button type="button" className={className+(armed?' is-armed':'')} disabled={disabled}
    aria-live="polite" onClick={()=>{if(armed){setArmed(false);onConfirm?.()}else setArmed(true)}}>{armed?confirmLabel:label}</button>;
}
