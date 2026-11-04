import {httpJudgeBody} from '../test-support/judge-login.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {testerCredentials} from '../test-support/tester.mjs';
import {createMemoryJudgeStore} from '../src/judge-access.mjs';

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

test('a burst-limited start supplies the remaining wait and preserves the existing session',async t=>{
 let time=Date.now();const judgeStore=createMemoryJudgeStore({now:()=>time});
 const {post,get}=await setup(t,{judgeStore});let existing='';
 for(let i=0;i<10;i++){const response=await post('/api/login',await httpJudgeBody(post),existing);assert.equal(response.status,200);existing=cookie(response);}
 time+=60_000;
 const body=await httpJudgeBody(post);
 for(let i=0;i<10;i++)await judgeStore.start({authId:'burst'+i,publicId:'burst'+i,client:(await import('node:crypto')).createHash('sha256').update('127.0.0.1').digest('hex')});
 time+=32_100;
 const response=await post('/api/login',body,existing);
 assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'28');
 assert.equal(response.headers.get('set-cookie'),null);
 assert.equal((await response.json()).retryAfter,28);
 assert.equal((await get('/api/status',existing)).status,200);
 time+=27_900;assert.equal((await post('/api/login',await httpJudgeBody(post),existing)).status,200);
});

test('public judge login creates isolated non-admin sessions and refresh cannot reset its allowance',async t=>{
 const {get,post}=await setup(t);
 assert.equal((await(await get('/api/auth')).json()).judgeMode,true);
 const first=await post('/api/login',await httpJudgeBody(post));assert.equal(first.status,200);
 const firstCookie=cookie(first),status=await(await get('/api/status',firstCookie)).json();
 assert.equal(status.access.kind,'judge');assert.equal(status.access.quota,50);assert.equal(status.access.remaining,50);
 assert.ok(status.access.expiresAt-Date.now()<=1_800_000);assert.ok(status.access.expiresAt-Date.now()>1_795_000);
 assert.notEqual((await(await get('/api/auth',firstCookie)).json()).admin,true);
 assert.equal((await get('/api/admin/judge-usage',firstCookie)).status,403);
 assert.equal((await get('/api/admin/judge-usage')).status,401);
 const second=await post('/api/login',{...await httpJudgeBody(post),admin:true},firstCookie);assert.equal(second.status,200);
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

test('Judge sign-in requires a single-use check and failures keep the existing login',async t=>{
 const {post,get}=await setup(t);
 assert.equal((await post('/api/login',{judge:true})).status,400);
 const image=await(await post('/api/judge-challenge',{kind:'image'})).json();assert.match(image.image,/^data:image\/png;base64,/);assert.equal(image.answerHash,undefined);
 const first=await httpJudgeBody(post),login=await post('/api/login',first),session=cookie(login);assert.equal(login.status,200);
 const replay=await post('/api/login',first,session);assert.equal(replay.status,400);assert.equal((await replay.json()).code,'JUDGE_CHALLENGE');assert.equal((await get('/api/status',session)).status,200);
 const wrong=await httpJudgeBody(post);assert.equal((await post('/api/login',{...wrong,answer:'999999'},session)).status,400);
 assert.equal((await post('/api/login',wrong,session)).status,400);
 assert.equal((await post('/api/judge-challenge',{kind:'text'},'','https://elsewhere.example')).status,403);
});

test('only the tester administrator may explicitly reset Judge budgets and audit totals survive',async t=>{
 const judgeStore=createMemoryJudgeStore(),{post,get}=await setup(t,{judgeStore});
 const guest=cookie(await post('/api/login',await httpJudgeBody(post)));
 const guestStatus=await(await get('/api/status',guest)).json();
 const body={type:'daily',reason:'Synthetic test recovery',confirm:true};
 assert.equal((await post('/api/admin/judge-reset',body)).status,401);
 assert.equal((await post('/api/admin/judge-reset',body,guest)).status,403);
 const admin=cookie(await post('/api/login',testerCredentials));
 assert.equal((await post('/api/admin/judge-reset',{...body,confirm:false},admin)).status,400);
 assert.equal((await post('/api/admin/judge-reset',{...body,reason:''},admin)).status,400);
 assert.equal((await post('/api/admin/judge-reset',body,admin,'https://elsewhere.example')).status,403);
 const {judgeCookieId}=await import('../src/judge-access.mjs');
 await judgeStore.reserve(judgeCookieId(guest),{model:'m',action:'a'});
 assert.equal((await post('/api/admin/judge-reset',{...body,type:'session',sessionId:guestStatus.access.label},admin)).status,200);
 const refreshed=await(await get('/api/status',guest)).json();assert.equal(refreshed.access.remaining,50);assert.equal(refreshed.access.expiresAt,guestStatus.access.expiresAt);
 assert.equal((await post('/api/admin/judge-reset',body,admin)).status,200);
 const usage=await(await get('/api/admin/judge-usage',admin)).json();assert.equal(usage.daily.used,0);assert.equal(usage.daily.total,1);assert.equal(usage.sessions[0].calls,1);assert.equal(usage.resets.length,2);
 assert.equal((await post('/api/admin/judge-reset',{...body,type:'session',sessionId:'0'.repeat(16)},admin)).status,409);
 assert.equal((await get('/api/admin/judge-usage',admin)).status,200);
});
