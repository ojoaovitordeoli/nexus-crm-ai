// Store do Supabase (service_role) para lib/prospecting-alerts.mjs. Só roda no servidor.
// Toda consulta leva organization_id: o escopo da empresa vale mesmo com service_role.
import {logInternal} from './workflow-security.mjs';

const ALERT_FIELDS='id,organization_id,source,channel,kind,status,company_name,contact_name,contact_email,contact_phone,message_excerpt,occurred_at,handled_at';
const must=(scope,{data,error})=>{if(error){logInternal(scope,error);const e=new Error('storage');e.code=error.code;throw e}return data};

export function supabaseProspectingStore(admin){
  return {
    async findActiveToken(hash){
      const data=must('prospecting token',await admin.from('prospecting_ingest_tokens')
        .select('id,organization_id,organizations!inner(status)').eq('token_hash',hash).is('revoked_at',null).maybeSingle());
      if(!data||data.organizations?.status!=='active')return null;
      return {id:data.id,organization_id:data.organization_id};
    },
    async touchToken(id){
      const {error}=await admin.from('prospecting_ingest_tokens').update({last_used_at:new Date().toISOString()}).eq('id',id);
      if(error)logInternal('prospecting touch',error);
    },
    async insertAlerts(orgId,tokenId,rows){
      const data=must('prospecting insert',await admin.from('prospecting_alerts')
        .upsert(rows.map(r=>({...r,organization_id:orgId,token_id:tokenId})),{onConflict:'organization_id,source,external_id',ignoreDuplicates:true})
        .select('id'));
      return {inserted:(data||[]).length};
    },
    async listAlerts(orgId,{status,channel}){
      let q=admin.from('prospecting_alerts').select(ALERT_FIELDS).eq('organization_id',orgId);
      if(status==='open')q=q.in('status',['novo','em_atendimento']);else if(status!=='all')q=q.eq('status',status);
      if(channel!=='all')q=q.eq('channel',channel);
      return must('prospecting list',await q.order('occurred_at',{ascending:false}).limit(200))||[];
    },
    async updateAlertStatus(orgId,id,patch){
      return must('prospecting status',await admin.from('prospecting_alerts').update(patch)
        .eq('organization_id',orgId).eq('id',id).select(ALERT_FIELDS).maybeSingle());
    },
    async listTokens(orgId){
      return must('prospecting tokens',await admin.from('prospecting_ingest_tokens').select('token_hint,last_used_at,created_at')
        .eq('organization_id',orgId).is('revoked_at',null).order('created_at',{ascending:false}).limit(5))||[];
    },
    async createToken(orgId,row){
      must('prospecting token create',await admin.from('prospecting_ingest_tokens').insert({...row,organization_id:orgId}));
    },
    async revokeTokens(orgId){
      must('prospecting token revoke',await admin.from('prospecting_ingest_tokens').update({revoked_at:new Date().toISOString()})
        .eq('organization_id',orgId).is('revoked_at',null));
    },
    async audit(entry){
      const {error}=await admin.from('audit_logs').insert(entry);
      if(error)logInternal('prospecting audit',error);
    }
  };
}
