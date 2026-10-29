'use client';
import {useMemo} from 'react';
import {Background,Controls,MarkerType,ReactFlow} from '@xyflow/react';

export default function NexusAutomationGraph({stageName,taskTitle,delayDays=1}){
  const nodes=useMemo(()=>[
    {id:'trigger',type:'input',position:{x:30,y:87},data:{label:'GATILHO • Lead entrou em: '+String(stageName||'Selecione uma etapa').slice(0,55)},
      style:{borderRadius:14,border:'1px solid rgba(71,112,232,.29)',background:'#eff5ff',color:'#284a92',fontSize:11,fontWeight:800,width:208,padding:16,boxShadow:'0 10px 24px rgba(50,91,160,.09)'}},
    {id:'action',type:'output',position:{x:344,y:87},data:{label:'AÇÃO • Criar: '+String(taskTitle||'Defina a tarefa').slice(0,55)+' · '+(Number(delayDays)===0?'Hoje':'+'+Number(delayDays)+' dia(s)')},
      style:{borderRadius:14,border:'1px solid rgba(25,164,123,.29)',background:'#ebfcf5',color:'#176b54',fontSize:11,fontWeight:800,width:208,padding:16,boxShadow:'0 10px 24px rgba(30,133,100,.08)'}}
  ],[stageName,taskTitle,delayDays]);
  const edges=useMemo(()=>[
    {id:'lead-to-task',source:'trigger',target:'action',type:'smoothstep',animated:true,style:{stroke:'#6291f6',strokeWidth:2.6},
      markerEnd:{type:MarkerType.ArrowClosed,color:'#6291f6',width:18,height:18}}
  ],[]);
  return <div className="nx-flow-canvas" role="region" aria-label="Prévia do fluxo de automação">
    <ReactFlow nodes={nodes} edges={edges} fitView fitViewOptions={{padding:.27}}
      nodesDraggable={false} nodesConnectable={false}
      elementsSelectable={false} panOnDrag={true}
      zoomOnScroll={false} zoomOnPinch={true}
      onNodeClick={(_,node)=>{
        document.getElementById(node.id==='trigger'?'nx-workflow-stage':'nx-workflow-task')?.focus();
      }}>
      <Background gap={18} size={1.3} color="#aec6ef"/>
      <Controls showInteractive={false}/>
    </ReactFlow>
  </div>;
}
