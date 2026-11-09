'use client';
import {useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,Plus} from 'lucide-react';

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
  const selectedLabel=selected===today?'Hoje':fromKey(selected).toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'});
  return <aside className="fx-box fx-cal" aria-label="Navegação da agenda">
    <section aria-label="Calendário de agendamentos">
      <div className="fx-cal-head">
        <h2>{monthName(displayMonth)}</h2>
        <div className="fx-cal-nav">
          <button type="button" className="fx-cal-today" onClick={goToday}>Hoje</button>
          <button type="button" onClick={()=>changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={16}/></button>
          <button type="button" onClick={()=>changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={16}/></button>
        </div>
      </div>
      <div className="fx-cal-weekdays" aria-hidden="true">{dayNames.map(x=><span key={x}>{x.slice(0,1)}</span>)}</div>
      <div className="fx-cal-days">
        {days.map(({key,day,other,total})=><button type="button" key={key}
          className={'fx-cal-day'+(other?' is-outside':'')+(key===selected?' is-selected':'')+(key===today?' is-today':'')}
          onClick={()=>{setSelected(key);if(other)setDisplayMonth(startOfMonth(fromKey(key)))}}
          aria-pressed={selected===key} aria-label={fromKey(key).toLocaleDateString('pt-BR',{day:'numeric',month:'long'})+(total?' — '+total+' compromisso(s)':'')}>
          <span>{day}</span>{total>0&&<i/>}
        </button>)}
      </div>
    </section>
    <div className="fx-subhead"><h3>{selectedLabel}</h3><span className="fx-groupcount">{matches.length}</span></div>
    <div className="fx-cal-list">
      {matches.map(a=><div className="fx-cal-item" key={a.id}>
        <span className="fx-cal-time">{timeOf(a.start_at)}</span>
        <div><strong>{a.title||'Compromisso'}</strong><small>{statuses[a.status]||a.status||'Agendado'}{a.location?' · '+a.location:''}</small></div>
      </div>)}
      {!matches.length&&<p className="fx-empty-small">Nenhum compromisso neste dia.</p>}
    </div>
    {!readonly&&<div className="fx-cal-foot"><button type="button" className="fx-btn" onClick={()=>onPick(selected)}><Plus size={15}/> Agendar neste dia</button></div>}
  </aside>;
}
