// V54 — automações por conversa: validação dos gatilhos, execução "faltou/compareceu" (uma vez só, na empresa certa),
// papéis do assistente e a migração (regra de etapa por gatilho, acesso só do servidor, rollback).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {validateFollowupRule} from '../lib/workflow-security.mjs';
import {runAppointmentAutomations} from '../lib/automation-runner.js';
import {toolNamesFor} from '../lib/assistant/rules.mjs';

const STAGE = '33333333-3333-4333-8333-333333333333';
test('gatilhos: etapa exige etapa; faltou/compareceu não usam etapa; gatilho estranho é recusado', () => {
  assert.equal(validateFollowupRule({name: 'Retorno', task_title: 'Ligar', delay_days: 1, stage_id: STAGE}).data.trigger_type, 'lead_stage_changed');
  assert.ok(validateFollowupRule({name: 'Retorno', task_title: 'Ligar', delay_days: 1}).error, 'etapa obrigatória no gatilho de etapa');
  const f = validateFollowupRule({name: 'Faltou', task_title: 'Remarcar', delay_days: 1, trigger_type: 'appointment_no_show', stage_id: STAGE});
  assert.equal(f.data.stage_id, null);
  assert.equal(f.data.action_type, 'create_followup_task');
  assert.ok(validateFollowupRule({name: 'X do lead', task_title: 'Mandar', delay_days: 1, trigger_type: 'send_whatsapp'}).error);
  assert.ok(validateFollowupRule({name: 'Faltou', task_title: 'Remarcar', delay_days: 31, trigger_type: 'appointment_no_show'}).error);
});

function fakeAdmin({rules = [], dup = false} = {}) {
  const log = [];
  return {log, from(t) {
    const q = {t, ops: []}; log.push(q);
    const b = new Proxy({}, {get(_, m) {
      if (m === 'then') return (res, rej) => {
        let r = {data: null, error: null};
        if (t === 'automation_rules') r = {data: rules, error: null};
        if (t === 'automation_executions' && q.ops.some(o => o[0] === 'insert')) r = dup ? {data: null, error: {code: '23505'}} : {data: {id: 'e1'}, error: null};
        if (t === 'tasks') r = {data: {id: 'k1'}, error: null};
        return Promise.resolve(r).then(res, rej);
      };
      return (...a) => { q.ops.push([m, ...a]); return b; };
    }});
    return b;
  }};
}
const ORG = '11111111-1111-4111-8111-111111111111';

test('faltou: cria a tarefa no lead do agendamento, na empresa certa, com prazo', async () => {
  const admin = fakeAdmin({rules: [{id: 'r1', task_title: 'Remarcar exame', delay_days: 1}]});
  const r = await runAppointmentAutomations(admin, {organizationId: ORG, appointment: {id: 'a1', lead_id: 'l1', title: 'Exame — Ana'}, status: 'no_show', actorId: 'u1'});
  assert.equal(r.executed, 1);
  const regra = admin.log.find(q => q.t === 'automation_rules');
  assert.ok(regra.ops.some(o => o[0] === 'eq' && o[1] === 'organization_id' && o[2] === ORG));
  assert.ok(regra.ops.some(o => o[0] === 'eq' && o[1] === 'trigger_type' && o[2] === 'appointment_no_show'));
  assert.ok(regra.ops.some(o => o[0] === 'eq' && o[1] === 'enabled' && o[2] === true), 'só regras ligadas');
  const task = admin.log.find(q => q.t === 'tasks').ops.find(o => o[0] === 'insert')[1];
  assert.equal(task.organization_id, ORG); assert.equal(task.lead_id, 'l1'); assert.equal(task.title, 'Remarcar exame — Exame — Ana');
  assert.match(task.due_date, /^\d{4}-\d{2}-\d{2}$/);
});

test('mesmo evento duas vezes não cria tarefa repetida', async () => {
  const r = await runAppointmentAutomations(fakeAdmin({rules: [{id: 'r1', task_title: 'Remarcar', delay_days: 0}], dup: true}), {organizationId: ORG, appointment: {id: 'a1'}, status: 'no_show', actorId: 'u1'});
  assert.equal(r.executed, 0); assert.equal(r.already_processed, 1);
});

test('outros status (agendado, cancelado) não disparam nada', async () => {
  const admin = fakeAdmin({rules: [{id: 'r1', task_title: 'X', delay_days: 0}]});
  assert.equal((await runAppointmentAutomations(admin, {organizationId: ORG, appointment: {id: 'a1'}, status: 'cancelled'})).executed, 0);
  assert.equal(admin.log.length, 0);
});

test('só gerente/admin recebe as ferramentas de criar e pausar automação; todos podem ver', () => {
  assert.equal(toolNamesFor('MANAGER').includes('propor_automacao'), true);
  assert.equal(toolNamesFor('SELLER').includes('propor_automacao'), false);
  assert.equal(toolNamesFor('SELLER').includes('propor_pausar_automacao'), false);
  assert.equal(toolNamesFor('VIEWER').includes('ver_automacoes'), true);
});

const file = n => readFileSync(fileURLToPath(new URL('../supabase/' + n, import.meta.url)), 'utf8');
test('migração V54: regra de etapa por gatilho, só servidor acessa e rollback', async () => {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin; grant usage on schema public to authenticated, anon;
    create table public.organizations(id uuid primary key); create table public.pipeline_stages(id uuid primary key); create table public.tasks(id uuid primary key);
    insert into organizations values ('${ORG}'); insert into pipeline_stages values ('${STAGE}');`);
  await db.exec(file('20261121_v54_automacoes.sql'));
  const ins = (trig, stage) => db.exec(`insert into automation_rules(organization_id,created_by,name,trigger_type,stage_id,task_title) values ('${ORG}','${ORG}','r-${trig}-${stage ? 1 : 0}','${trig}',${stage ? `'${STAGE}'` : 'null'},'Tarefa')`);
  await ins('appointment_no_show', false);
  await ins('lead_stage_changed', true);
  await assert.rejects(ins('lead_stage_changed', false), /check/);
  await assert.rejects(ins('appointment_completed', true), /check/);
  await assert.rejects(ins('send_whatsapp', false), /check/);
  await db.exec(`set role authenticated;`);
  await assert.rejects(db.query(`select * from automation_rules`), /permission denied/);
  await db.exec(`reset role;`);
  await db.exec(file('20261121_v54_automacoes_rollback.sql'));
  assert.equal((await db.query(`select count(*)::int n from information_schema.tables where table_name like 'automation_%'`)).rows[0].n, 0);
});
