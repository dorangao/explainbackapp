import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync} from 'node:zlib';
import {makeJudgeChallenge,numberImage} from '../src/judge-challenge.mjs';
test('image checks return raster pixels and no answer or digest in the public envelope',()=>{
 const c=makeJudgeChallenge(),png=Buffer.from(c.public.image.split(',')[1],'base64');
 assert.deepEqual([...png.subarray(0,8)],[137,80,78,71,13,10,26,10]);
 assert.equal(png.readUInt32BE(16),240);assert.equal(png.readUInt32BE(20),88);
 const chunks=[];for(let at=8;at<png.length;){const n=png.readUInt32BE(at),type=png.toString('ascii',at+4,at+8);chunks.push(type);if(type==='IDAT')assert.equal(inflateSync(png.subarray(at+8,at+8+n)).length,88*(1+240*3));at+=12+n;}
 assert.deepEqual(chunks,['IHDR','IDAT','IEND']);assert.doesNotMatch(JSON.stringify(c.public),/answer|Hash/);
 assert.notEqual(numberImage('24680'),numberImage('24680'));
});
