'use client';

// V60 — tela "Hoje": a manchete que conclui, a régua do dia, a fila que se resolve
// na própria linha, o mês contra a meta, onde o funil vaza e o que traz venda.
// Tudo calculado dos registros carregados (lib/hoje.mjs); nada inventado.
import {useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import NexusHomeTelas from './NexusHomeTelas';
import NexusExecutiveHome from './NexusExecutiveHome';
import {getSnapshotCoverage} from '../lib/dashboard-snapshot.mjs';
import {reguaDoDia,filaAgora,mesMeta,funilJanela,origemVenda,manchete,brl} from '../lib/hoje.mjs';
import {ArrowUpRight,Check,CircleCheck,ClockAlert,FileClock,Flame,MessageCircle,Plus,Snowflake,X} from 'lucide-react';

const int=v=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:0}).format(Number(v)||0);
const ICONE={presenca:ClockAlert,tarefa:FileClock,quentes:Flame,parados:Snowflake};
const TOM_TAG={alerta:'is-late',atencao:'is-wait',bom:'is-hot',frio:'is-cold'};

function Regua({regua}){
  const horas=[];for(let h=regua.hIni;h<regua.hFim;h++)horas.push(h);
  const c=regua.contagem;
  return <section className="nx-ruler" aria-label="Agenda de hoje por horário">
    <div className="nx-ruler-head"><h2>Agenda de hoje</h2>
      <div className="nx-ruler-cnt">
        <span><i className="is-veio"/><b>{c.veio}</b> {c.veio===1?'veio':'vieram'}</span>
        <span><i className="is-faltou"/><b>{c.faltou}</b> {c.faltou===1?'faltou':'faltaram'}</span>
        <span><i className="is-marcar"/><b>{c.marcar}</b> sem presença</span>
        <span><i className="is-vem"/><b>{c.vem}</b> ainda {c.vem===1?'vem':'vêm'}</span>
      </div></div>
    {regua.itens.length?<div className="nx-track">
      <div className="nx-hours" style={{gridTemplateColumns:'repeat('+horas.length+',1fr)'}}>{horas.map((h,i)=><div key={h}><span>{String(h).padStart(2,'0')}h</span>{i===horas.length-1&&<em>{String(regua.hFim).padStart(2,'0')}h</em>}</div>)}</div>
      {regua.agoraPct!==null&&<div className="nx-past" style={{width:regua.agoraPct+'%'}}/>}
      {regua.itens.map(it=><Link key={it.id} href="/agenda" className={'nx-ev is-'+it.situacao} data-h={it.hora} style={{left:it.left+'%',width:it.width+'%',top:it.faixa?62:4}}
        title={it.hora+' · '+(it.pessoa?it.pessoa+' · ':'')+it.titulo}>
        <b>{it.pessoa||it.titulo}</b><span>{it.situacao==='faltou'?'Faltou · ':it.situacao==='marcar'?'Marcar presença · ':''}{it.pessoa?it.titulo:it.hora}</span>
      </Link>)}
      {regua.agoraPct!==null&&<div className="nx-now" style={{left:regua.agoraPct+'%'}}><em>agora</em></div>}
    </div>:<p className="nx-ruler-empty">Nenhum atendimento hoje. <Link href="/agenda">Abrir a agenda</Link></p>}
  </section>;
}

// Gráfico do mês: SVG só com linhas (texto em SVG esticava quando o gráfico ficava largo);
// a legenda vem em HTML embaixo, sempre legível.
export function GraficoMes({mes}){
  const W=400,H=140,base=134;
  const topo=Math.max(1,mes.alvo||0,mes.projecao,mes.feito)*1.06;
  const x=d=>d/mes.diasMes*W,y=v=>base-(v/topo)*(base-6);
  const pts=mes.acumulado.map((v,i)=>[x(i+1),y(v)]);
  const linha='M0 '+base+' '+pts.map(p=>'L'+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
  const ult=pts.at(-1)||[0,base];
  return <figure className="nx-chart-fig"><div className="nx-chart-box">
    <svg className="nx-chart" viewBox={'0 0 '+W+' '+H} preserveAspectRatio="none" role="img"
      aria-label={'Faturamento acumulado do mês: '+brl(mes.feito)+' até o dia '+mes.hoje+(mes.alvo?', meta '+brl(mes.alvo):'')+'; no ritmo atual fecha em '+brl(mes.projecao)}>
      <line className="nx-chart-grid" x1="0" y1={base} x2={W} y2={base}/>
      {mes.alvo&&<path className="nx-chart-goal" d={'M0 '+base+' L'+W+' '+y(mes.alvo)} vectorEffect="non-scaling-stroke"/>}
      <path className="nx-chart-area" d={linha+' L'+ult[0].toFixed(1)+' '+base+' Z'}/>
      <path className="nx-chart-acc" d={linha} vectorEffect="non-scaling-stroke"/>
      {mes.hoje<mes.diasMes&&<path className="nx-chart-proj" d={'M'+ult[0].toFixed(1)+' '+ult[1].toFixed(1)+' L'+W+' '+y(mes.projecao)} vectorEffect="non-scaling-stroke"/>}
    </svg>
    <span className="nx-chart-dot" style={{left:(ult[0]/W*100)+'%',top:(ult[1]/H*100)+'%'}} aria-hidden="true"/></div>
    <figcaption className="nx-chart-leg">
      <span><i className="is-acc"/>vendido até hoje · {brl(mes.feito)}</span>
      {mes.hoje<mes.diasMes&&<span><i className="is-proj"/>no ritmo atual · {brl(mes.projecao)}</span>}
      {mes.alvo&&<span><i className="is-goal"/>meta · {brl(mes.alvo)}</span>}
    </figcaption>
  </figure>;
}

export default function NexusHoje(props){
  const {organizationId='',data,counts,loading,onOperation,onReload,readonly=false,pipelineStages=[],lastSync}=props;
  const d=data||{},leads=d.leads||[],sales=d.sales||[],tasks=d.tasks||[],appointments=d.appointments||[];
  const [compose,setCompose]=useState(false),[newTask,setNewTask]=useState(''),[deadline,setDeadline]=useState('');
  const [busy,setBusy]=useState(''),[erro,setErro]=useState(''),[toast,setToast]=useState(null);
  const timer=useRef(null);
  const agora=Date.now();
  const coverage=getSnapshotCoverage(counts,d);
  const leadsPorId=useMemo(()=>new Map(leads.map(l=>[l.id,l])),[leads]);
  const regua=useMemo(()=>reguaDoDia(appointments,{leadsPorId}),[appointments,leadsPorId]);
  const fila=useMemo(()=>filaAgora({appointments,tasks,leads,stages:pipelineStages}),[appointments,tasks,leads,pipelineStages]);
  const mes=useMemo(()=>mesMeta({sales,goal:d.goal}),[sales,d.goal]);
  const funil=useMemo(()=>funilJanela({leads,appointments,sales}),[leads,appointments,sales]);
  const origem=useMemo(()=>origemVenda({leads,sales}),[leads,sales]);

  // Empresa sem leads: o guia de primeiros passos continua sendo o melhor começo.
  if(!loading&&Number(counts?.leads||0)===0)return <NexusExecutiveHome {...props}/>;

  const titulo=manchete({mes,fila});
  const vem=regua.contagem.vem;
  const sub=[mes.alvo&&mes.feito<mes.alvo&&mes.porDiaPrecisa?'Para bater a meta: '+brl(mes.porDiaPrecisa)+' por dia até o fim do mês':null,
    vem?(vem===1?'falta 1 atendimento hoje':'faltam '+vem+' atendimentos hoje'):null].filter(Boolean).join(' · ');
  const hojeTxt=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  const atualizado=lastSync?'Atualizado às '+lastSync.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'';

  async function agir(payload,desfazer,msg,chave){
    if(readonly||busy)return;
    setBusy(chave);setErro('');
    try{await onOperation(payload);await onReload?.();
      clearTimeout(timer.current);setToast({msg,desfazer});timer.current=setTimeout(()=>setToast(null),6000)}
    catch(e){setErro(e.message||'Não foi possível salvar. Tente de novo.')}
    finally{setBusy('')}
  }
  async function voltar(){
    const t=toast;setToast(null);if(!t?.desfazer)return;
    try{await onOperation(t.desfazer);await onReload?.()}catch(e){setErro(e.message||'Não foi possível desfazer.')}
  }
  async function criarTarefa(e){
    e.preventDefault();if(!newTask.trim()||busy)return;
    setBusy('nova');setErro('');
    try{await onOperation({action:'task_create',title:newTask.trim().slice(0,190),due_date:deadline||null,priority:'medium'});await onReload?.();setNewTask('');setDeadline('');setCompose(false)}
    catch(e2){setErro(e2.message||'Não foi possível criar a tarefa.')}
    finally{setBusy('')}
  }
  const maxFunil=Math.max(1,funil.etapas[0].n);
  const maxReceita=Math.max(1,...origem.linhas.map(l=>l.receita));

  return <div className="nx-hoje" aria-busy={loading}>
    <header className="nx-hoje-head">
      <div>
        <h1>{loading?'Carregando o seu dia…':titulo}</h1>
        {!loading&&sub&&<p>{sub}.</p>}
      </div>
      <div className="nx-hoje-side">
        <span className="nx-hoje-date"><b>{hojeTxt.charAt(0).toUpperCase()+hojeTxt.slice(1)}</b>{atualizado}</span>
        {!readonly&&<button type="button" className="fx-btn" onClick={()=>setCompose(x=>!x)}><Plus size={16} aria-hidden="true"/> Nova tarefa</button>}
      </div>
    </header>
    {erro&&<div className="fx-alert fx-alert--error" role="alert">{erro}</div>}
    {compose&&<form className="v14-compose" onSubmit={criarTarefa}>
      <label><span>Nova tarefa</span><input autoFocus required minLength={2} maxLength={190} value={newTask} onChange={e=>setNewTask(e.target.value)} placeholder="Ex.: Retornar orçamento"/></label>
      <label><span>Prazo</span><input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)} aria-label="Prazo da nova tarefa"/></label>
      <button type="submit" disabled={readonly||busy==='nova'||!newTask.trim()}>{busy==='nova'?'Criando…':'Criar'}</button>
      <button type="button" className="fx-btn-text" onClick={()=>setCompose(false)}>Cancelar</button>
    </form>}

    <Regua regua={regua}/>

    <div className="nx-cols">
      <div>
        <section className="nx-sec" aria-label="O que pede ação agora">
          <div className="nx-sh"><h2>Agora</h2><span>{fila.total?(fila.total===1?'1 item':fila.total+' itens')+(readonly?'':', resolva daqui mesmo'):'nada pendente'}</span><Link href="/tasks">Todas as tarefas<ArrowUpRight size={14} aria-hidden="true"/></Link></div>
          {fila.itens.length?<ul className="nx-queue">{fila.itens.map(it=>{const I=ICONE[it.tipo==='grupo'?it.id:it.tipo]||FileClock;return <li key={it.id} className="nx-qi">
            <span className={'nx-tag '+(TOM_TAG[it.tom]||'')} aria-hidden="true"><I size={16}/></span>
            <div className="nx-qi-txt"><strong>{it.titulo}</strong><small className={it.tom==='alerta'?'is-late':''}>{it.detalhe}</small></div>
            <div className="nx-acts">
              {it.tipo==='presenca'&&!readonly&&<>
                <button type="button" className="nx-mini is-ok" aria-label={'Veio: '+it.titulo} disabled={Boolean(busy)} onClick={()=>agir({action:'appointment_status',id:it.appointmentId,status:'completed'},{action:'appointment_status',id:it.appointmentId,status:it.statusAntes},'Presença marcada.',it.id)}><Check size={14} aria-hidden="true"/>Veio</button>
                <button type="button" className="nx-mini is-no" aria-label={'Faltou: '+it.titulo} disabled={Boolean(busy)} onClick={()=>agir({action:'appointment_status',id:it.appointmentId,status:'no_show'},{action:'appointment_status',id:it.appointmentId,status:it.statusAntes},'Falta registrada.',it.id)}><X size={14} aria-hidden="true"/>Faltou</button></>}
              {it.tipo==='tarefa'&&<>
                {it.whatsapp&&<a className="nx-mini is-wa" href={it.whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle size={14} aria-hidden="true"/>WhatsApp</a>}
                {!readonly&&<button type="button" className="nx-mini" aria-label={'Concluir '+it.titulo} disabled={Boolean(busy)} onClick={()=>agir({action:'task_status',id:it.taskId,status:'completed'},{action:'task_status',id:it.taskId,status:it.statusAntes},'Tarefa concluída.',it.id)}><Check size={14} aria-hidden="true"/>Feito</button>}</>}
              {it.tipo==='grupo'&&<Link className="nx-mini" href={it.href}>{it.acao}</Link>}
            </div>
          </li>})}</ul>:<div className="nx-empty"><CircleCheck size={20} aria-hidden="true"/><strong>Nada atrasado agora</strong><p>Quando uma tarefa vencer ou alguém precisar ter a presença marcada, aparece aqui com o botão que resolve.</p></div>}
        </section>

        <section className="nx-sec" aria-label="Funil dos últimos 30 dias">
          <div className="nx-sh"><h2>{funil.nota?'Onde o funil vaza':'Funil'}</h2><span>leads dos últimos {funil.dias} dias</span><Link href="/leads">Abrir leads<ArrowUpRight size={14} aria-hidden="true"/></Link></div>
          {funil.etapas[0].n?<><div className="nx-funnel">{funil.etapas.map(e=><div key={e.id} className={'nx-fr'+(e.fraca?' is-weak':'')}>
            <span className="nx-fr-lab">{e.rotulo}<small>{e.sub}</small></span>
            <div><div className="nx-fr-bar" style={{width:Math.max(e.n/maxFunil*100,e.n?6:0)+'%'}}>{int(e.n)}</div></div>
            <span className="nx-fr-cv">{e.taxa!=null?e.taxa+'%':''}{e.taxa!=null&&<small> passam</small>}</span>
          </div>)}</div>
          {funil.nota&&<p className="nx-fnote"><b>O vazamento é em {funil.nota.etapa}:</b> {int(funil.nota.perdidos)} {funil.nota.perdidos===1?'lead passou':'leads passaram'} de "{funil.nota.de}" e não {funil.nota.etapa==='agendaram'?'agendou':funil.nota.etapa==='vieram'?'veio':'comprou'}. {funil.nota.dica}</p>}
          <p className="nx-foot">Conta só agendamentos e vendas vinculados ao lead.{coverage.leads?' Base: os últimos registros carregados.':''}</p></>
          :<p className="nx-foot">Nenhum lead novo nos últimos {funil.dias} dias.</p>}
        </section>
      </div>

      <div>
        <section className="nx-sec" aria-label="Faturamento do mês">
          <div className="nx-sh"><h2>{new Date().toLocaleDateString('pt-BR',{month:'long'}).replace(/^./,c=>c.toUpperCase())}</h2><span>{mes.alvo?'acumulado contra a meta':'acumulado do mês'}</span><Link href="/sales">Vendas<ArrowUpRight size={14} aria-hidden="true"/></Link></div>
          <div className="nx-mhead"><span className="nx-mval">{brl(mes.feito)}</span>
            <span className="nx-mof">{mes.alvo?'de '+brl(mes.alvo)+' · ':''}no ritmo atual fecha em <b>{brl(mes.projecao)}</b></span></div>
          <GraficoMes mes={mes}/>
          <div className="nx-facts">
            {mes.alvo?<div><span>Por dia até o fim</span><b>{mes.porDiaPrecisa!=null?brl(mes.porDiaPrecisa):'—'}</b><small className={mes.porDiaPrecisa>mes.media?'is-down':'is-up'}>a média é {brl(mes.media)}</small></div>
              :<div><span>Meta do mês</span><b>—</b><small><Link href="/sales">Definir meta</Link></small></div>}
            <div><span>Vendas no mês</span><b>{int(mes.vendas)}</b><small>{mes.vendas?'ticket '+brl(mes.feito/mes.vendas):'nenhuma ainda'}</small></div>
            <div><span>Agendados hoje</span><b>{int(regua.itens.length)}</b><small>{regua.contagem.faltou?int(regua.contagem.faltou)+' falta':'sem faltas'}</small></div>
          </div>
          {coverage.sales&&<p className="nx-foot">Base: as vendas carregadas. Veja o total em Relatórios.</p>}
        </section>

        <section className="nx-sec" aria-label="Origem dos leads e das vendas">
          <div className="nx-sh"><h2>O que traz venda</h2><span>{origem.dias} dias</span><Link href="/reports">Relatório<ArrowUpRight size={14} aria-hidden="true"/></Link></div>
          {origem.linhas.length?<><table className="nx-otab"><thead><tr><th>Origem</th><th className="nx-hide-m">Leads</th><th>Vendas</th><th>Conversão</th><th>Receita</th></tr></thead>
            <tbody>{origem.linhas.slice(0,6).map(l=><tr key={l.origem}>
              <td>{l.origem}{l.melhor&&<span className="nx-pill">converte mais</span>}</td><td className="nx-hide-m">{int(l.leads)}</td><td>{int(l.vendas)}</td>
              <td className={'nx-conv'+(l.leads>=5&&l.conversao<10?' is-low':'')}>{l.conversao}%</td>
              <td><span className="nx-rv"><i style={{width:Math.round(l.receita/maxReceita*44)+'px'}}/>{brl(l.receita)}</span></td></tr>)}</tbody></table>
            {origem.frase&&<p className="nx-onote"><b>{origem.frase}</b></p>}</>
          :<p className="nx-foot">Sem leads com origem nos últimos {origem.dias} dias.</p>}
        </section>
      </div>
    </div>

    {organizationId&&<NexusHomeTelas organizationId={organizationId}/>}

    <div className={'nx-toast'+(toast?' is-on':'')} role="status" aria-live="polite">
      {toast&&<><span>{toast.msg}</span>{toast.desfazer&&<button type="button" onClick={voltar}>Desfazer</button>}</>}
    </div>
  </div>;
}
