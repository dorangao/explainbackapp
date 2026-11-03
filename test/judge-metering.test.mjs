import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {createMemoryJudgeStore,judgeCookieId,createJudgeAccess} from '../src/judge-access.mjs';
import {createTesterAuth} from '../src/tester-auth.mjs';
import {testerCredentials} from '../test-support/tester.mjs';
import {coolingLesson} from '../test-support/generated-lessons.mjs';
const bi=x=>({en:x,zh:'示例'+x});
const ready=()=>({id:'resp_draft',structured:{name:'compose_lesson',value:{status:'ready',message:bi('Ready'),lesson:coolingLesson()}},usage:{input_tokens:10,output_tokens:20}});
async function setup(t,options={}){
 const store=options.judgeStore??createMemoryJudgeStore();
 const server=createApp({testerCredentials,configured:true,judgeMode:true,judgeStore:store,imageCall:null,imageStore:null,...options});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const post=(path,body,cookie='')=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 const login=await post('/api/login',{judge:true});const cookie=login.headers.get('set-cookie').split(';')[0];
 const send=(path,body)=>post(path,body,cookie);
 const session=await(await send('/api/studio/session',{synthetic:true,language:'en'})).json();
 return {store,cookie,send,post,sessionId:session.sessionId,get:path=>fetch(origin+path,{headers:{Cookie:cookie}})};
}
test('provider retries, generated cover and slide images are individually charged, and preflight is free',async t=>{
 let calls=0,images=0;
 const {store,send,sessionId,get}=await setup(t,{quotaMultiplier:10,modelCall:async args=>{
  calls++;if(args.previousResponseId)throw Object.assign(new Error('expired chain'),{status:404});
  if(args.tools[0].name==='make_show')return {structured:{name:'make_show',value:{coverPrompt:'A warm mug',slides:['cover','claim','experiment','evidence','transfer','takeaway'].map(kind=>({kind,chapter:0,heading:bi(kind),narration:bi('A spoken line.'),...(['claim','transfer'].includes(kind)?{illustrate:true}:{})}))}}};
  return ready();
 },imageCall:async()=>{images++;return {dataUrl:'data:image/webp;base64,QUJD',model:'muse-image-1.0'};}});
 const draft={sessionId,topic:'Why does coffee cool?',creation:'generated'};
 assert.equal((await send('/api/studio/compose',draft)).status,200);
 assert.equal((await send('/api/studio/compose',draft)).status,200);
 assert.equal(calls,3);
 assert.equal((await send('/api/studio/show',{sessionId,lesson:coolingLesson()})).status,200);
 assert.equal(images,3);assert.equal(calls,5);
 const status=await(await get('/api/status')).json();assert.equal(status.access.remaining,42);assert.equal(status.access.quota,50);
 const before=(await store.list()).daily.used;
 assert.equal((await send('/api/studio/compose',{sessionId,topic:''})).status,400);
 assert.equal((await send('/api/studio/cover',{sessionId,lessonId:'vehicle'})).status,403);
 assert.equal((await store.list()).daily.used,before);
 const row=(await store.list()).sessions[0];assert.equal(row.calls,8);assert.equal(row.failed,2);assert.equal(row.models['muse-image-1.0'],3);
});
test('HTTP quota errors stop dispatch at 50 across workflow sessions, remain 429, and cannot access another session',async t=>{
 let calls=0;const {store,cookie,send,post,sessionId}=await setup(t,{modelCall:async()=>{calls++;return ready();}});
 for(let i=0;i<49;i++)await store.reserve(judgeCookieId(cookie),{model:'fixture',action:'fixture'});
 assert.equal((await send('/api/studio/compose',{sessionId,topic:'Coffee',creation:'generated'})).status,200);
 const next=await(await send('/api/studio/session',{synthetic:true,language:'en'})).json();
 const blocked=await send('/api/studio/compose',{sessionId:next.sessionId,topic:'Coffee',creation:'generated'});
 assert.equal(blocked.status,429);assert.equal((await blocked.json()).code,'JUDGE_SESSION_LIMIT');assert.equal(calls,1);
 const fresh=await post('/api/login',{judge:true},cookie),freshCookie=fresh.headers.get('set-cookie').split(';')[0];
 assert.equal((await post('/api/studio/compose',{sessionId,topic:'Coffee'},freshCookie)).status,404);
 assert.equal((await store.list()).daily.used,50);
});
test('background dispatch counts once while repeated polling is free',async t=>{
 let calls=0;const target={id:'meta:muse-wonder-1.0',provider:'meta',model:'muse-wonder-1.0',configured:true};
 const router={defaultId:target.id,list:()=>[target],call:async()=>assert.fail('unexpected foreground call'),startBackground:async()=>{calls++;return {pendingId:'resp_background'};},pollBackground:async()=>ready()};
 const {send,sessionId,store}=await setup(t,{router});
 assert.equal((await send('/api/studio/compose',{sessionId,topic:'Coffee',creation:'generated',background:true})).status,202);
 for(let i=0;i<2;i++)assert.equal((await send('/api/studio/poll',{sessionId})).status,200);
 assert.equal(calls,1);assert.equal((await store.list()).daily.used,1);
});
test('expiry during a provider call discards its result; storage reservation failure never calls provider',async()=>{
 let time=1000;const store=createMemoryJudgeStore({now:()=>time});
 const gate=createJudgeAccess({auth:createTesterAuth(),store,enabled:true,now:()=>time});
 const login=await gate.auth.login({judge:true});let calls=0;
 await assert.rejects(gate.run(login,{model:'m',action:'a'},async()=>{calls++;time+=1800000;return ready();}),{code:'JUDGE_EXPIRED'});
 assert.equal(calls,1);assert.equal((await store.list()).daily.used,1);
 const unavailable=createJudgeAccess({auth:createTesterAuth(),store:{...store,reserve:async()=>{throw new Error('unavailable');}},enabled:true});
 await assert.rejects(unavailable.run(login,{model:'m',action:'a'},async()=>calls++),{code:'JUDGE_STORAGE'});assert.equal(calls,1);
});
test('transcription and segmentation share the same trial allowance; coach starts report the trial ceiling',async t=>{
 const {makeWav}=await import('../src/wav.mjs');let voices=0,segments=0;
 const {send,sessionId,store}=await setup(t,{transcribeCall:async()=>{voices++;return {text:'It cools',model:'muse-voice-transcribe-1.0'};},segmentCall:async()=>{segments++;return {boxes:[],width:1,height:1,model:'sam-3.1'};}});
 assert.equal((await send('/api/studio/transcribe',{sessionId,language:'en',audio:makeWav().toString('base64')})).status,200);
 assert.equal((await send('/api/studio/detect',{sessionId,concept:'mug',image:'data:image/webp;base64,QUJD'})).status,200);
 assert.equal(voices,1);assert.equal(segments,1);assert.equal((await store.list()).daily.used,2);
 const coach=await(await send('/api/session',{synthetic:true,language:'en',problemId:'crossing'})).json();
 assert.equal(coach.attemptsRemaining,50);
});

test('trial saves are bounded before uploads even after the model allowance is exhausted',async t=>{
 let uploaded=0;const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0T8AAAAASUVORK5CYII=';
 const imageStore={owns:()=>false,putImage:async()=>{uploaded++;return 'https://assets.example/'+uploaded;},remove:async()=>{}};
 const {send,store,cookie}=await setup(t,{imageStore});
 for(let i=0;i<50;i++)await store.reserve(judgeCookieId(cookie),{model:'fixture',action:'fixture'});
 let id;
 for(let i=0;i<10;i++){
  const saved=await send('/api/lessons',{...(id?{id}:{}),lesson:coolingLesson(),sketch:image});assert.equal(saved.status,200);id=(await saved.json()).id;
 }
 const blocked=await send('/api/lessons',{id,lesson:coolingLesson(),sketch:image});assert.equal(blocked.status,429);assert.equal((await blocked.json()).code,'JUDGE_SAVE_LIMIT');assert.equal(uploaded,10);
});

test('judge-generated images upload only when explicitly saved, not on every show generation',async t=>{
 let uploads=0;const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0T8AAAAASUVORK5CYII=';
 const {send,sessionId}=await setup(t,{imageStore:{owns:()=>false,putImage:async()=>{uploads++;return 'https://assets.example/'+uploads;},remove:async()=>{}},imageCall:async()=>({dataUrl:image,model:'muse-image-1.0'}),modelCall:async()=>({structured:{name:'make_show',value:{coverPrompt:'A mug',slides:['cover','claim','experiment','evidence','transfer','takeaway'].map(kind=>({kind,chapter:0,heading:bi(kind),narration:bi('A spoken line.')}))}}})});
 const generated=await send('/api/studio/show',{sessionId,lesson:coolingLesson()});assert.equal(generated.status,200);const show=await generated.json();
 assert.equal(show.cover,image);assert.equal(uploads,0);
 const saved=await send('/api/lessons',{lesson:coolingLesson(),show:show.show,cover:show.cover});assert.equal(saved.status,200);assert.equal(uploads,1);
});
