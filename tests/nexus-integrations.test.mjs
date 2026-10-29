import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {sealSecret,openSecret} from '../lib/nexus-secrets.mjs';
import {constantSecret,evolutionSettings,parseDirectMessage,qrImage} from '../lib/nexus-evolution.mjs';

test('Encryption seals tokens with unique IVs and rejects tampering',()=>{
 const key=randomBytes(32).toString('hex'),token='EAA'+randomBytes(32).toString('hex');
 const one=sealSecret(token,key),two=sealSecret(token,key);
 assert.notEqual(one,two);assert.equal(openSecret(one,key),token);
 assert.equal(one.includes(token),false);
 assert.throws(()=>openSecret(one,randomBytes(32).toString('hex')));
 const chunks=one.split('.');chunks[2]=chunks[2].slice(0,-3)+'xxx';
 assert.throws(()=>openSecret(chunks.join('.'),key));
 assert.throws(()=>sealSecret('short',key));
});
test('Provider URL must be valid HTTPS and API key server-side',()=>{
 assert.equal(evolutionSettings({EVOLUTION_API_URL:'http://external.example',EVOLUTION_API_KEY:'long-auth-key-secret'}),null);
 assert.equal(evolutionSettings({EVOLUTION_API_URL:'https://gateway.example',EVOLUTION_API_KEY:'short'}),null);
 assert.equal(evolutionSettings({EVOLUTION_API_URL:'https://gateway.example',EVOLUTION_API_KEY:'long-auth-key-secret'}).base,'https://gateway.example');
});
test('Webhook constant-time secret comparison is exact',()=>{
 assert.equal(constantSecret('this-is-a-secret','this-is-a-secret'),true);
 assert.equal(constantSecret('this-is-a-secret','different'),false);
 assert.equal(constantSecret('',null),false);
});
test('Direct inbound parser accepts text and excludes groups, bad keys and broadcasts',()=>{
 const data={event:'messages.upsert',instance:'nx_abcdef',data:{key:{id:'MSG-1234',remoteJid:'5511988877665@s.whatsapp.net',fromMe:false},messageTimestamp:1830000000,message:{conversation:'Quero conhecer o CRM'}}};
 const event=parseDirectMessage(data);
 assert.equal(event.remote_jid,'5511988877665@s.whatsapp.net');
 assert.equal(event.provider_id,'MSG-1234');
 assert.equal(event.text_body,'Quero conhecer o CRM');
 assert.equal(parseDirectMessage({...data,data:{...data.data,key:{...data.data.key,remoteJid:'5511@g.us'}}}),null);
 assert.equal(parseDirectMessage({event:'connection.update',data:data.data}),null);
});
test('QR code images only accept well-formed bounded PNG base64',()=>{
 const good='a'.repeat(200);
 assert.equal(qrImage({base64:good}),'data:image/png;base64,'+good);
 assert.equal(qrImage({base64:'<script>alert(1)</script>'}),null);
 assert.equal(qrImage({base64:'x'.repeat(310000)}),null);
});
