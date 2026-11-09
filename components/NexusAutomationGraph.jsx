'use client';
import {useEffect,useMemo,useState} from 'react';
import {MarkerType,ReactFlow} from '@xyflow/react';

// Prévia sóbria: dois blocos compactos e uma ligação contínua, sem gradiente,
// grade pontilhada ou animação. As cores vêm dos tokens --fx-* (claro/escuro).
const node={borderRadius:6,border:'1px solid var(--fx-border-strong)',background:'var(--fx-surface)',color:'var(--fx-text)',
  fontSize:12,fontWeight:600,lineHeight:1.4,width:220,padding:'8px 10px',boxShadow:'none',textAlign:'left'};
const label=(kind,text)=><span className="fx-flow-node"><small>{kind}</small><span>{text}</span></span>;

export default function NexusAutomationGraph({stageName,taskTitle,delayDays=1}){
  // Em telas estreitas os blocos ficam empilhados para o texto continuar legível.
  const [stacked,setStacked]=useState(false);
  useEffect(()=>{
    const mq=window.matchMedia('(max-width:640px)');
    const sync=()=>setStacked(mq.matches);sync();
    mq.addEventListener('change',sync);return ()=>mq.removeEventListener('change',sync);
  },[]);
  const nodes=useMemo(()=>[
    {id:'trigger',type:'input',position:{x:0,y:0},sourcePosition:stacked?'bottom':'right',
      data:{label:label('Quando o lead entrar em',String(stageName||'Selecione uma etapa').slice(0,55))},style:node},
    {id:'action',type:'output',position:stacked?{x:0,y:96}:{x:300,y:0},targetPosition:stacked?'top':'left',
      data:{label:label('Criar tarefa',String(taskTitle||'Defina a tarefa').slice(0,55)+' · '+(Number(delayDays)===0?'hoje':'em '+Number(delayDays)+' dia(s)'))},style:node}
  ],[stageName,taskTitle,delayDays,stacked]);
  const edges=useMemo(()=>[
    {id:'lead-to-task',source:'trigger',target:'action',type:'straight',animated:false,style:{stroke:'var(--fx-border-strong)',strokeWidth:1.5},
      markerEnd:{type:MarkerType.ArrowClosed,color:'var(--fx-faint)',width:16,height:16}}
  ],[]);
  return <div className="fx-flow" role="region" aria-label="Prévia do fluxo de automação">
    <ReactFlow key={stacked?'v':'h'} nodes={nodes} edges={edges} fitView fitViewOptions={{padding:.18,maxZoom:1}}
      nodesDraggable={false} nodesConnectable={false}
      elementsSelectable={false} panOnDrag={false}
      zoomOnScroll={false} zoomOnPinch={false} zoomOnDoubleClick={false} preventScrolling={false}
      proOptions={{hideAttribution:true}}
      onNodeClick={(_,n)=>{
        document.getElementById(n.id==='trigger'?'nx-workflow-stage':'nx-workflow-task')?.focus();
      }}/>
  </div>;
}
