import Link from 'next/link';

// Rota inexistente (ex.: /relatorio): antes caía na página padrão do Next em inglês.
export default function NotFound(){
  return <main className="staff-denied" role="main">
    <h1>Página não encontrada</h1>
    <p>O endereço acessado não existe no NEXUS CRM.</p>
    <Link href="/dashboard">Voltar para a Visão geral</Link>
  </main>;
}
