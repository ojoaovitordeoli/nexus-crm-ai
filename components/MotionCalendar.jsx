'use client';
import {useMemo,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight,Clock3,MapPin,Plus} from 'lucide-react';

const pad=v=>String(v).padStart(2,'0');
const toKey=d=>[d.getFullYear(),pad(d.getMonth()+1),pad(d.getDate())].join('-');
const fromKey=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const startOfMonth=d=>new Date(d.getFullYear(),d.getMonth(),1);
const monthName=d=>d.toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
const timeOf=s=>new Date(s).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
const dateKey=s=>s?toKey(new Date(s)):'';
const statuses={scheduled:'Agendado',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado',no_show:'Não compareceu'};
const dayNames=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export default function MotionCalendar({appointments=[],onPick,readonly=false}){
  const [displayMonth,setDisplayMonth]=useState(()=>startOfMonth(new Date()));
  const [selected,setSelected]=useState(()=>toKey(new Date()));
  const today=toKey(new Date());
  const matches=useMemo(()=>appointments.filter(a=>a.start_at&&dateKey(a.start_at)===selected).sort((a,b)=>new Date(a.start_at)-new Date(b.start_at)),[appointments,selected]);
  const countByDay=useMemo(()=>{
    const map=new Map();
    appointments.forEach(a=>{
      const key=dateKey(a.start_at);
      if(key&&!['cancelled'].includes(a.status))map.set(key,(map.get(key)||0)+1);
    });
    return map;
  },[appointments]);
  const days=useMemo(()=>{
    const first=new Date(displayMonth.getFullYear(),displayMonth.getMonth(),1);
    const beginning=new Date(first);beginning.setDate(first.getDate()-first.getDay());
    return Array.from({length:42},(_,i)=>{
      const date=new Date(beginning);date.setDate(beginning.getDate()+i);
      return {key:toKey(date),day:date.getDate(),other:date.getMonth()!==displayMonth.getMonth(),total:countByDay.get(toKey(date))||0};
    });
  },[displayMonth,countByDay]);
  const changeMonth=delta=>{
    setDisplayMonth(prev=>new Date(prev.getFullYear(),prev.getMonth()+delta,1));
    const target=new Date(displayMonth.getFullYear(),displayMonth.getMonth()+delta,1);
    setSelected(toKey(target));
  };
  const goToday=()=>{
    const now=new Date();setDisplayMonth(startOfMonth(now));setSelected(toKey(now));
  };
  return <div className="motion-calendar-grid">
    <section className="motion-calendar" aria-label="Calendário de agendamentos">
      <div className="motion-calendar-toolbar">
        <div><span className="motion-calendar-kicker">CALENDÁRIO INTERATIVO</span><h3>{monthName(displayMonth)}</h3></div>
        <div className="motion-calendar-month-actions">
          <button type="button" onClick={goToday}>Hoje</button>
          <button type="button" onClick={()=>changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18}/></button>
          <button type="button" onClick={()=>changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={18}/></button>
        </div>
      </div>
      <div className="motion-calendar-weekdays">{dayNames.map(x=><span key={x}>{x}</span>)}</div>
      <div key={displayMonth.toISOString()} className="motion-calendar-days">
        {days.map(({key,day,other,total},i)=><button type="button" key={key}
          className={'motion-calendar-day'+(other?' is-outside':'')+(key===selected?' is-selected':'')+(key===today?' is-today':'')}
          onClick={()=>{setSelected(key);if(other)setDisplayMonth(startOfMonth(fromKey(key)))}}
          style={{'--day-index':i}} aria-pressed={selected===key} aria-label={fromKey(key).toLocaleDateString('pt-BR',{day:'numeric',month:'long'})+(total?' — '+total+' compromisso(s)':'')}>
          <span>{day}</span>{total>0&&<i title={total+' agendamento(s)'}/>}
        </button>)}
      </div>
      <div className="motion-calendar-legend"><i/> Dias com compromissos <span>Selecione um dia para ver os detalhes</span></div>
    </section>
    <aside className="motion-calendar-day-panel">
      <div className="motion-calendar-panel-top">
        <span className="motion-calendar-kicker">AGENDA DO DIA</span>
        <h3>{fromKey(selected).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</h3>
        <p>{matches.length?matches.length+' compromisso(s) registrado(s)':'Nenhum compromisso neste dia'}</p>
      </div>
      <div key={selected} className="motion-calendar-day-list">
        {matches.map((a,i)=><article className="motion-calendar-agenda-item" key={a.id} style={{'--item-index':i}}>
          <span className="motion-calendar-time">{timeOf(a.start_at)}</span>
          <div><strong>{a.title||'Compromisso'}</strong><small>{statuses[a.status]||a.status||'Agendado'}</small>{a.location&&<small><MapPin size={12}/>{a.location}</small>}</div>
        </article>)}
        {!matches.length&&<div className="motion-calendar-empty"><CalendarDays size={31}/><strong>Dia disponível</strong><p>Selecione outro dia ou cadastre um novo compromisso.</p></div>}
      </div>
      {!readonly&&<button type="button" className="motion-calendar-add" onClick={()=>onPick(selected)}><Plus size={16}/> Agendar para este dia</button>}
    </aside>
  </div>;
}
