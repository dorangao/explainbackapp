import {test} from 'node:test';import assert from 'node:assert/strict';
import {parseAccessCodes,findAccessCode,audienceOf,audienceValid,budgetFor,publicAudience} from '../src/access-codes.mjs';
import {createTesterAuth} from '../src/tester-auth.mjs';
import {createMemoryState} from '../src/state.mjs';
import {createApp} from '../src/server.mjs';
import {testerCredentials} from '../test-support/tester.mjs';

const DAY=24*60*60_000,today=()=>new Date().toISOString().slice(0,10);
const future=days=>new Date(Date.now()+days*DAY).toISOString().slice(0,10);
const env=`judges:7KQ4-MUSE-2026:${future(10)}:3, press:PRESS-CODE-1:${future(2)}:40`;

test('access codes parse by position, skip malformed entries and never keep expired ones',()=>{
 const {codes,warnings}=parseAccessCodes(env);
 assert.deepEqual(codes.map(c=>[c.label,c.code,c.quota]),[['judges','7KQ4-MUSE-2026',3],['press','PRESS-CODE-1',40]]);
 assert.equal(warnings.length,0);assert.ok(codes[0].expiresAt>Date.now()+9*DAY);assert.doesNotMatch(JSON.stringify(warnings),/7KQ4/);
 const bad=parseAccessCodes(`judges:short:${future(1)}:5, judges:LONG-ENOUGH-1:${future(1)}:5, Judges:LONG-ENOUGH-2:${future(1)}:5, ok:LONG-ENOUGH-3:2020-01-01:5, ok:LONG-ENOUGH-4:${future(1)}:0, ok:LONG-ENOUGH-5:${future(1)}:501, nope, fine:FINE-CODE-99:${future(1)}:12`);
 assert.deepEqual(bad.codes.map(c=>c.label),['judges','fine'],'a rejected entry does not reserve its label');assert.equal(bad.warnings.length,6);
 assert.deepEqual(parseAccessCodes(undefined),{codes:[],warnings:[]});assert.deepEqual(parseAccessCodes('  ').codes,[]);
 assert.equal(parseAccessCodes(`t:TODAY-CODE-1:${today()}:5`).codes.length,1,'a code dated today is valid until the end of that UTC day');
});
test('code lookup is case-insensitive, tolerant of whitespace, and bound to configured labels',()=>{
 const {codes}=parseAccessCodes(env);
 assert.equal(findAccessCode(codes,' 7kq4-muse-2026 ').label,'judges');assert.equal(findAccessCode(codes,'7KQ4-MUSE-2027'),null);assert.equal(findAccessCode(codes,''),null);
 assert.equal(findAccessCode(codes,'7KQ4-MUSE-2026',codes[0].expiresAt+1),null);
 const audience=audienceOf(codes[0]);assert.ok(audienceValid(codes,audience));
 assert.equal(audienceValid(parseAccessCodes(`judges:ROTATED-CODE-1:${future(5)}:3`).codes,audience),false,'rotating a code invalidates its earlier sessions');
 assert.equal(audienceValid(codes,{...audience,expiresAt:1}),false);assert.equal(audienceValid(codes,null),false);
 assert.deepEqual(budgetFor(audience),['code:judges',3]);assert.deepEqual(budgetFor(null),['global',60]);
 assert.deepEqual(Object.keys(publicAudience(audience)),['label','quota','expiresAt']);assert.equal(publicAudience(null),null);
});
test('memory auth issues audience sessions for codes with separate capacity and shared rate limiting',()=>{
 let now=Date.now();const {codes}=parseAccessCodes(env,{now:()=>now});
 const auth=createTesterAuth({...testerCredentials,accessCodes:codes,now:()=>now});
 assert.equal(auth.codesConfigured,true);
 const judge=auth.login({code:'7kq4-muse-2026'});assert.equal(judge.audience.label,'judges');assert.equal(auth.authenticate(judge.cookie.split(';')[0]).audience.quota,3);
 assert.throws(()=>auth.login({code:'WRONG-CODE-123'}),e=>e.code==='ACCESS_CODE'&&e.status===401);
 assert.throws(()=>auth.login({code:['7KQ4-MUSE-2026']}),e=>e.code==='ACCESS_CODE');
 for(let i=0;i<19;i++)auth.login({code:'7KQ4-MUSE-2026'});
 assert.throws(()=>auth.login({code:'7KQ4-MUSE-2026'}),e=>e.code==='TESTER_CAPACITY');
 assert.ok(auth.login(testerCredentials).id,'tester capacity is counted separately from code capacity');
 const press=auth.login({code:'PRESS-CODE-1'});assert.equal(press.audience.label,'press');
 now=codes[1].expiresAt+1;assert.equal(auth.authenticate(press.cookie.split(';')[0]),null,'sessions end with the code');
 assert.throws(()=>auth.login({code:'PRESS-CODE-1'}),e=>e.code==='ACCESS_CODE');
 assert.ok(auth.login({code:'7KQ4-MUSE-2026'}).id,'an unexpired code still signs in');
 const codeless=createTesterAuth({username:'',password:'',accessCodes:codes,now:()=>now});
 assert.equal(codeless.configured,false);assert.ok(codeless.login({code:'7KQ4-MUSE-2026'}).id,'codes work without a tester password');
 assert.throws(()=>codeless.login(testerCredentials),e=>e.code==='TESTER_SETUP');
});
test('memory state keeps an hourly budget per bucket',async()=>{
 let now=0;const state=createMemoryState({now:()=>now});
 for(let i=0;i<3;i++)assert.equal(await state.consumeTurn('code:judges',3),true);
 assert.equal(await state.consumeTurn('code:judges',3),false);assert.equal(await state.remainingTurns('code:judges',3),0);
 assert.equal(await state.consumeTurn(),true);assert.equal(await state.remainingTurns(),59);
 now=60*60_000;assert.equal(await state.consumeTurn('code:judges',3),true);assert.equal(await state.remainingTurns('code:judges',3),2);
});

async function running(t,options={}){
 const server=createApp({configured:true,traceEnabled:true,testerCredentials,accessCodes:parseAccessCodes(env),modelCall:async args=>({model:'fixture',toolCall:{name:'ask_clarification',arguments:JSON.stringify({assessment:'ambiguous',evidence:JSON.parse(args.input).explanation,feedback:'Which scope?',question:'Finite inputs or end behavior?',reason:'Clarify.',focus:'meaning'})}}),...options});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 const post=(path,body={},cookie='')=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 const login=async body=>{const r=await post('/api/login',body);assert.equal(r.status,200);const text=await r.text();assert.doesNotMatch(text,/7KQ4|PRESS|fixture/);return r.headers.get('set-cookie').split(';')[0];};
 const status=cookie=>fetch(origin+'/api/status',{headers:{Cookie:cookie}}).then(r=>r.json());
 return {origin,post,login,status};
}
test('HTTP: a code signs in, reports its budget, is tagged on sessions, and is capped independently of the tester',async t=>{
 const {origin,post,login,status}=await running(t);
 assert.deepEqual(await(await fetch(origin+'/api/auth')).json(),{configured:true,codes:true,open:false,authenticated:false});
 assert.equal((await post('/api/login',{code:'NOPE-NOPE-NOPE'})).status,401);assert.equal((await(await post('/api/login',{code:'NOPE-NOPE-NOPE'})).json()).code,'ACCESS_CODE');
 const judge=await login({code:'7kq4-muse-2026'}),tester=await login(testerCredentials);
 const before=await status(judge);assert.equal(before.access.label,'judges');assert.equal(before.access.remaining,3);assert.equal(before.access.quota,3);assert.equal(typeof before.access.expiresAt,'number');
 assert.equal((await status(tester)).access,null);
 const s=await(await post('/api/session',{problemId:'crossing',workflow:'claim-testing',language:'en',synthetic:true},judge)).json();
 for(let i=0;i<3;i++)assert.equal((await post('/api/turn',{sessionId:s.sessionId,explanation:'never touches '+i},judge)).status,200);
 assert.equal((await status(judge)).access.remaining,0);
 const blocked=await post('/api/turn',{sessionId:s.sessionId,explanation:'one more'},judge);assert.equal(blocked.status,429);assert.match((await blocked.json()).error,/access code/);
 const ts=await(await post('/api/session',{problemId:'crossing',workflow:'claim-testing',language:'en',synthetic:true},tester)).json();
 assert.equal((await post('/api/turn',{sessionId:ts.sessionId,explanation:'tester still fine'},tester)).status,200,'the tester budget is untouched by code usage');
 assert.equal((await post('/api/session',{problemId:'crossing',workflow:'claim-testing',language:'en',synthetic:true},tester+'x')).status,401);
 const trace=await(await post('/api/trace',{sessionId:s.sessionId},judge)).json();assert.doesNotMatch(JSON.stringify(trace),/7KQ4-MUSE/);
 assert.equal((await post('/api/logout',{},judge)).status,200);assert.equal((await fetch(origin+'/api/status',{headers:{Cookie:judge}})).status,401);
});
test('HTTP: codes work when no tester password is configured and misconfiguration never leaks values',async t=>{
 const warnings=[];const warn=console.warn;console.warn=m=>warnings.push(m);
 try{
  const {origin,login,status}=await running(t,{testerCredentials:{username:'',password:''},accessCodes:parseAccessCodes(`judges:7KQ4-MUSE-2026:${future(3)}:5, broken:SECRET-VALUE-X:nope:5`)});
  assert.deepEqual(await(await fetch(origin+'/api/auth')).json(),{configured:false,codes:true,open:false,authenticated:false});
  const judge=await login({code:'7KQ4-MUSE-2026'});assert.equal((await status(judge)).access.remaining,5);
  assert.equal(warnings.length,1);assert.doesNotMatch(warnings[0],/SECRET-VALUE/);
 }finally{console.warn=warn;}
});
