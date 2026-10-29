import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';

function keyFromHex(hex){
 if(typeof hex!=='string'||!/^[a-f\d]{64}$/i.test(hex))throw new Error('Encryption key is missing or invalid');
 return Buffer.from(hex,'hex');
}
export function encryptMetaToken(token,keyHex){
 if(typeof token!=='string'||token.length<20||token.length>4096)throw new Error('Invalid Meta token');
 const iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',keyFromHex(keyHex),iv);
 const value=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return 'v1:'+iv.toString('base64url')+':'+value.toString('base64url')+':'+cipher.getAuthTag().toString('base64url');
}
export function decryptMetaToken(encrypted,keyHex){
 const parts=String(encrypted||'').split(':');
 if(parts.length!==4||parts[0]!=='v1')throw new Error('Unsupported token format');
 const iv=Buffer.from(parts[1],'base64url'),value=Buffer.from(parts[2],'base64url'),tag=Buffer.from(parts[3],'base64url');
 if(iv.length!==12||tag.length!==16)throw new Error('Malformed encrypted token');
 const decipher=createDecipheriv('aes-256-gcm',keyFromHex(keyHex),iv);
 decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(value),decipher.final()]).toString('utf8');
}
