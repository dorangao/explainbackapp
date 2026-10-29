import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {createMemoryState} from '../src/state.mjs';
import {createTesterAuth} from '../src/tester-auth.mjs';
import {createProviderRouter} from '../src/llm/index.mjs';
import {testerCredentials} from '../test-support/tester.mjs';

const start={problemId:'crossing',workflow:'claim-testing',language:'en',synthetic:true};
const clarification=text=>({model:'fixture',toolCall:{name:'ask_clarification',arguments:JSON.stringify({assessment:'ambiguous',evidence:text,feedback:'Which scope?',question:'Finite inputs or end behavior?',reason:'Clarify scope.',focus:'meaning'})}});
async function pair(t,modelCall){
 const state=createMemoryState(),auth=createTesterAuth(testerCredentials);
 const servers=[0,1].map(()=>createApp({state,auth,configured:true,traceEnabled:true,modelCall}));
 for(const server of servers){await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));}
 const request=(i,path,body,cookie='')=>{const origin='http://127.0.0.1:'+servers[i].address().port;return fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});};
 const response=await request(0,'/api/login',testerCredentials),cookie=response.headers.get('set-cookie').split(';')[0];
 return {request:(i,path,body)=>request(i,path,body,cookie),raw:request,cookie};
}
test('two instances share progress, pending traces and locks; logout discards a late response',async t=>{
 let release,calls=0;
 const {request}=await pair(t,async args=>{calls++;args.onTrace?.({type:'request',body:{model:'fixture'}});await new Promise(r=>release=r);return clarification(JSON.parse(args.input).explanation);});
 const s=await(await request(0,'/api/session',start)).json();
 const pending=request(1,'/api/turn',{sessionId:s.sessionId,explanation:'never touches'});
 while(!release)await new Promise(r=>setTimeout(r,1));
 assert.equal((await request(0,'/api/turn',{sessionId:s.sessionId,explanation:'never touches'})).status,409);
 const trace=await(await request(0,'/api/trace',{sessionId:s.sessionId})).json();assert.equal(trace.records[0].outcome,'pending');
 assert.equal((await request(0,'/api/logout',{})).status,200);release();assert.equal((await pending).status,401);assert.equal(calls,1);
});
test('a fresh handler can continue persisted state and reset prevents late writes',async t=>{
 let release;
 const {request}=await pair(t,async args=>{await new Promise(r=>release=r);return clarification(JSON.parse(args.input).explanation);});
 const s=await(await request(0,'/api/session',start)).json();
 const pending=request(1,'/api/turn',{sessionId:s.sessionId,explanation:'never touches'});
 while(!release)await new Promise(r=>setTimeout(r,1));
 assert.equal((await request(0,'/api/reset',{sessionId:s.sessionId})).status,200);release();assert.equal((await pending).status,409);
 assert.equal((await request(1,'/api/trace',{sessionId:s.sessionId})).status,404);
});
test('cloud provider allowlist excludes Ollama even when a local endpoint is present',()=>{
 const router=createProviderRouter({env:{EXPLAINBACK_PROVIDERS:'meta',MODEL_API_KEY:'fixture',OLLAMA_BASE_URL:'http://192.0.2.1:11434'}});
 assert.deepEqual(router.list().map(t=>t.id),['meta:muse-spark-1.3','meta:muse-wonder-1.0']);assert.equal(router.defaultId,'meta:muse-spark-1.3');assert.throws(()=>router.get('ollama:qwen3.8:27b'));
});
test('an interim trace write failure cannot strand a successfully committed workflow',async t=>{
 const state=createMemoryState(),write=state.writeTrace;
 state.writeTrace=async(...args)=>{if(args[1].at(-1)?.outcome==='accepted')throw new Error('Temporary diagnostic write outage');return write(...args);};
 const server=createApp({state,testerCredentials,configured:true,traceEnabled:true,modelCall:async args=>clarification(JSON.parse(args.input).explanation)});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 const post=(path,body,cookie='')=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 const login=await post('/api/login',testerCredentials),cookie=login.headers.get('set-cookie').split(';')[0];
 const s=await(await post('/api/session',start,cookie)).json();
 const response=await post('/api/turn',{sessionId:s.sessionId,explanation:'never touches'},cookie);assert.equal(response.status,200);
 assert.equal((await response.json()).attemptsRemaining,11);
 assert.equal((await(await post('/api/trace',{sessionId:s.sessionId},cookie)).json()).records[0].outcome,'accepted');
});
