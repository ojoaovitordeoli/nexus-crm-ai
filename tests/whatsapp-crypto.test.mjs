import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {encryptMetaToken,decryptMetaToken} from '../lib/whatsapp-crypto.mjs';

test('AES-256-GCM protects Meta token and supports one controlled decrypt',()=>{
 const key=randomBytes(32).toString('hex');
 const token='EAA'+randomBytes(32).toString('hex');
 const a=encryptMetaToken(token,key),b=encryptMetaToken(token,key);
 assert.notEqual(a,b,'unique IVs must differ');
 assert.equal(decryptMetaToken(a,key),token);
 assert.equal(decryptMetaToken(b,key),token);
 assert.equal(a.includes(token),false);
});
test('incorrect key or modified ciphertext cannot decrypt',()=>{
 const key=randomBytes(32).toString('hex');
 const token='EAA'+randomBytes(32).toString('hex');
 const v=encryptMetaToken(token,key);
 assert.throws(()=>decryptMetaToken(v,randomBytes(32).toString('hex')));
 assert.throws(()=>decryptMetaToken(v.slice(0,-2)+'zz',key));
});
test('missing key, invalid token and malformed sealed values are rejected',()=>{
 const key=randomBytes(32).toString('hex');
 assert.throws(()=>encryptMetaToken('abc',key));
 assert.throws(()=>encryptMetaToken('EAA'+('a'.repeat(25)),''));
 assert.throws(()=>decryptMetaToken('v1:invalid',key));
});
