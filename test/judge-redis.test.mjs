import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {startRedis} from '../test-support/redis-server.mjs';
import {judgeStoreContract} from '../test-support/judge-store-contract.mjs';
import {createRedisServices} from '../src/redis-state.mjs';
import {createJudgeAccess} from '../src/judge-access.mjs';
import {createRedisJudgeStore} from '../src/judge-redis.mjs';
import {judgeResourceContract} from '../test-support/judge-resource-contract.mjs';
const binary=process.env.EXPLAINBACK_TEST_REDIS;
if(!binary)test('actual Redis judge quota contract (set EXPLAINBACK_TEST_REDIS)',{skip:true},()=>{});
else{
 const redis=await startRedis(binary);after(()=>redis.close());
 const services=(now,namespace=randomUUID())=>createRedisServices({command:redis.command,namespace,username:'test',password:'synthetic-only-password',now});
 judgeResourceContract('redis',async()=>services(()=>Date.now()));
 judgeStoreContract('redis',async now=>services(now).judgeStore);
 test('the short start window ignores legacy client lockouts but retains global issuance and model usage',async()=>{
  const time=Date.UTC(2026,10,3,12),prefix=randomUUID(),key=(...parts)=>[prefix,...parts].join(':');
  const get=k=>redis.command(['GET',k]);
  const store=createRedisJudgeStore({key,get,authKey:id=>key('auth',id),now:()=>time,run:(script,keys,args)=>redis.command(['EVAL',script,keys.length,...keys,...args])});
  await redis.command(['SET',key('judge-starts','client'),JSON.stringify({count:3,untilAt:time+3600000})]);
  await redis.command(['SET',key('judge-starts','all'),JSON.stringify({count:99,untilAt:time+3600000})]);
  await redis.command(['SET',key('judge-day','2026-11-03'),'499']);
  assert.ok((await store.start({authId:'fresh',publicId:'public',client:'client'})).record);
  assert.deepEqual(await store.start({authId:'blocked',publicId:'blocked',client:'other'}),{error:'JUDGE_START_LIMIT',retryAfter:3600});
  assert.equal((await store.reserve('fresh',{model:'m',action:'a'})).number,1);
  assert.equal((await store.reserve('fresh',{model:'m',action:'a'})).error,'JUDGE_DAILY_LIMIT');
 });
 test('two Redis handlers share judge cookies and workflow authorization, and disabled mode rejects them',async()=>{
  const now=()=>Date.now(),namespace=randomUUID(),first=services(now,namespace),second=services(now,namespace);
  const a=createJudgeAccess({auth:first.auth,store:first.judgeStore,enabled:true}),b=createJudgeAccess({auth:second.auth,store:second.judgeStore,enabled:true});
  const login=await a.auth.login({judge:true},'',{client:'a'}),cookie=login.cookie.split(';')[0];
  assert.match(login.cookie,/Secure/);assert.equal((await b.auth.authenticate(cookie)).id,login.id);
  const workflow={owner:login.id,audience:login.audience.label,createdAt:Date.now(),attempts:0};
  assert.equal(await first.state.create('workflow',workflow),true);const lock=await second.state.acquire('workflow');assert.ok(lock);
  assert.equal(await second.state.save('workflow',{...workflow,attempts:1},lock),true);
  await b.auth.revoke(cookie);assert.equal(await first.state.save('workflow',workflow,lock),false);
  assert.equal(await a.auth.authenticate(cookie),null);
 });
}
