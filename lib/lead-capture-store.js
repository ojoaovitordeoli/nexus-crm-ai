// Store do Supabase (service_role) para lib/lead-capture.mjs. Só roda no servidor.
// Toda consulta leva organization_id: o escopo da empresa vale mesmo com service_role.
import {logInternal} from './workflow-security.mjs';

const must=(scope,{data,error})=>{if(error){logInternal(scope,error);const e=new Error('storage');e.code=error.code;e.message=error.message;throw e}return data};

export function supabaseCaptureStore(admin){
  return {
    async findActiveToken(hash){
      const data=must('captura token',await admin.from('lead_capture_tokens')
        .select('id,organization_id,organizations!inner(status)').eq('token_hash',hash).is('revoked_at',null).maybeSingle());
      if(!data||data.organizations?.status!=='active')return null;
      return {id:data.id,organization_id:data.organization_id};
    },
    async touchToken(id){
      const {error}=await admin.from('lead_capture_tokens').update({last_used_at:new Date().toISOString()}).eq('id',id);
      if(error)logInternal('captura touch',error);
    },
    // Contato da mesma empresa pelo WhatsApp (com ou sem DDI 55) ou pelo e-mail.
    async findContact(orgId,{whatsapp,email}){
      if(whatsapp){
        const phones=[whatsapp,whatsapp.startsWith('55')?whatsapp.slice(2):null].filter(Boolean);
        const r=must('captura contato fone',await admin.from('contacts').select('id').eq('organization_id',orgId)
          .is('deleted_at',null).in('whatsapp',phones).order('created_at',{ascending:true}).limit(1));
        if(r?.[0])return r[0];
      }
      if(email){
        const r=must('captura contato email',await admin.from('contacts').select('id').eq('organization_id',orgId)
          .is('deleted_at',null).ilike('email',email).order('created_at',{ascending:true}).limit(1));
        if(r?.[0])return r[0];
      }
      return null;
    },
    async createContact(orgId,row){
      return must('captura criar contato',await admin.from('contacts').insert({...row,organization_id:orgId}).select('id').single());
    },
    // Atendimento aberto no funil padrão (lead sem funil conta como padrão).
    async findOpenLead(orgId,contactId){
      const pipes=must('captura funis',await admin.from('pipelines').select('id,is_default').eq('organization_id',orgId)
        .order('position',{ascending:true}).order('created_at',{ascending:true}).limit(50))||[];
      const def=(pipes.find(p=>p.is_default)||pipes[0])?.id||null;
      const rows=must('captura lead aberto',await admin.from('leads').select('id,pipeline_id,temperature,score')
        .eq('organization_id',orgId).eq('contact_id',contactId).is('deleted_at',null).is('closed_at',null).limit(50))||[];
      return rows.find(l=>(l.pipeline_id||def)===def)||null;
    },
    async firstStage(orgId){
      const pipes=must('captura funis',await admin.from('pipelines').select('id,is_default').eq('organization_id',orgId)
        .order('position',{ascending:true}).order('created_at',{ascending:true}).limit(50))||[];
      const pipe=pipes.find(p=>p.is_default)||pipes[0];
      if(!pipe)return null;
      const st=must('captura etapas',await admin.from('pipeline_stages').select('id,is_won,is_lost')
        .eq('pipeline_id',pipe.id).order('position',{ascending:true}))||[];
      const first=st.find(s=>!s.is_won&&!s.is_lost);
      return first?{pipeline_id:pipe.id,stage_id:first.id}:null;
    },
    async createLead(orgId,row){
      return must('captura criar lead',await admin.from('leads').insert({...row,organization_id:orgId}).select('id').single());
    },
    async updateLead(orgId,id,patch){
      must('captura atualizar lead',await admin.from('leads').update(patch).eq('organization_id',orgId).eq('id',id).select('id'));
    },
    async addNote(orgId,{lead_id,contact_id,content}){
      const {error}=await admin.from('notes').insert({organization_id:orgId,lead_id,contact_id,content});
      if(error)logInternal('captura nota',error);
    },
    async logStage(leadId,stageId){
      const {error}=await admin.from('lead_stage_history').insert({lead_id:leadId,from_stage_id:null,to_stage_id:stageId});
      if(error)logInternal('captura trilha',error);
    },
    async audit(entry){
      const {error}=await admin.from('audit_logs').insert(entry);
      if(error)logInternal('captura auditoria',error);
    },
    async listTokens(orgId){
      return must('captura chaves',await admin.from('lead_capture_tokens').select('token_hint,last_used_at,created_at')
        .eq('organization_id',orgId).is('revoked_at',null).order('created_at',{ascending:false}).limit(5))||[];
    },
    async createToken(orgId,row){
      must('captura criar chave',await admin.from('lead_capture_tokens').insert({...row,organization_id:orgId}).select('id'));
    },
    async revokeTokens(orgId){
      must('captura revogar',await admin.from('lead_capture_tokens').update({revoked_at:new Date().toISOString()})
        .eq('organization_id',orgId).is('revoked_at',null).select('id'));
    },
  };
}
