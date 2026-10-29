import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
test('quantum coach uses authenticated bounded circuits, checked facts, provider trace and existing session isolation',async t=>{
 let calls=0,input='';const server=createApp({testerCredentials,configured:true,traceEnabled:true,modelCall:async args=>{
  calls++;input=args.input;args.onTrace?.({type:'request',body:{input:args.input}});args.onTrace?.({type:'response',status:200,body:{output:'synthetic coach'}});
  return {toolCall:{name:'explain_quantum',arguments:JSON.stringify({explanation:'相位改变干涉；代码核验结果为 1。',nextQuestion:'把相位改为零会怎样？',focus:'amplitudes'})}};
 }});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const post=(path,body,c=cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,Cookie:c,'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('/api/quantum/session',{language:'zh',synthetic:true},'')).status,401);
 const response=await post('/api/quantum/session',{language:'zh',synthetic:true});assert.equal(response.status,200);
 const s=await response.json();assert.equal(s.llm.provider,'meta');
 const body={sessionId:s.sessionId,circuit:{lesson:'interference',phase:Math.PI},question:'why',prediction:'agree'};
 assert.equal((await post('/api/quantum/explain',{...body,circuit:{...body.circuit,state:[[1,0]]}})).status,400);assert.equal(calls,0);
 const result=await(await post('/api/quantum/explain',body)).json();assert.equal(result.focus,'amplitudes');assert.match(input,/probabilities/);assert.equal(calls,1);
 const trace=await(await post('/api/trace',{sessionId:s.sessionId})).json();assert.equal(trace.records[0].outcome,'accepted');
 assert.equal((await post('/api/turn',{sessionId:s.sessionId,explanation:'hello'})).status,400);
 const other=await testerCookie(origin);assert.equal((await post('/api/quantum/explain',body,other)).status,404);
 await post('/api/reset',{sessionId:s.sessionId});assert.equal((await post('/api/quantum/explain',body)).status,404);
});
test('quantum coach rejects invalid model output and caps attempts without invoking an extra provider call',async t=>{
 let calls=0;const server=createApp({testerCredentials,configured:true,traceEnabled:false,modelCall:async()=>{calls++;return {toolCall:{name:'explain_quantum',arguments:JSON.stringify({explanation:'Do not accept unchecked actions.',nextQuestion:'Next?',focus:'execute_script'})}};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const s=await(await post('/api/quantum/session',{language:'en',synthetic:true})).json();
 const body={sessionId:s.sessionId,circuit:{lesson:'qubit'},question:'why',prediction:'unsure'};
 for(let i=0;i<8;i++)assert.equal((await post('/api/quantum/explain',body)).status,502);
 assert.equal((await post('/api/quantum/explain',body)).status,429);assert.equal(calls,8);
 assert.equal((await post('/api/trace',{sessionId:s.sessionId})).status,404);
});
