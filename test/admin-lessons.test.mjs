import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {createMemoryState} from '../src/state.mjs';
import {buildSavedLesson} from '../src/lessons.mjs';
import {testerCredentials} from '../test-support/tester.mjs';
import {coolingLesson,tinyPng} from '../test-support/generated-lessons.mjs';
import {fakeBlob} from './blob.test.mjs';

async function setup(t,{openAccess=false}={}){
 const state=createMemoryState(),blob=fakeBlob();
 const accessCodes={codes:[{code:'SYNTHETIC-CREATOR',label:'creator',quota:40,expiresAt:Date.now()+86400000,hash:'synthetic'}]};
 const server=createApp({testerCredentials,accessCodes,state,imageStore:blob.store,openAccess});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const get=(path,cookie)=>fetch(origin+path,{headers:cookie?{Cookie:cookie}:{}});
 const post=(path,body,cookie,originHeader=origin)=>fetch(origin+path,{method:'POST',headers:{Origin:originHeader,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const login=async body=>{const r=await post('/api/login',body);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 return {state,blob,get,post,login};
}

test('only the password tester route grants administrator permissions',async t=>{
 const {get,post,login}=await setup(t);
 const creator=await login({code:'SYNTHETIC-CREATOR',admin:true,role:'admin'});
 const admin=await login(testerCredentials);
 assert.equal((await(await get('/api/auth',admin)).json()).admin,true);
 assert.notEqual((await(await get('/api/auth',creator)).json()).admin,true);
 assert.notEqual((await(await get('/api/auth')).json()).admin,true);
 await post('/api/logout',{},admin);
 assert.notEqual((await(await get('/api/auth',admin)).json()).admin,true);
 assert.equal((await get('/api/lessons',admin)).status,401);
});

test('local open access is not an administrator',async t=>{
 const {get,state}=await setup(t,{openAccess:true});
 await state.putLesson(buildSavedLesson({lesson:coolingLesson()},{owner:'code:unrelated'}));
 assert.notEqual((await(await get('/api/auth')).json()).admin,true);
 assert.equal((await(await get('/api/lessons')).json()).lessons.length,0);
});

test('an admin edits and deletes another creator’s private lesson without taking ownership or losing images',async t=>{
 const {state,blob,get,post,login}=await setup(t);
 const creator=await login({code:'SYNTHETIC-CREATOR'}),admin=await login(testerCredentials);
 const saved=await(await post('/api/lessons',{lesson:coolingLesson(),reviewed:true,sketch:tinyPng},creator)).json();
 const original=await state.getLesson(saved.id);
 const read=await(await get('/api/lessons/'+saved.id,admin)).json();
 assert.equal(read.canManage,true);assert.notEqual(read.mine,true);assert.equal(read.owner,undefined);
 const edited=coolingLesson();edited.title.en='An administrator corrected this title';
 const update=await post('/api/lessons',{id:saved.id,lesson:edited,sketch:saved.sketch,reviewed:true,owner:'tester'},admin);
 assert.equal(update.status,200);
 const record=await state.getLesson(saved.id);
 assert.equal(record.owner,original.owner);assert.equal(record.id,saved.id);assert.equal(record.createdAt,original.createdAt);
 assert.equal(record.shared,false);assert.equal(record.sketch,original.sketch);assert.equal(record.reviewedAt,null);
 assert.equal(blob.puts.length,1);
 assert.equal((await get('/api/lessons/'+saved.id,creator)).status,200);
 // Admin permission does not silently publish somebody else's private record.
 assert.equal((await post('/api/lessons/share',{id:saved.id,shared:true},admin)).status,404);
 assert.equal((await post('/api/lessons/delete',{id:saved.id},admin,'https://elsewhere.example')).status,403);
 assert.equal((await post('/api/lessons/delete',{id:saved.id},admin)).status,200);
 assert.equal(await state.getLesson(saved.id),null);assert.equal((await state.listLessons(original.owner)).length,0);
 assert.ok(blob.deleted.includes(original.sketch));
 assert.equal((await post('/api/lessons/delete',{id:saved.id},admin)).status,404);
});

test('shared permissions distinguish administrator access from ownership and reject invite escalation',async t=>{
 const {state,get,post,login}=await setup(t);
 const creator=await login({code:'SYNTHETIC-CREATOR'}),admin=await login(testerCredentials);
 const record=buildSavedLesson({lesson:coolingLesson()},{owner:'code:historical-owner'});record.shared=true;
 await state.putLesson(record);
 for(const cookie of [undefined,creator]){
  const shared=await(await get('/api/shared/'+record.id,cookie)).json();
  assert.notEqual(shared.mine,true);assert.notEqual(shared.canManage,true);
 }
 const shared=await(await get('/api/shared/'+record.id,admin)).json();
 assert.equal(shared.canManage,true);assert.notEqual(shared.mine,true);
 assert.equal((await(await get('/api/shared',admin)).json()).lessons[0].canManage,true);
 assert.equal((await post('/api/lessons/delete',{id:record.id,admin:true},creator)).status,404);
 assert.equal((await post('/api/lessons',{id:record.id,lesson:coolingLesson(),role:'admin'},creator)).status,404);
 assert.equal((await get('/api/lessons/'+record.id,creator)).status,404);
 assert.equal((await post('/api/lessons/delete',{id:record.id},admin)).status,200);
 assert.equal((await get('/api/shared/'+record.id)).status,404);
});

test('the administrator shelf pages through historical and private records without leaking owners',async t=>{
 const {state,get,login}=await setup(t);
 for(let i=0;i<53;i++)await state.putLesson(buildSavedLesson({lesson:coolingLesson()},{owner:'code:old-'+i,now:i}));
 const admin=await login(testerCredentials),creator=await login({code:'SYNTHETIC-CREATOR'});
 const first=await(await get('/api/lessons',admin)).json();
 assert.equal(first.scope,'all');assert.equal(first.limit,null);assert.equal(first.lessons.length,50);assert.ok(first.cursor);
 assert.ok(first.lessons.every(r=>r.canManage&&!r.owner&&!r.mine));
 const next=await(await get('/api/lessons?cursor='+first.cursor,admin)).json();
 assert.equal(next.lessons.length,3);assert.equal(next.cursor,null);
 assert.equal(new Set([...first.lessons,...next.lessons].map(r=>r.id)).size,53);
 assert.equal((await(await get('/api/lessons?admin=true',creator)).json()).lessons.length,0);
 assert.equal((await get('/api/lessons?cursor=not-a-cursor',admin)).status,400);
 assert.equal((await get('/api/lessons?cursor=18446744073709551616',admin)).status,400);
});
