import { notFound } from 'next/navigation';
import CRM from '../../components/CRM';
const pages=['login','reset-password','dashboard','admin','minha-area','leads','tasks','contacts','agenda','whatsapp','reports','settings'];
export default function Page({params}){if(!pages.includes(params.section))notFound();return <CRM section={params.section}/>}
