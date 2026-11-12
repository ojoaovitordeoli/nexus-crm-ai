import {NextResponse} from 'next/server';
// Verificação de saúde para Docker, Coolify e monitor de disponibilidade.
// Não toca no banco nem revela configuração: só diz que o servidor responde.
export const dynamic='force-dynamic';
export function GET(){
  return NextResponse.json({ok:true,service:'nexus-crm',time:new Date().toISOString()},{headers:{'cache-control':'no-store'}});
}
