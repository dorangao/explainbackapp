import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
test('suction catalog, safe module routes and pinned settings survive HTTP session creation',async t=>{
 const server=createApp({testerCredentials,configured:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const post=body=>fetch(origin+'/api/session',{method:'POST',headers:{Cookie:cookie,Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const status=await(await fetch(origin+'/api/status',{headers:{Cookie:cookie}})).json();assert.ok(status.problems.some(p=>p.id==='suction'));
 const body={problemId:'suction',language:'zh',synthetic:true,workflow:'claim-testing'};
 const s=await(await post(body)).json();assert.equal(s.problem.id,'suction');assert.equal(s.phase,'claim');assert.equal(s.graph,null);assert.equal(s.designProposal,null);
 assert.equal((await post({...body,suction:{pressurePa:'6000'}})).status,400);assert.equal((await post({...body,workflow:'baseline'})).status,400);
});
