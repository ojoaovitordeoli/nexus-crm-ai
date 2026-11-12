// Quem pode corrigir e quem pode excluir registros da operação.
// Editar: quem escreve na operação (todos menos Somente leitura).
// Excluir: gestão (Admin da agência, Admin da empresa, Gestor).
// Venda: o vendedor corrige a própria; gestão corrige qualquer uma.
import {canManagePipeline,canWriteOperation} from './operation-rules.mjs';

export const canDeleteRecord=role=>canManagePipeline(role);
export const canEditRecord=role=>canWriteOperation(role);
export function canEditSale({role,actorId,sellerId}){
  if(canManagePipeline(role))return true;
  return canWriteOperation(role)&&Boolean(actorId)&&actorId===sellerId;
}
/** Contato com atendimento aberto não pode ir para a lixeira (o lead ficaria sem dono). */
export function contactDeleteBlock(openLeads){
  const n=Number(openLeads)||0;
  return n>0?'Este contato tem '+n+' atendimento(s) aberto(s). Exclua ou encerre o lead antes.':'';
}
