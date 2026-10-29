import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {callMeta} from '../src/meta.mjs';
const start={problemId:'flight',language:'en',synthetic:true};
async function running(t,traceEnabled){
 const server=createApp({testerCredentials,configured:true,traceEnabled,modelCall:args=>callMeta({...args,apiKey:'fixture-key',fetchImpl:async()=>Response.json({id:'r1',model:'fixture',status:'completed',output:[{type:'reasoning',summary:[{text:'PRIVATE REASONING'}]},{type:'function_call',name:'ask_clarification',arguments:JSON.stringify({assessment:'ambiguous',evidence:'synthetic',feedback:'Clarify.',question:'Which model?',reason:'Meaning first.',focus:'meaning'})}]})})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const cookie=await testerCookie(origin);
 return {origin,cookie,post:(path,body)=>fetch(origin+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)})};
}
test('trace flag off hides capability and denies trace data',async t=>{
 const {origin,post,cookie}=await running(t,false);assert.equal((await(await fetch(origin+'/api/status',{headers:{Cookie:cookie}})).json()).traceEnabled,false);
 const s=await(await post('/api/session',start)).json();
 assert.equal((await post('/api/trace',{sessionId:s.sessionId})).status,404);
});
test('trace is session-scoped, clearable, deleted on reset, and marks developer demos',async t=>{
 const {post}=await running(t,true);const s=await(await post('/api/session',start)).json();
 assert.equal(s.demoUsed,true);
 const turn=await post('/api/turn',{sessionId:s.sessionId,explanation:'synthetic'});assert.equal(turn.status,200);
 const trace=await(await post('/api/trace',{sessionId:s.sessionId})).json();
 assert.equal(trace.records.length,1);assert.equal(trace.records[0].outcome,'accepted');assert.equal(trace.records[0].httpStatus,200);
 assert.doesNotMatch(JSON.stringify(trace),/PRIVATE REASONING|fixture-key/);
 const other=await(await post('/api/session',start)).json();assert.deepEqual((await(await post('/api/trace',{sessionId:other.sessionId})).json()).records,[]);
 assert.deepEqual((await(await post('/api/trace',{sessionId:s.sessionId,clear:true})).json()).records,[]);
 await post('/api/reset',{sessionId:s.sessionId});assert.equal((await post('/api/trace',{sessionId:s.sessionId})).status,404);
});
test('preset provenance is sticky and validated without sending malformed flags',async t=>{
 const {post}=await running(t,false);const s=await(await post('/api/session',start)).json();
 assert.equal((await post('/api/turn',{sessionId:s.sessionId,explanation:'synthetic',demoPreset:'true'})).status,400);
 const result=await(await post('/api/turn',{sessionId:s.sessionId,explanation:'synthetic',demoPreset:true})).json();assert.equal(result.demoUsed,true);
 const next=await(await post('/api/turn',{sessionId:s.sessionId,explanation:'synthetic'})).json();assert.equal(next.demoUsed,true);
});
