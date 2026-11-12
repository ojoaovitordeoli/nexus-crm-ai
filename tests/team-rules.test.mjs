import test from 'node:test';
import assert from 'node:assert/strict';
import {assignableRoles,canChangeMember,canManageTeam,validateInvite} from '../lib/team-rules.mjs';

test('só admins da empresa/agência e Super Admin gerenciam equipe',()=>{
  assert.equal(canManageTeam({role:'ORGANIZATION_ADMIN'}),true);
  assert.equal(canManageTeam({role:'AGENCY_ADMIN'}),true);
  assert.equal(canManageTeam({isSuperAdmin:true}),true);
  for(const role of ['MANAGER','SDR','SELLER','VIEWER',''])assert.equal(canManageTeam({role}),false,role);
});
test('admin da empresa não concede Admin da agência',()=>{
  assert.equal(assignableRoles({}).includes('AGENCY_ADMIN'),false);
  assert.equal(assignableRoles({isSuperAdmin:true}).includes('AGENCY_ADMIN'),true);
});
test('ninguém altera o próprio acesso; agência protegida',()=>{
  assert.equal(canChangeMember({actorId:'a',target:{user_id:'a',role:'SELLER'}}).ok,false);
  assert.equal(canChangeMember({actorId:'a',target:{user_id:'b',role:'AGENCY_ADMIN'}}).ok,false);
  assert.equal(canChangeMember({actorId:'a',isSuperAdmin:true,target:{user_id:'b',role:'AGENCY_ADMIN'}}).ok,true);
  assert.equal(canChangeMember({actorId:'a',target:{user_id:'b',role:'SELLER'}}).ok,true);
  assert.equal(canChangeMember({actorId:'a',target:null}).ok,false);
});
test('cadastro valida nome, e-mail, senha forte e função permitida',()=>{
  const base={full_name:'Ana Lima',email:' Ana@Otica.com ',password:'senha-forte-123',role:'SELLER'};
  const r=validateInvite(base);assert.equal(r.ok,true);assert.equal(r.value.email,'ana@otica.com');
  assert.equal(validateInvite({...base,password:'curta'}).ok,false);
  assert.equal(validateInvite({...base,email:'x@'}).ok,false);
  assert.equal(validateInvite({...base,role:'AGENCY_ADMIN'}).ok,false);
  assert.equal(validateInvite({...base,role:'AGENCY_ADMIN'},{isSuperAdmin:true}).ok,true);
});
