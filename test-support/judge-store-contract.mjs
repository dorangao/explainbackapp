import test from 'node:test';
import assert from 'node:assert/strict';
const start=(store,id,client=id,previousId=null)=>store.start({authId:id,publicId:'public-'+id,client,previousId});
export function judgeStoreContract(name,factory){
 test(`${name}: exactly 50 concurrent calls fit one session; failed calls still count`,async()=>{
  let time=Date.UTC(2026,10,3,12);const store=await factory(()=>time);await start(store,'one');
  const results=await Promise.all(Array.from({length:70},()=>store.reserve('one',{model:'muse-spark-1.3',action:'/api/studio/compose'})));
  assert.equal(results.filter(r=>r.number).length,50);assert.equal(results.filter(r=>r.error==='JUDGE_SESSION_LIMIT').length,20);
  await store.finish('one',1,{outcome:'failed'});await store.finish('one',2,{outcome:'succeeded',usage:{input_tokens:120,output_tokens:30}});
  await store.finish('one',2,{outcome:'succeeded',usage:{input_tokens:120,output_tokens:30}});
  const row=await store.find('one');assert.equal(row.calls.length,50);assert.equal(row.calls[1].input,120);
  assert.equal((await store.reserve('one',{model:'m',action:'a'})).error,'JUDGE_SESSION_LIMIT');
  const usage=await store.list();assert.equal(usage.daily.used,50);assert.equal(usage.sessions[0].failed,1);assert.equal(usage.sessions[0].inputTokens,120);
 });
 test(`${name}: all sessions share 500 calls per UTC day across store clients`,async()=>{
  let time=Date.UTC(2026,10,3,23,58);const store=await factory(()=>time);
  for(let i=0;i<12;i++)await start(store,String(i));
  const results=await Promise.all(Array.from({length:600},(_,i)=>store.reserve(String(i%12),{model:'m',action:'a'})));
  assert.equal(results.filter(r=>r.number).length,500);
  assert.equal((await store.list()).daily.used,500);
  await start(store,'later');assert.equal((await store.reserve('later',{model:'m',action:'a'})).error,'JUDGE_DAILY_LIMIT');
  time+=2*60_000;assert.ok((await store.reserve('later',{model:'m',action:'a'})).number);
  assert.equal((await store.list()).daily.used,1);
 });
 test(`${name}: replacing an unused session keeps its usage record readable`,async()=>{
  const store=await factory(()=>1000);await start(store,'unused');await start(store,'new','another','unused');
  const result=await store.list();assert.equal(result.sessions.length,2);assert.ok(result.sessions.some(s=>s.status==='revoked'&&s.calls===0));
 });
 test(`${name}: expiry and restart cannot revive old sessions or erase daily usage`,async()=>{
  let time=1000;const store=await factory(()=>time);await start(store,'old');
  await store.reserve('old',{model:'m',action:'a'});time+=1_799_999;
  assert.ok((await store.reserve('old',{model:'m',action:'a'})).number);time++;
  assert.equal((await store.reserve('old',{model:'m',action:'a'})).error,'JUDGE_EXPIRED');
  await start(store,'fresh','new-client','old');assert.ok((await store.reserve('fresh',{model:'m',action:'a'})).number);
  assert.equal((await store.list()).daily.used,3);
  await store.revoke('fresh');assert.equal((await store.reserve('fresh',{model:'m',action:'a'})).error,'JUDGE_EXPIRED');
 });
 test(`${name}: session issuance is throttled and audit output excludes authentication and client identifiers`,async()=>{
  let time=1000;const store=await factory(()=>time);
  for(let i=0;i<3;i++)assert.ok((await start(store,'id'+i,'same-visitor')).record);
  assert.equal((await start(store,'id3','same-visitor')).error,'JUDGE_START_LIMIT');
  assert.ok((await start(store,'other','another-visitor')).record);
  const usage=await store.list();assert.doesNotMatch(JSON.stringify(usage),/same-visitor|another-visitor|authId|client/);
  time+=3_600_000;assert.ok((await start(store,'id4','same-visitor')).record);
  time+=8*86400_000;assert.equal((await store.list()).sessions.length,0);
 });
}
