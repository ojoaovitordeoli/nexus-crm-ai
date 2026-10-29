import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
const key=value=>{
 if(!/^[\da-f]{64}$/i.test(String(value||'')))throw new Error('A chave de criptografia do Nexus não está configurada.');
 return Buffer.from(value,'hex');
};
export function sealSecret(secret,keyHex){
 if(typeof secret!=='string'||secret.length<20||secret.length>6000)throw new Error('Credencial inválida.');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(keyHex),iv);
 const payload=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]);
 return ['v1',iv.toString('base64url'),payload.toString('base64url'),cipher.getAuthTag().toString('base64url')].join('.');
}
export function openSecret(encrypted,keyHex){
 const parts=String(encrypted||'').split('.');
 if(parts.length!==4||parts[0]!=='v1')throw new Error('Credencial cifrada inválida.');
 const iv=Buffer.from(parts[1],'base64url'),tag=Buffer.from(parts[3],'base64url');
 if(iv.length!==12||tag.length!==16)throw new Error('Credencial cifrada inválida.');
 const decipher=createDecipheriv('aes-256-gcm',key(keyHex),iv);
 decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(Buffer.from(parts[2],'base64url')),decipher.final()]).toString('utf8');
}
