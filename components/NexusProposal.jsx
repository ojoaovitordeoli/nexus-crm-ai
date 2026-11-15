'use client';

import {useState} from 'react';
import {Check,Copy,FileText,MessageCircle,Plus,Printer,X} from 'lucide-react';
import {brl,dateBR,proposalHtml,proposalText} from '../lib/proposal.mjs';
import {whatsappUrl} from '../lib/lead-view.mjs';
import {parseBRL} from '../lib/shell-rules.mjs';

const emptyLine=()=>({name:'',quantity:'1',price:''});

// Aba "Proposta" da ficha do lead. Quem pode escrever gera; a API confere empresa e perfil.
export default function NexusProposal({lead,person,phone,onOperation,onGenerated}){
  const [lines,setLines]=useState([]);
  const [validity,setValidity]=useState('7'),[conditions,setConditions]=useState(''),[notes,setNotes]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null),[copied,setCopied]=useState(false);
  const setLine=(i,patch)=>setLines(ls=>ls.map((l,k)=>k===i?{...l,...patch}:l));
  const generate=async e=>{
    e.preventDefault();if(busy)return;
    const items=[];
    for(const [i,l] of lines.entries()){
      if(!l.name.trim())continue;
      const price=parseBRL(l.price),qty=Number(String(l.quantity).replace(',','.'));
      if(!Number.isFinite(price)||price<0){setError('Item '+(i+1)+': valor inválido. Use o formato 1.500,00.');return}
      if(!Number.isFinite(qty)||qty<=0){setError('Item '+(i+1)+': quantidade inválida.');return}
      items.push({name:l.name.trim(),quantity:qty,unit_price:price});
    }
    setBusy(true);setError('');setResult(null);setCopied(false);
    try{
      const res=await onOperation({action:'proposal_build',lead_id:lead.id,items,validity_days:Number(validity)||7,conditions,notes});
      setResult(res);onGenerated?.(res);
    }catch(err){setError(err.message||'Não foi possível gerar a proposta.')}
    finally{setBusy(false)}
  };
  const openPrint=()=>{
    const url=URL.createObjectURL(new Blob([proposalHtml(result.proposal)],{type:'text/html;charset=utf-8'}));
    // Link clicado pelo usuário: abre em nova aba sem dar acesso a esta janela (noopener).
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  };
  const copyText=async()=>{
    try{await navigator.clipboard.writeText(proposalText(result.proposal));setCopied(true)}
    catch{setError('Não foi possível copiar. Selecione e copie o texto manualmente.')}
  };
  const wa=whatsappUrl(phone);
  if(result?.proposal){
    const p=result.proposal;
    return <div className="nx13-followup nx13-proposal" aria-live="polite">
      <h3>Proposta {p.number}</h3>
      <div role="status" className="nx13-feedback success"><Check size={16}/>{result.message}</div>
      <dl className="nx13-proposal-summary">
        {p.items.map((it,i)=><div key={i}><dt>{it.name} <small>{it.quantity}{it.unit?' '+it.unit:''} × {brl(it.unitPrice)}</small></dt><dd>{brl(it.total)}</dd></div>)}
        <div className="is-total"><dt>Total</dt><dd>{brl(p.total)}</dd></div>
      </dl>
      <p>Válida até {dateBR(p.validUntil)}.</p>
      <div className="nx13-proposal-actions">
        <button type="button" className="nx13-submit" onClick={openPrint}><Printer size={16}/> Abrir para imprimir ou salvar PDF</button>
        <button type="button" className="fx-btn" onClick={copyText}>{copied?<><Check size={15}/> Texto copiado</>:<><Copy size={15}/> Copiar texto</>}</button>
        {wa&&<a className="fx-btn" href={wa+'?text='+encodeURIComponent(proposalText(p))} target="_blank" rel="noopener noreferrer"><MessageCircle size={15}/> Enviar no WhatsApp</a>}
        <button type="button" className="nx13-linkbutton" onClick={()=>{setResult(null);setCopied(false)}}>Gerar outra</button>
      </div>
      {error&&<p className="nx13-error" role="alert">{error}</p>}
      <p className="nx13-disclosure">O WhatsApp abre com o texto pronto no seu aparelho; nada é enviado sem você apertar enviar. A proposta fica registrada como nota na aba Atividade.</p>
    </div>;
  }
  return <div className="nx13-followup nx13-proposal">
    <h3>Nova proposta</h3>
    <p>Para {person}. Sem itens digitados, a proposta usa os produtos ligados a este lead ou, se não houver, o valor do lead.</p>
    <form onSubmit={generate} aria-label="Gerar proposta">
      {lines.map((l,i)=><fieldset className="nx13-proposal-line" key={i}>
        <legend className="w10-visually-hidden">Item {i+1}</legend>
        <label>Item {i+1}<input value={l.name} maxLength={160} onChange={e=>setLine(i,{name:e.target.value})} placeholder="Ex.: Lente multifocal antirreflexo" aria-label={'Descrição do item '+(i+1)}/></label>
        <div className="nx13-fieldgrid">
          <label>Qtd.<input inputMode="decimal" value={l.quantity} onChange={e=>setLine(i,{quantity:e.target.value})} aria-label={'Quantidade do item '+(i+1)}/></label>
          <label>Valor unit. (R$)<input inputMode="decimal" value={l.price} onChange={e=>setLine(i,{price:e.target.value})} placeholder="1.500,00" aria-label={'Valor unitário do item '+(i+1)}/></label>
        </div>
        <button type="button" className="nx13-linkbutton" onClick={()=>setLines(ls=>ls.filter((_,k)=>k!==i))}><X size={14}/> Remover item</button>
      </fieldset>)}
      {lines.length<20&&<button type="button" className="nx13-linkbutton" onClick={()=>setLines(ls=>[...ls,emptyLine()])}><Plus size={14}/> Adicionar item</button>}
      <div className="nx13-fieldgrid">
        <label>Validade<select value={validity} onChange={e=>setValidity(e.target.value)}>{[3,7,15,30].map(d=><option key={d} value={d}>{d} dias</option>)}</select></label>
      </div>
      <label>Condições de pagamento<textarea rows={2} maxLength={600} value={conditions} onChange={e=>setConditions(e.target.value)} placeholder="Ex.: até 10x sem juros no cartão ou 5% à vista no Pix"/></label>
      <label>Observações<textarea rows={3} maxLength={1200} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Ex.: prazo de entrega de 7 dias úteis após a aprovação"/></label>
      <button type="submit" className="nx13-submit" disabled={busy}><FileText size={16}/> {busy?'Gerando...':'Gerar proposta'}</button>
      {error&&<p className="nx13-error" role="alert">{error}</p>}
    </form>
  </div>;
}
