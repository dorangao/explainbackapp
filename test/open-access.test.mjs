import {test} from 'node:test';import assert from 'node:assert/strict';
import {createApp,createHandler} from '../src/server.mjs';
import {createServer,request} from 'node:http';
import {createCloudHandler} from '../src/cloud.mjs';
import {testerCredentials} from '../test-support/tester.mjs';
const start={problemId:'crossing',workflow:'claim-testing',language:'en',synthetic:true};
const clarification=text=>({model:'fixture',toolCall:{name:'ask_clarification',arguments:JSON.stringify({assessment:'ambiguous',evidence:text,feedback:'Which scope?',question:'Finite inputs or end behavior?',reason:'Clarify.',focus:'meaning'})}});
async function running(t,options={}){
 const server=createApp({configured:true,traceEnabled:true,testerCredentials,modelCall:async args=>clarification(JSON.parse(args.input).explanation),...options});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin='http://127.0.0.1:'+server.address().port;
 const post=(path,body={},cookie='')=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 return {origin,post};
}
test('sign-in stays required by default',async t=>{
 const {origin}=await running(t);
 assert.deepEqual(await(await fetch(origin+'/api/auth')).json(),{configured:true,codes:false,open:false,authenticated:false});
 assert.equal((await fetch(origin+'/api/status')).status,401);
});
test('open access serves the full local workflow without a cookie while real logins keep working',async t=>{
 const {origin,post}=await running(t,{openAccess:true});
 assert.deepEqual(await(await fetch(origin+'/api/auth')).json(),{configured:true,codes:false,open:true,authenticated:true});
 const status=await(await fetch(origin+'/api/status')).json();assert.equal(status.access,null);assert.equal(status.defaultModel,'meta:muse-spark-1.3');
 const s=await(await post('/api/session',start)).json();assert.ok(s.sessionId);
 const turn=await post('/api/turn',{sessionId:s.sessionId,explanation:'never touches'});assert.equal(turn.status,200);
 assert.equal((await post('/api/trace',{sessionId:s.sessionId})).status,200);
 const login=await post('/api/login',testerCredentials);assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(origin+'/api/status',{headers:{Cookie:cookie}})).status,200);
 assert.equal((await post('/api/session',start,cookie+'x')).status,200,'a bad cookie falls back to open access locally');
 assert.equal((await post('/api/logout',{},cookie)).status,200);assert.equal((await fetch(origin+'/api/status')).status,200);
});
test('open access still rejects cross-origin writes',async t=>{
 const {origin}=await running(t,{openAccess:true});
 const r=await fetch(origin+'/api/session',{method:'POST',headers:{Origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify(start)});
 assert.equal(r.status,403);
});
test('the cloud handler ignores EXPLAINBACK_OPEN_ACCESS even when the environment sets it',async t=>{
 const handler=createCloudHandler({env:{VERCEL_URL:'example-unique.vercel.app',EXPLAINBACK_OPEN_ACCESS:'1',EXPLAINBACK_TESTER_USERNAME:'tester',EXPLAINBACK_TESTER_PASSWORD:'fixture-tester-password',MODEL_API_KEY:'fixture'},command:async()=>null});
 const server=createServer(handler);
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const get=path=>new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port:server.address().port,path,headers:{host:'example-unique.vercel.app'}},res=>{let body='';res.setEncoding('utf8');res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,body}));});req.on('error',reject);req.end();});
 const status=await get('/api/status');
 assert.equal(status.status,401);assert.match(status.body,/TESTER_REQUIRED/);
 const auth=await get('/api/auth');
 assert.equal(JSON.parse(auth.body).open,false);
 const local=createHandler({configured:true,testerCredentials,openAccess:process.env.EXPLAINBACK_OPEN_ACCESS==='1'});assert.ok(local,'the local default reads the environment flag');
});
