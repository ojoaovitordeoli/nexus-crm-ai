import test from 'node:test';
import assert from 'node:assert/strict';
import { isMissingReferralColumn, referralError, referralRanking } from '../lib/referrals.mjs';

test('coluna de indicação ausente (antes da migração) é reconhecida', () => {
  assert.equal(isMissingReferralColumn({ code: '42703', message: 'column leads.referred_by_contact_id does not exist' }), true);
  assert.equal(isMissingReferralColumn({ code: 'PGRST204', message: "Could not find the 'referred_by_contact_id' column" }), true);
  assert.equal(isMissingReferralColumn({ code: '23505', message: 'duplicate key' }), false);
  assert.equal(isMissingReferralColumn(null), false);
});

test('validação: sem indicação passa; auto-indicação e contato de outra empresa são recusados', () => {
  assert.equal(referralError({ leadContactId: 'a', referrerId: null, referrer: null }), null);
  assert.equal(referralError({ leadContactId: 'a', referrerId: 'a', referrer: { id: 'a' } }), 'O contato não pode indicar a si mesmo.');
  assert.equal(referralError({ leadContactId: 'a', referrerId: 'b', referrer: null }), 'Quem indicou precisa ser um contato desta empresa.');
  assert.equal(referralError({ leadContactId: 'a', referrerId: 'b', referrer: { id: 'b' } }), null);
});

test('ranking conta leads indicados, vendas vinculadas e valor real', () => {
  const contacts = [
    { id: 'ana', first_name: 'Ana', last_name: 'Souza' },
    { id: 'bia', first_name: 'Bia' },
  ];
  const leads = [
    { id: 'l1', referred_by_contact_id: 'ana' },
    { id: 'l2', referred_by_contact_id: 'ana' },
    { id: 'l3', referred_by_contact_id: 'bia' },
    { id: 'l4', referred_by_contact_id: null },
  ];
  const sales = [
    { lead_id: 'l1', value: 1200 },
    { lead_id: 'l3', value: '800.5' },
    { lead_id: null, value: 999 },
  ];
  assert.deepEqual(referralRanking({ leads, sales, contacts }), [
    { contact_id: 'ana', name: 'Ana Souza', leads: 2, converted: 1, value: 1200 },
    { contact_id: 'bia', name: 'Bia', leads: 1, converted: 1, value: 800.5 },
  ]);
});

test('ranking vazio quando ninguém indicou', () => {
  assert.deepEqual(referralRanking({ leads: [{ id: 'x' }], sales: [], contacts: [] }), []);
  assert.deepEqual(referralRanking(), []);
});
