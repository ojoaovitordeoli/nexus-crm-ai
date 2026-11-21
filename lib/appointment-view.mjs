// Regras puras da agenda (presença e confirmação). Testadas em tests/appointment-view.test.mjs.
import {whatsappUrl} from './lead-view.mjs';

const OPEN=['scheduled','confirmed'];
const endOfDay=ms=>{const d=new Date(ms);d.setHours(23,59,59,999);return d.getTime()};

// Mostra "Compareceu / Faltou" quando o compromisso ainda está em aberto e já é hoje ou passou.
export function needsAttendance(appt,now=Date.now()){
  const at=Date.parse(appt?.start_at||'');
  if(!Number.isFinite(at))return false;
  return OPEN.includes(appt?.status||'scheduled')&&at<=endOfDay(now);
}

// Link do WhatsApp com a mensagem de confirmação já escrita. O envio é feito pela pessoa, no WhatsApp.
export function confirmationLink(appt,contact){
  const base=whatsappUrl(contact?.whatsapp);
  const at=Date.parse(appt?.start_at||'');
  if(!base||!Number.isFinite(at)||!OPEN.includes(appt?.status||'scheduled'))return '';
  const d=new Date(at);
  const day=d.toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'});
  const hour=d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
  const first=String(contact?.first_name||'').trim();
  const text=(first?'Olá, '+first+'! ':'Olá! ')+'Passando para confirmar seu horário de '+day+' às '+hour+'. Podemos confirmar?';
  return base+'?text='+encodeURIComponent(text);
}
<<<<<<< HEAD
=======

// Compromissos de dias ANTERIORES a hoje que ficaram em aberto (sem presença/falta registrada).
// Os de hoje já aparecem no bloco "Hoje". Mais recente primeiro.
export function awaitingAttendance(list=[],now=Date.now()){
  const today=new Date(now);today.setHours(0,0,0,0);
  return list.filter(a=>{const at=Date.parse(a?.start_at||'');return Number.isFinite(at)&&at<today.getTime()&&needsAttendance(a,now)})
    .sort((a,b)=>Date.parse(b.start_at)-Date.parse(a.start_at));
}
>>>>>>> c14506f8ff07f6809a7377df531cd71ef8e3abc9
