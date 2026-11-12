import test from 'node:test';
import assert from 'node:assert/strict';
import {formatPhoneBR} from '../lib/format.mjs';

test('celular com DDD', ()=>assert.equal(formatPhoneBR('48996867104'),'(48) 99686-7104'));
test('fixo com DDD', ()=>assert.equal(formatPhoneBR('4833334444'),'(48) 3333-4444'));
test('com 55 na frente', ()=>assert.equal(formatPhoneBR('5548996867104'),'+55 (48) 99686-7104'));
test('já formatado continua igual', ()=>assert.equal(formatPhoneBR('(48) 99686-7104'),'(48) 99686-7104'));
test('vazio e desconhecido', ()=>{assert.equal(formatPhoneBR(null),'');assert.equal(formatPhoneBR('123'),'123')});
