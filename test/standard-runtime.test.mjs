import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createApp} from '../src/server.mjs';
import {testerCredentials,testerCookie} from '../test-support/tester.mjs';

test('the JSON boundary refuses compressed input without attempting model work',async t=>{
 const server=createApp({configured:true,testerCredentials,modelCall:()=>assert.fail('no provider call')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const response=await fetch(origin+'/api/session',{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json','Content-Encoding':'gzip'},body:gzipSync(JSON.stringify({synthetic:true,language:'en',problemId:'crossing'}))});
 assert.equal(response.status,415);
 assert.match((await response.json()).error,/encoding|compressed/i);
 assert.equal(response.headers.get('x-powered-by'),null);
});

test('already parsed serverless bodies retain object and size checks',async t=>{
 const {createHandler}=await import('../src/server.mjs');
 const {createServer}=await import('node:http');
 const app=createHandler({configured:true,openAccess:true,modelCall:()=>assert.fail('no provider call')});
 const server=createServer((req,res)=>{
  req.body=req.headers['x-fixture']==='oversized'?{text:'x'.repeat(17_000)}:req.headers['x-fixture']==='array'?[]:{synthetic:true,language:'en',problemId:'crossing'};
  app(req,res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const post=fixture=>fetch(origin+'/api/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Fixture':fixture},body:'{}'});
 assert.equal((await post('valid')).status,200);
 assert.equal((await post('oversized')).status,413);
 assert.equal((await post('array')).status,400);
});

test('serverless adapter waits for asynchronous Express responses to finish',async()=>{
 const {EventEmitter}=await import('node:events');
 const {dispatchToResponse}=await import('../api/index.js');
 const res=new EventEmitter();let completed=false;
 const promise=dispatchToResponse((_req,r)=>setImmediate(()=>{completed=true;r.emit('finish');}),{},res);
 assert.equal(completed,false);
 await promise;
 assert.equal(completed,true);
 assert.equal(res.listenerCount('finish'),0);
 assert.equal(res.listenerCount('close'),0);
});

test('serverless invocation waits for delayed session lock release after response',async t=>{
 const {createHandler}=await import('../src/server.mjs');
 const {createMemoryState}=await import('../src/state.mjs');
 const {createServer}=await import('node:http');
 const {dispatchToResponse}=await import('../api/index.js');
 const state=createMemoryState(),release=state.release.bind(state);
 let unblock,releaseStarted=false,dispatchDone=false,dispatchPromise;
 state.release=async (...args)=>{releaseStarted=true;await new Promise(resolve=>{unblock=resolve;});await release(...args);};
 const app=createHandler({state,configured:true,openAccess:true,traceEnabled:true});
 const server=createServer((req,res)=>{
  const p=dispatchToResponse(app,req,res);
  if(req.url==='/api/trace'){dispatchPromise=p;p.then(()=>{dispatchDone=true;});}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>{unblock?.();return new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});});
 const origin=`http://127.0.0.1:${server.address().port}`;
 const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const created=await (await post('/api/studio/session',{synthetic:true,language:'en'})).json();
 const result=await post('/api/trace',{sessionId:created.sessionId,clear:true});
 assert.equal(result.status,200);assert.equal(releaseStarted,true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(dispatchDone,false,'response finish must not end invocation before release');
 unblock();await dispatchPromise;
 assert.equal(dispatchDone,true);
});

test('disconnected serverless request waits for pending work and subsequently registered cleanup',async()=>{
 const {EventEmitter}=await import('node:events');
 const {dispatchToResponse}=await import('../api/index.js');
 const res=new EventEmitter();let finishFirst,finishSecond,settled=false;
 const first=new Promise(resolve=>{finishFirst=resolve;});
 const second=new Promise(resolve=>{finishSecond=resolve;});
 const p=dispatchToResponse((_req,r)=>{
  r.explainPendingTasks=new Set([first]);
  first.then(()=>r.explainPendingTasks.delete(first));
  second.then(()=>r.explainPendingTasks.delete(second));
  setImmediate(()=>r.emit('close'));
 },{},res).then(()=>{settled=true;});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(settled,false);
 res.explainPendingTasks.add(second);finishFirst();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(settled,false);
 finishSecond();await p;
 assert.equal(settled,true);
});
