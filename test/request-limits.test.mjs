import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {parseAccessCodes} from '../src/access-codes.mjs';
import {createMemoryState} from '../src/state.mjs';
import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
import {coolingLesson,tinyPng} from '../test-support/generated-lessons.mjs';

async function running(t,options={}){
 let calls=0;
 const server=createApp({testerCredentials,configured:true,traceEnabled:false,quotaMultiplier:2,modelCall:async()=>{calls++;return {};},...options});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const post=(path,body,c=cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,Cookie:c,'Content-Type':'application/json'},body:JSON.stringify(body)});
 return {origin,post,calls:()=>calls};
}

test('a doubled deployment permits sixteen Studio and quantum attempts and refuses the seventeenth before calling the provider',async t=>{
 const {post,calls}=await running(t);
 for(const workflow of ['studio','quantum']){
  const session=await(await post(`/api/${workflow}/session`,{synthetic:true,language:'en'})).json();
  assert.equal(session.attemptsRemaining,16);
  const route=workflow==='studio'?'/api/studio/compose':'/api/quantum/explain';
  const body=workflow==='studio'?{sessionId:session.sessionId,topic:'Why does coffee cool?',creation:'generated'}:{sessionId:session.sessionId,circuit:{lesson:'qubit'},question:'why',prediction:'unsure'};
  const before=calls();
  for(let i=0;i<16;i++){
   const r=await post(route,body);assert.equal(r.status,502,`${workflow} attempt ${i+1} reaches the bounded provider reader`);
   assert.equal((await r.json()).attemptsRemaining,15-i);
  }
  assert.equal((await post(route,body)).status,429);assert.equal(calls()-before,16);
 }
});

test('doubled coach limits are reported for baseline and claim workflows and enforce twenty-four attempts',async t=>{
 const {post,calls}=await running(t);
 for(const workflow of ['baseline','claim-testing']){
  const s=await(await post('/api/session',{synthetic:true,language:'en',problemId:'crossing',workflow})).json();
  assert.equal(s.attemptsRemaining,24);
  const before=calls();
  for(let i=0;i<24;i++){
   const r=await post('/api/turn',{sessionId:s.sessionId,explanation:'The curve never touches.'});
   assert.equal(r.status,502);assert.equal((await r.json()).attemptsRemaining,23-i);
  }
  assert.equal((await post('/api/turn',{sessionId:s.sessionId,explanation:'The curve never touches.'})).status,429);
  assert.equal(calls()-before,24);
 }
});

test('the doubled hourly quota is displayed and enforced independently for each configured access category',async t=>{
 const expiry=new Date(Date.now()+86400000).toISOString().slice(0,10);
 const {origin,post,calls}=await running(t,{accessCodes:parseAccessCodes(`alpha:SYNTHETIC-ALPHA:${expiry}:2,beta:SYNTHETIC-BETA:${expiry}:3`)});
 for(const [code,want] of [['SYNTHETIC-ALPHA',4],['SYNTHETIC-BETA',6]]){
  const login=await post('/api/login',{code}),cookie=login.headers.get('set-cookie').split(';')[0];
  const status=()=>fetch(origin+'/api/status',{headers:{Cookie:cookie}}).then(r=>r.json());
  const initial=await status();assert.equal(initial.access.quota,want);assert.equal(initial.access.remaining,want);
  const s=await(await post('/api/studio/session',{synthetic:true,language:'en'},cookie)).json(),before=calls();
  const body={sessionId:s.sessionId,topic:'Why does coffee cool?',creation:'generated'};
  for(let i=0;i<want;i++)assert.equal((await post('/api/studio/compose',body,cookie)).status,502);
  assert.equal((await status()).access.remaining,0);
  assert.equal((await post('/api/studio/compose',body,cookie)).status,429);assert.equal(calls()-before,want);
 }
});

test('invalid quota configuration fails before an app can serve requests',()=>{
 for(const quotaMultiplier of [0,-1,1.5,Infinity,'bad',11])assert.throws(()=>createApp({quotaMultiplier}),/quota multiplier/i);
});

test('the shared tester hourly bucket is scaled without resetting requests already spent',async t=>{
 const state=createMemoryState();
 for(let i=0;i<119;i++)await state.consumeTurn('global',120);
 const {post,calls}=await running(t,{state});
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'})).json();
 const body={sessionId:s.sessionId,topic:'Why does coffee cool?',creation:'generated'};
 assert.equal((await post('/api/studio/compose',body)).status,502);
 assert.equal((await post('/api/studio/compose',body)).status,429);
 assert.equal(calls(),1);assert.equal(await state.remainingTurns('global',120),0);
});

test('local claim confirmation and revision retain the effective coach balance beyond the original cap',async t=>{
 const {post}=await running(t,{modelCall:async args=>({toolCall:{name:'propose_claim',arguments:JSON.stringify({assessment:'misconception',evidence:JSON.parse(args.input).explanation,feedback:'Check the evidence.',question:'Why?',reason:'Test the claim.',focus:'concept',kind:'finite-crossing',scope:'finite-inputs',interpretation:'No finite crossing is possible.',experimentId:'finite-crossing'})}})});
 let s=await(await post('/api/session',{synthetic:true,language:'en',problemId:'crossing',workflow:'claim-testing'})).json();
 for(let i=0;i<13;i++){
  const turn=await post('/api/turn',{sessionId:s.sessionId,explanation:'There is no crossing at any finite input.'});
  assert.equal(turn.status,200);s=await turn.json();assert.equal(s.attemptsRemaining,23-i);
  const local=await post('/api/claim',{sessionId:s.sessionId,claimId:s.claim.id,decision:i===12?'confirm':'revise'});
  assert.equal(local.status,200);s=await local.json();assert.equal(s.attemptsRemaining,23-i);
 }
 assert.equal(s.phase,'prediction');assert.equal(s.attemptsRemaining,11);
});

test('replaying a cached background draft reports current remaining attempts rather than the balance when it was generated',async t=>{
 const target={id:'meta:muse-wonder-1.0',provider:'meta',model:'muse-wonder-1.0',label:'Wonder',configured:true};
 const lesson=coolingLesson();
 const router={defaultId:target.id,list:()=>[target],startBackground:async()=>({structured:{name:'compose_lesson',value:{status:'ready',message:{en:'Ready',zh:'好了'},lesson}},model:target.model})};
 const {post}=await running(t,{router,segmentCall:async()=>({boxes:[{box:[0,0,1,1],score:1}],width:1,height:1,model:'sam-3.1'})});
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'})).json();
 const created=await post('/api/studio/compose',{sessionId:s.sessionId,topic:'Cooling',creation:'generated',background:true});
 assert.equal(created.status,200);assert.equal((await created.json()).attemptsRemaining,15);
 assert.equal((await post('/api/studio/detect',{sessionId:s.sessionId,image:tinyPng,concept:'cup'})).status,200);
 const replay=await(await post('/api/studio/poll',{sessionId:s.sessionId})).json();
 assert.equal(replay.lesson.version,2);assert.equal(replay.attemptsRemaining,14);
});

test('parallel comparison judges reserve the final session slot only once',async t=>{
 const targets=['muse-wonder-1.0','muse-spark-1.3'].map(model=>({id:'meta:'+model,provider:'meta',model,label:model,configured:true}));
 const router={defaultId:targets[0].id,list:()=>targets};
 let initial=true,judges=0;
 const {post}=await running(t,{router,modelCall:async args=>{
  if(initial)return {};
  if(args.tools[0].name==='compose_lesson')return {structured:{name:'compose_lesson',value:{status:'ready',message:{en:'Ready',zh:'好了'},lesson:coolingLesson()}}};
  judges++;return {structured:{name:'judge_lesson',value:{scores:{neutralFraming:2,quantityNames:2,transferClarity:2,bilingualParity:2,assumptions:2},issues:[],summary:'Checked.'}}};
 }});
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'})).json();
 for(let i=0;i<13;i++)assert.equal((await post('/api/studio/compose',{sessionId:s.sessionId,topic:'Cooling',creation:'generated'})).status,502);
 initial=false;
 const compared=await post('/api/studio/compare',{sessionId:s.sessionId,topic:'Cooling'});assert.equal(compared.status,200);
 const result=await compared.json();assert.equal(result.attemptsRemaining,0);assert.equal(judges,1);
 assert.equal(result.replies.filter(r=>r.judge?.failure==='budget').length,1);
});
