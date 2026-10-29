import { notFound } from 'next/navigation';
import CRM from '../../components/CRM';
const pages=['login','reset-password','dashboard','admin','minha-area','leads','tasks','contacts','agenda','whatsapp','automations','insights','reports','settings'];
export default async function Page({params}){const {section}=await params;if(!pages.includes(section))notFound();return <CRM section={section}/>}
