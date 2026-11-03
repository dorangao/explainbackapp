import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {createMemoryState} from '../src/state.mjs';
import {testerCredentials} from '../test-support/tester.mjs';
import {coolingLesson,tinyPng} from '../test-support/generated-lessons.mjs';

for(const change of ['unshare','delete','save'])test(`a slow save cannot overwrite a concurrent ${change}`,async t=>{
 let start,release,armed=false;
 const entered=new Promise(r=>start=r),gate=new Promise(r=>release=r),removed=[];
 const state=createMemoryState();
 const uploaded='https://fixture.public.blob.vercel-storage.com/images/new.png';
 const imageStore={configured:true,owns:()=>false,putImage:async()=>{if(armed){start();await gate;}return uploaded;},remove:async urls=>removed.push(...urls)};
 const server=createApp({state,testerCredentials,imageStore});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>{release();return new Promise(r=>{server.close(r);server.closeAllConnections();});});
 const origin=`http://127.0.0.1:${server.address().port}`;
 const post=(path,body,cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const login=await post('/api/login',testerCredentials),cookie=login.headers.get('set-cookie').split(';')[0];
 const saved=await(await post('/api/lessons',{lesson:coolingLesson()},cookie)).json();
 const id=saved.id;
 await post('/api/lessons/share',{id,shared:true},cookie);
 armed=true;
 const pending=post('/api/lessons',{id,lesson:coolingLesson(),sketch:tinyPng},cookie);
 await entered;
 const winner=coolingLesson();winner.title.en='Winning update';
 const changed=change==='unshare'?await post('/api/lessons/share',{id,shared:false},cookie):change==='delete'?await post('/api/lessons/delete',{id},cookie):await post('/api/lessons',{id,lesson:winner},cookie);
 assert.equal(changed.status,200);
 release();const response=await pending;
 assert.equal(response.status,409);
 const record=await state.getLesson(id);
 if(change==='delete')assert.equal(record,null);
 else if(change==='unshare')assert.equal(record.shared,false);
 else assert.equal(record.title.en,'Winning update');
 assert.ok(removed.includes(uploaded),'only the refused save’s new image is cleaned up');
 if(change!=='save')assert.equal((await fetch(origin+'/api/shared/'+id)).status,404);
});

test('memory lesson writes compare the expected snapshot and do not recreate deleted updates',async()=>{
 const state=createMemoryState();const record={id:'0123456789abcdef',owner:'fixture',updatedAt:1,shared:true};
 assert.equal(await state.putLesson(record,50,null),true);
 assert.equal(await state.putLesson({...record,shared:false},50,record),true);
 assert.equal(await state.putLesson({...record,updatedAt:2},50,record),false);
 const current=await state.getLesson(record.id);await state.deleteLesson(record.owner,record.id);
 assert.equal(await state.putLesson({...current,updatedAt:3},50,current),false);
});

test('a refused save never deletes an image it only referenced',async t=>{
 const state=createMemoryState(),reused='https://fixture.public.blob.vercel-storage.com/images/reused.png',removed=[];
 let entered,release;
 const reached=new Promise(r=>entered=r),gate=new Promise(r=>release=r),put=state.putLesson;
 state.putLesson=async(...args)=>{if(args[0].sketch===reused){entered();await gate;}return put(...args);};
 const server=createApp({state,testerCredentials,imageStore:{configured:true,owns:url=>url===reused,remove:async urls=>removed.push(...urls)}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>{release();return new Promise(r=>{server.close(r);server.closeAllConnections();});});
 const origin=`http://127.0.0.1:${server.address().port}`;
 const post=(path,body,cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 const login=await post('/api/login',testerCredentials),cookie=login.headers.get('set-cookie').split(';')[0];
 const saved=await(await post('/api/lessons',{lesson:coolingLesson()},cookie)).json();
 const pending=post('/api/lessons',{id:saved.id,lesson:coolingLesson(),sketch:reused},cookie);
 await reached;
 await post('/api/lessons/share',{id:saved.id,shared:true},cookie);
 release();assert.equal((await pending).status,409);
 assert.deepEqual(removed,[]);
});

test('a cover redraw compares the lesson snapshot from before image generation',async()=>{
 const {drawCover}=await import('../src/studio-images.mjs');
 const {buildSavedLesson}=await import('../src/lessons.mjs');
 const state=createMemoryState(),removed=[];
 const original=buildSavedLesson({lesson:coolingLesson()},{owner:'fixture',now:1});
 await state.putLesson(original,50,null);
 await state.create('fixture-session',{owner:'login',createdAt:Date.now()});
 const winner='https://fixture.public.blob.vercel-storage.com/images/winner.png';
 const pending='https://fixture.public.blob.vercel-storage.com/images/pending.png';
 const ctx={body:{savedId:original.id,sessionId:'fixture-session'},s:{attempts:0,llm:{}},owner:'fixture',tester:{id:'login'},state,sessionLimit:8,bucket:'fixture',limit:10,save:async()=>true,access:{active:async()=>true},traceEnabled:false,imageBudgetMs:()=>1000,
  imageCall:async()=>{await state.putLesson({...original,cover:winner,coverDrawn:true,updatedAt:2},50,original);return {dataUrl:tinyPng,model:'fixture'};},
  storeImage:async()=>pending,imageStore:{remove:async urls=>removed.push(...urls)},json:()=>assert.fail('a stale redraw must not succeed')};
 await assert.rejects(drawCover(ctx),error=>error.status===409);
 assert.equal((await state.getLesson(original.id)).cover,winner);
 assert.deepEqual(removed,[pending]);
});
