import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeHash} from '../src/judge-challenge.mjs';
export function judgeRecoveryContract(name,factory){
 test(`${name}: challenges expire, bind to the client and allow only one attempt`,async()=>{
  let time=1000;const store=await factory(()=>time);
  const issue=async id=>{assert.ok((await store.issueChallenge({id,answerHash:challengeHash(id,'24680'),expiresAt:time+300000},'client')).ok);};
  await issue('one');assert.equal(await store.verifyChallenge('one',challengeHash('one','24680'),'other'),false);
  assert.equal(await store.verifyChallenge('one',challengeHash('one','wrong'),'client'),false);
  assert.equal(await store.verifyChallenge('one',challengeHash('one','24680'),'client'),false);
  await issue('two');const results=await Promise.all(Array.from({length:8},()=>store.verifyChallenge('two',challengeHash('two','24680'),'client')));
  assert.equal(results.filter(Boolean).length,1);
  await issue('three');time+=300000;assert.equal(await store.verifyChallenge('three',challengeHash('three','24680'),'client'),false);
 });
 test(`${name}: challenge issuance is bounded and recovers without erasing model usage`,async()=>{
  let time=1000;const store=await factory(()=>time);
  for(let i=0;i<10;i++)assert.ok((await store.issueChallenge({id:String(i),answerHash:'hash',expiresAt:time+300000},'client')).ok);
  assert.deepEqual(await store.issueChallenge({id:'extra'},'client'),{error:'JUDGE_CHALLENGE_RATE',retryAfter:60});
  time+=60000;assert.ok((await store.issueChallenge({id:'next',answerHash:'hash',expiresAt:time+300000},'client')).ok);
 });
 test(`${name}: explicit resets preserve total calls, expiry, outcomes and an audit trail`,async()=>{
  let time=Date.UTC(2026,10,3,12);const store=await factory(()=>time);
  await store.start({authId:'one',publicId:'public-one',client:'client'});
  const expiry=(await store.find('one')).expiresAt;
  for(let i=0;i<50;i++)await store.reserve('one',{model:'m',action:'a'});
  await store.finish('one',1,{outcome:'succeeded',usage:{input_tokens:2}});
  assert.equal((await store.reserve('one',{model:'m',action:'a'})).error,'JUDGE_SESSION_LIMIT');
  assert.ok((await store.reset({type:'session',sessionId:'public-one',reason:'Synthetic recovery test',client:'client'})).ok);
  const attempts=await Promise.all(Array.from({length:60},()=>store.reserve('one',{model:'m',action:'a'})));
  assert.equal(attempts.filter(r=>r.number).length,50);
  assert.equal((await store.find('one')).calls.length,100);assert.equal((await store.find('one')).expiresAt,expiry);
  assert.equal((await store.list()).sessions[0].succeeded,1);
  assert.ok((await store.reset({type:'daily',reason:'Synthetic recovery test',client:'client'})).ok);
  const usage=await store.list();assert.equal(usage.daily.used,0);assert.equal(usage.daily.total,100);assert.equal(usage.resets.length,2);
  assert.equal(usage.resets[0].previousUsed,100);assert.equal(usage.resets[1].previousUsed,50);
  assert.doesNotMatch(JSON.stringify(usage.resets),/authId|client/);
  time=expiry;assert.equal((await store.reset({type:'session',sessionId:'public-one',reason:'Expired session',client:'client'})).error,'JUDGE_EXPIRED');
  assert.equal((await store.list()).resets.length,2);
 });
 test(`${name}: a daily reset after saves alone preserves a zero call total`,async()=>{
  const store=await factory(()=>1000);
  await store.start({authId:'save-only',publicId:'save-only',client:'client'});
  assert.ok((await store.reserveWrite('save-only')).ok);
  await store.reset({type:'daily',reason:'Synthetic zero-call reset',client:'client'});
  const usage=await store.list();assert.equal(usage.daily.used,0);assert.equal(usage.daily.total,0);
  assert.equal(usage.resets[0].previousUsed,0);assert.equal(usage.sessions[0].saves,1);
 });
 test(`${name}: start reset only clears this network and global cooldowns`,async()=>{
  const store=await factory(()=>1000);
  for(const client of ['one','two'])for(let i=0;i<10;i++)await store.start({authId:client+i,publicId:client+i,client});
  assert.equal((await store.start({authId:'denied',publicId:'denied',client:'one'})).error,'JUDGE_START_LIMIT');
  await store.reset({type:'starts',client:'one',reason:'Synthetic cooldown test'});
  assert.ok((await store.start({authId:'fresh',publicId:'fresh',client:'one'})).record);
  assert.equal((await store.start({authId:'still-denied',publicId:'still-denied',client:'two'})).error,'JUDGE_START_LIMIT');
  assert.equal((await store.list()).resets[0].type,'starts');
 });
}
