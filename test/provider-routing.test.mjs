import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
import {test} from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';import {createProviderRouter} from '../src/llm/index.mjs';
test('router exposes only allowlisted public config and rejects arbitrary target IDs',()=>{
 const router=createProviderRouter({env:{MODEL_API_KEY:'fixture-secret',OLLAMA_BASE_URL:'http://127.0.0.1:11434'}});
 assert.deepEqual(router.list().map(t=>t.id),['meta:muse-spark-1.3','meta:muse-wonder-1.0','ollama:muse-glimmer:latest','ollama:qwen3.8:27b']);assert.equal(router.get('meta:muse-wonder-1.0').timeoutMs,50000);assert.doesNotMatch(JSON.stringify(router.list()),/fixture-secret|127.0.0.1/);assert.throws(()=>router.get('http://other-host/model'));assert.equal(router.get('ollama:qwen3.8:27b').provider,'ollama');
});
test('HTTP sessions pin the chosen provider/model across all turns and trace rows',async t=>{
 const calls=[],targets=[{id:'meta:a',provider:'meta',model:'a',label:'Meta a',configured:true,timeoutMs:30000},{id:'ollama:b',provider:'ollama',model:'b',label:'Ollama b',configured:true,timeoutMs:180000}];
 const router={defaultId:'meta:a',list:()=>targets,get:id=>{const result=targets.find(x=>x.id===(id??'meta:a'));if(!result)throw new Error('bad');return result;},call:async(id,args)=>{calls.push(id);const text=JSON.parse(args.input).explanation;return {model:'b',provider:'ollama',toolCall:{name:'ask_clarification',arguments:JSON.stringify({assessment:'ambiguous',evidence:text,feedback:'Which meaning?',question:'Which end?',reason:'Clarify.',focus:'meaning'})}};}};
 const server=createApp({testerCredentials,router,traceEnabled:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port,cookie=await testerCookie(base),post=(path,body)=>fetch(base+path,{method:'POST',headers:{Cookie:cookie,Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const start={problemId:'crossing',language:'en',synthetic:true,llm:'ollama:b'};
 const status=await(await fetch(base+'/api/status',{headers:{Cookie:cookie}})).json();assert.equal(status.models.length,2);
 assert.equal((await post('/api/session',{...start,llm:'unknown'})).status,400);
 let session=await(await post('/api/session',start)).json();assert.equal(session.llm.id,'ollama:b');
 session=await(await post('/api/turn',{sessionId:session.sessionId,explanation:'It can never touch the asymptote.',llm:'meta:a'})).json();
 assert.deepEqual(calls,['ollama:b']);assert.equal(session.llm.id,'ollama:b');
 const trace=await(await post('/api/trace',{sessionId:session.sessionId})).json();assert.equal(trace.records[0].provider,'ollama');assert.equal(trace.records[0].model,'b');
});
