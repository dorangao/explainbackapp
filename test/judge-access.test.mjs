import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {testerCredentials} from '../test-support/tester.mjs';

async function setup(t,options={}){
 const server=createApp({testerCredentials,configured:true,judgeMode:true,...options});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const get=(path,cookie='')=>fetch(origin+path,{headers:{Cookie:cookie}});
 const post=(path,body,cookie='',originHeader=origin)=>fetch(origin+path,{method:'POST',headers:{Origin:originHeader,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 return {get,post};
}
const cookie=r=>r.headers.get('set-cookie')?.split(';')[0]??'';

test('public judge login creates isolated non-admin sessions and refresh cannot reset its allowance',async t=>{
 const {get,post}=await setup(t);
 assert.equal((await(await get('/api/auth')).json()).judgeMode,true);
 const first=await post('/api/login',{judge:true});assert.equal(first.status,200);
 const firstCookie=cookie(first),status=await(await get('/api/status',firstCookie)).json();
 assert.equal(status.access.kind,'judge');assert.equal(status.access.quota,50);assert.equal(status.access.remaining,50);
 assert.ok(status.access.expiresAt-Date.now()<=1_800_000);assert.ok(status.access.expiresAt-Date.now()>1_795_000);
 assert.notEqual((await(await get('/api/auth',firstCookie)).json()).admin,true);
 assert.equal((await get('/api/admin/judge-usage',firstCookie)).status,403);
 assert.equal((await get('/api/admin/judge-usage')).status,401);
 const second=await post('/api/login',{judge:true,admin:true},firstCookie);assert.equal(second.status,200);
 assert.notEqual(cookie(second),firstCookie);assert.equal((await get('/api/status',firstCookie)).status,401);
 const refreshed=await(await get('/api/status',cookie(second))).json();assert.notEqual(refreshed.access.label,status.access.label);
 const admin=await post('/api/login',testerCredentials),usage=await(await get('/api/admin/judge-usage',cookie(admin))).json();
 assert.equal(usage.sessions.length,2);assert.equal(usage.daily.limit,500);
 assert.ok(usage.sessions.some(s=>s.status==='revoked'));
 assert.doesNotMatch(JSON.stringify(usage),/authId|clientHash|explainback_tester|fixture-password/);
});

test('judge starts reject cross-origin requests, invalid flags and disabled mode',async t=>{
 const {post}=await setup(t,{judgeMode:false});
 assert.equal((await post('/api/login',{judge:true})).status,403);
 const enabled=await setup(t);
 assert.equal((await enabled.post('/api/login',{judge:true},'','https://elsewhere.example')).status,403);
 assert.notEqual((await enabled.post('/api/login',{judge:'true'})).status,200);
});
