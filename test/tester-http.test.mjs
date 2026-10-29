import {test} from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {testerCredentials} from '../test-support/tester.mjs';
const start={problemId:'crossing',workflow:'claim-testing',language:'en',synthetic:true};
const clarification=text=>({model:'fixture',toolCall:{name:'ask_clarification',arguments:JSON.stringify({assessment:'ambiguous',evidence:text,feedback:'Which scope?',question:'Finite inputs or end behavior?',reason:'Clarify scope.',focus:'meaning'})}});
async function running(t,options={}){
 const server=createApp({configured:true,traceEnabled:true,testerCredentials,...options});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 const post=(path,body={},cookie='',extra={})=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,...extra},body:JSON.stringify(body)});
 const login=async cookie=>{const r=await post('/api/login',testerCredentials,cookie);assert.equal(r.status,200);assert.doesNotMatch(await r.text(),/password|fixture/);return r.headers.get('set-cookie').split(';')[0];};
 return {origin,post,login};
}
test('all learning and trace APIs require login; credentials never cause provider calls',async t=>{
 let calls=0;const {origin,post,login}=await running(t,{modelCall:()=>{calls++;throw new Error('unexpected');}});
 assert.deepEqual(await(await fetch(origin+'/api/auth')).json(),{configured:true,codes:false,open:false,authenticated:false});
 assert.equal((await fetch(origin+'/api/status')).status,401);
 for(const path of ['/api/session','/api/turn','/api/claim','/api/replay','/api/trace','/api/reset'])assert.equal((await post(path,start)).status,401);
 assert.equal((await post('/api/login',testerCredentials,'',{Origin:'https://example.com'})).status,403);
 assert.equal((await post('/api/login',testerCredentials,'',{'Content-Type':'text/plain'})).status,415);
 assert.equal((await post('/api/login',{...testerCredentials,password:'wrong'})).status,401);
 const cookie=await login();const status=await fetch(origin+'/api/status',{headers:{Cookie:cookie}});assert.equal(status.status,200);
 const data=await status.text();assert.doesNotMatch(data,/fixture-tester-password/);assert.equal(JSON.parse(data).defaultModel,'meta:muse-spark-1.3');
 assert.equal((await post('/api/session',start,cookie)).status,200);assert.equal(calls,0);
});
test('missing tester configuration closes access without exposing environment',async t=>{
 const {post,origin}=await running(t,{testerCredentials:{username:'',password:''}});
 assert.equal((await post('/api/login',testerCredentials)).status,503);assert.equal((await post('/api/session',start)).status,401);
 assert.deepEqual(await(await fetch(origin+'/api/auth')).json(),{configured:false,codes:false,open:false,authenticated:false});
});
test('each login owns its sessions and traces; cookie rotation and logout revoke them',async t=>{
 let calls=0;const {post,login}=await running(t,{modelCall:async args=>{calls++;return clarification(JSON.parse(args.input).explanation);}});
 const a=await login(),b=await login(),s=await(await post('/api/session',start,a)).json();
 assert.equal((await post('/api/turn',{sessionId:s.sessionId,explanation:'never touches'},a)).status,200);
 for(const path of ['/api/trace','/api/replay','/api/reset','/api/claim','/api/turn'])assert.equal((await post(path,{sessionId:s.sessionId,explanation:'never touches'},b)).status,404);
 assert.equal(calls,1);assert.equal((await(await post('/api/trace',{sessionId:s.sessionId},a)).json()).records.length,1);
 const rotated=await login(a);assert.equal((await post('/api/trace',{sessionId:s.sessionId},a)).status,401);assert.equal((await post('/api/trace',{sessionId:s.sessionId},rotated)).status,404);
 const logout=await post('/api/logout',{},rotated);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await post('/api/session',start,rotated)).status,401);
 assert.equal((await post('/api/session',start,b)).status,200);
});
test('logout during inference discards late feedback and leaves other logins active',async t=>{
 let release;const {post,login}=await running(t,{modelCall:async args=>{await new Promise(r=>release=r);return clarification(JSON.parse(args.input).explanation);}});
 const a=await login(),b=await login(),s=await(await post('/api/session',start,a)).json();
 const pending=post('/api/turn',{sessionId:s.sessionId,explanation:'never touches'},a);
 while(!release)await new Promise(r=>setTimeout(r,1));
 assert.equal((await post('/api/logout',{},a)).status,200);release();assert.equal((await pending).status,401);
 assert.equal((await post('/api/trace',{sessionId:s.sessionId},a)).status,401);assert.equal((await post('/api/trace',{sessionId:s.sessionId},b)).status,404);
 assert.equal((await post('/api/session',start,b)).status,200);
});
test('expired login requires authentication again and removes owned learning data',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.now()});const {post,login}=await running(t);
 const a=await login(),s=await(await post('/api/session',start,a)).json();t.mock.timers.tick(8*60*60_000);
 assert.equal((await post('/api/trace',{sessionId:s.sessionId},a)).status,401);
 const b=await login();assert.equal((await post('/api/trace',{sessionId:s.sessionId},b)).status,404);
});
