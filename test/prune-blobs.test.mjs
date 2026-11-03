import test from 'node:test';
import assert from 'node:assert/strict';
import {referencedImages} from '../scripts/prune-blobs-core.mjs';

test('pruning keeps lesson images and active reviewed-gallery cover overrides across credential namespaces',async()=>{
 const host='https://fixture.public.blob.vercel-storage.com/images/';
 const seen=[];
 const redis=async command=>{
  seen.push(command);
  if(command[0]==='SCAN'){
   const [,cursor,,pattern]=command;
   if(pattern==='explainback:production:v1:*:lesson:*')return cursor==='0'?['17',['lesson-a']]:['0',['lesson-b']];
   if(pattern==='explainback:production:v1:*:covers:')return cursor==='0'?['23',['covers-a']]:['0',['covers-b']];
  }
  if(command[0]==='MGET')return command.slice(1).map(key=>key==='lesson-a'?JSON.stringify({cover:host+'lesson.png',illustrations:{0:host+'slide.png'}}):null);
  if(command[0]==='HGETALL')return command[1]==='covers-a'?['cooling',JSON.stringify({src:host+'override.png'})]:['pendulum',JSON.stringify({src:host+'second.png'})];
  throw new Error('Unexpected Redis command');
 };
 const result=await referencedImages(redis,'production');
 assert.deepEqual([...result.referenced].sort(),['lesson.png','slide.png','override.png','second.png'].map(name=>host+name).sort());
 assert.ok(seen.some(command=>command[0]==='HGETALL'&&command[1]==='covers-b'));
});

test('pruning fails closed on malformed active cover records',async()=>{
 const redis=async command=>{
  if(command[0]==='SCAN')return command[3].endsWith(':covers:')?['0',['covers-a']]:['0',[]];
  if(command[0]==='HGETALL')return ['cooling','not-json'];
  throw new Error('Unexpected Redis command');
 };
 await assert.rejects(referencedImages(redis,'production'));
});

test('pruning fails closed on malformed lesson records',async()=>{
 const redis=async command=>{
  if(command[0]==='SCAN')return command[3].endsWith(':lesson:*')?['0',['lesson-a']]:['0',[]];
  if(command[0]==='MGET')return ['not-json'];
  throw new Error('Unexpected Redis command');
 };
 await assert.rejects(referencedImages(redis,'production'));
});
