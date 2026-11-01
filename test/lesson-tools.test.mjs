import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
import {coolingLesson} from '../test-support/generated-lessons.mjs';
import {fakeBlob} from './blob.test.mjs';

// Lesson-page tools: a cover for the creator's own saved lesson, and Check figures (the
// grounded rubric judge on one lesson) from the lesson's page.
const codes={codes:[{code:'JUDGE-INVITE-1',label:'judges',quota:40,expiresAt:Date.now()+86400000,hash:'x'},{code:'OTHER-INVITE-2',label:'other',quota:40,expiresAt:Date.now()+86400000,hash:'y'}],warnings:[]};
const webp=seed=>{const b=Buffer.alloc(40);b.write('RIFF',0,'latin1');b.write('WEBP',8,'latin1');b[20]=seed;return `data:image/webp;base64,${b.toString('base64')}`;};
async function setup(t,extra={}){
 const server=createApp({testerCredentials,configured:true,accessCodes:codes,imageStore:null,...extra});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const codeCookie=async code=>{const r=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const post=(path,body,cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});
 const get=(path,cookie)=>fetch(origin+path,{headers:cookie?{Cookie:cookie}:{}});
 return {origin,post,get,codeCookie};
}

test('a creator draws a cover for a saved lesson of their own: the record and its card carry it, and it survives a save without a cover',async t=>{
 const {store,puts,deleted}=fakeBlob();
 const prompts=[];
 const {post,get,codeCookie}=await setup(t,{imageStore:store,imageCall:async({prompt})=>{prompts.push(prompt);return {dataUrl:webp(prompts.length),model:'muse-image-1.0',usage:null};}});
 const judge=await codeCookie('JUDGE-INVITE-1'),other=await codeCookie('OTHER-INVITE-2');
 const saved=await(await post('/api/lessons',{lesson:coolingLesson()},judge)).json();assert.equal(saved.cover,null);assert.equal(saved.coverModel,null);
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'},judge)).json();
 // One of the two ids, and a shared page's id is neither.
 assert.equal((await post('/api/studio/cover',{sessionId:s.sessionId},judge)).status,400);
 assert.equal((await post('/api/studio/cover',{sessionId:s.sessionId,lessonId:'cooling',savedId:saved.id},judge)).status,400);
 assert.equal((await post('/api/studio/cover',{sessionId:s.sessionId,lessonId:'shared:'+saved.id},judge)).status,400);
 assert.equal((await post('/api/studio/cover',{sessionId:s.sessionId,savedId:'0123456789abcdef'},judge)).status,404);
 // Another creator cannot draw on it.
 const s2=await(await post('/api/studio/session',{synthetic:true,language:'en'},other)).json();
 assert.equal((await post('/api/studio/cover',{sessionId:s2.sessionId,savedId:saved.id},other)).status,404);
 assert.equal(prompts.length,0);
 const drawn=await(await post('/api/studio/cover',{sessionId:s.sessionId,savedId:saved.id},judge)).json();
 assert.equal(drawn.savedId,saved.id);assert.equal(drawn.lessonId,undefined);assert.match(drawn.cover,/r001\.webp$/);assert.equal(drawn.model,'muse-image-1.0');assert.equal(drawn.attemptsRemaining,7);
 assert.ok(prompts[0].includes('Cooling coffee'));assert.equal(puts.length,1);
 // The library card and the full record show it; the reviewed-lesson overrides are untouched.
 const mine=await(await get('/api/lessons',judge)).json();assert.equal(mine.lessons[0].cover,drawn.cover);assert.equal(mine.lessons[0].coverModel,'muse-image-1.0');
 const full=await(await get('/api/lessons/'+saved.id,judge)).json();assert.equal(full.cover,drawn.cover);assert.equal(full.coverModel,'muse-image-1.0');assert.equal(full.coverDrawn,undefined,'the flag stays server-side');
 assert.deepEqual((await(await get('/api/covers')).json()).covers,{});
 // A later save without a show keeps the drawn cover; a redraw replaces the stored file.
 const edited=coolingLesson();edited.title={en:'Cooling coffee, revised',zh:'咖啡冷却（修订）'};
 const updated=await(await post('/api/lessons',{id:saved.id,lesson:edited},judge)).json();assert.equal(updated.cover,drawn.cover);assert.equal(updated.coverModel,'muse-image-1.0');assert.deepEqual(deleted,[]);
 const again=await(await post('/api/studio/cover',{sessionId:s.sessionId,savedId:saved.id},judge)).json();
 assert.match(again.cover,/r002\.webp$/);assert.deepEqual(deleted,[drawn.cover]);
 assert.equal((await(await get('/api/lessons/'+saved.id,judge)).json()).cover,again.cover);
 // Deleting the lesson removes its cover file too.
 assert.equal((await post('/api/lessons/delete',{id:saved.id},judge)).status,200);
 assert.deepEqual(deleted,[drawn.cover,again.cover]);
});

const bi=text=>({en:text,zh:'示例'+text});
const full={neutralFraming:2,quantityNames:2,transferClarity:2,bilingualParity:2,assumptions:2};
async function judgeSetup(t,modelCall){
 const targets=['muse-wonder-1.0','muse-spark-1.3'].map(model=>({id:'meta:'+model,provider:'meta',model,label:model,configured:true,timeoutMs:30000}));
 const router={defaultId:targets[0].id,list:()=>targets,call:async()=>assert.fail('injected model call expected')};
 const server=createApp({testerCredentials,router,modelCall});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en',llm:targets[0].id})).json();
 return {post,sessionId:s.sessionId};
}

test('Check figures runs the grounded judge on one lesson from the tester model and reports the disputed figures with their pages',async t=>{
 const calls=[];
 const {post,sessionId}=await judgeSetup(t,async(options,modelId)=>{
  calls.push({options,modelId});
  const grounded=Boolean(options.webSearch);
  return {model:'muse-spark-1.3',usage:{input_tokens:900,output_tokens:120},
   structured:{name:'judge_lesson',value:{scores:{...full,...(grounded?{factualCurrency:1}:{})},issues:['Chapter 2: "Newton" is bilingual only in English.'],summary:'Checked.',...(grounded?{factualIssues:[{claim:'0.1 per minute',finding:'Typical coffee cools nearer 0.05 per minute.',url:'https://example.org/cooling'},{claim:'20 °C room',finding:'Fine, but unsourced.',url:''}]}:{})}},
   ...(grounded?{sources:[{url:'https://example.org/cooling',title:'Cooling'},{url:'https://example.org/other',title:'Other'}]}:{})};
 });
 assert.equal((await post('/api/studio/judge',{sessionId,lesson:{version:9}})).status,400);
 assert.equal((await post('/api/studio/judge',{sessionId,lesson:coolingLesson(),grounded:'yes'})).status,400);
 assert.equal(calls.length,0);
 const r=await post('/api/studio/judge',{sessionId,lesson:coolingLesson(),topic:'Cooling coffee',language:'en'});
 assert.equal(r.status,200);const reply=await r.json();
 assert.equal(calls.length,1);assert.equal(calls[0].modelId,'meta:muse-spark-1.3','the tester role judges');
 assert.deepEqual(calls[0].options.webSearch,{contextSize:'low'});assert.equal(calls[0].options.promptCacheKey,'explainback-judge');
 assert.match(calls[0].options.instructions,/search the web for every figure/);assert.ok(calls[0].options.input.includes('Cooling coffee'));
 assert.equal(reply.grounded,true);assert.equal(reply.judge.version,'studio-judge-v2');assert.equal(reply.judge.model,'muse-spark-1.3');
 assert.equal(reply.judge.total,11);assert.equal(reply.judge.max,12);assert.equal(reply.judge.scores.factualCurrency,1);assert.equal(reply.judge.pagesRead,2);
 assert.deepEqual(reply.judge.factualIssues,[{claim:'0.1 per minute',finding:'Typical coffee cools nearer 0.05 per minute.',url:'https://example.org/cooling',verified:true},{claim:'20 °C room',finding:'Fine, but unsourced.',url:null,verified:false}]);
 assert.deepEqual(reply.usage,{input:900,output:120});assert.equal(reply.attemptsRemaining,7);
 // Ungrounded on request: the five-item rubric, no search.
 const plain=await(await post('/api/studio/judge',{sessionId,lesson:coolingLesson(),grounded:false})).json();
 assert.equal(calls[1].options.webSearch,undefined);assert.equal(plain.grounded,false);assert.equal(plain.judge.version,'studio-judge-v1');assert.equal(plain.judge.max,10);assert.equal(plain.judge.factualIssues,undefined);assert.equal(plain.attemptsRemaining,6);
});

test('a judge reply that breaks the rubric shape is a 502 that still spends the attempt',async t=>{
 const {post,sessionId}=await judgeSetup(t,async()=>({structured:{name:'judge_lesson',value:{scores:full,issues:[],summary:'No currency score.'}}}));
 const r=await post('/api/studio/judge',{sessionId,lesson:coolingLesson()});
 assert.equal(r.status,502);const body=await r.json();assert.match(body.error,/could not be checked/);assert.equal(body.attemptsRemaining,7);
});
