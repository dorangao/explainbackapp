import {judgeBody} from './judge-login.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createJudgeAccess} from '../src/judge-access.mjs';
export function judgeResourceContract(name,factory){
 test(`${name}: each trial is bounded inside the shared pool without evicting another trial`,async()=>{
  const {state,auth,judgeStore}=await factory();const gate=createJudgeAccess({auth,store:judgeStore,enabled:true});
  for(let n=0;n<10;n++){
   const login=await gate.auth.login(await judgeBody(gate,'visitor'+n),'',{client:'visitor'+n});
   for(let i=0;i<30;i++)assert.equal(await state.create(`judge-${n}-${i}`,{owner:login.id,audience:login.audience.label,createdAt:Date.now()+i}),true);
   const live=await Promise.all(Array.from({length:30},(_,i)=>state.get(`judge-${n}-${i}`)));
   assert.equal(live.filter(Boolean).length,3);
  }
  const last=await gate.auth.login(await judgeBody(gate,'last'),'',{client:'last'});
  assert.equal(await state.create('overflow',{owner:last.id,audience:last.audience.label,createdAt:Date.now()}),false);
  for(let n=0;n<10;n++)assert.ok(await state.get(`judge-${n}-29`));
  const admin=await auth.login({username:'test',password:'synthetic-only-password'});
  assert.equal(await state.create('admin-workflow',{owner:admin.id,audience:null,createdAt:Date.now()}),true);
 });
 test(`${name}: concurrent creates keep at most three workflows and locked work cannot block another trial`,async()=>{
  const {state,auth,judgeStore}=await factory();const gate=createJudgeAccess({auth,store:judgeStore,enabled:true});
  const first=await gate.auth.login(await judgeBody(gate,'first'),'',{client:'first'});
  const workflow={owner:first.id,audience:first.audience.label,createdAt:Date.now()};
  await Promise.all(Array.from({length:30},(_,i)=>state.create('concurrent-'+i,workflow)));
  const live=(await Promise.all(Array.from({length:30},async(_,i)=>await state.get('concurrent-'+i)?'concurrent-'+i:null))).filter(Boolean);
  assert.equal(live.length,3);
  for(const id of live)assert.ok(await state.acquire(id));
  assert.equal(await state.create('locked-overflow',workflow),false);
  const second=await gate.auth.login(await judgeBody(gate,'second'),'',{client:'second'});
  assert.equal(await state.create('other-trial',{owner:second.id,audience:second.audience.label,createdAt:Date.now()}),true);
  for(const id of live)assert.ok(await state.get(id));
 });
 test(`${name}: anonymous saved records have an atomic aggregate cap, and deletion reclaims it`,async()=>{
  const {state}=await factory();
  const record=i=>({id:i.toString(16).padStart(16,'0'),owner:'code:judge:'+i,createdAt:1,updatedAt:1,shared:false});
  const results=await Promise.all(Array.from({length:120},(_,i)=>state.putLesson(record(i),50,null)));
  assert.equal(results.filter(Boolean).length,100);
  const inserted=results.findIndex(Boolean);assert.equal(await state.deleteLesson(record(inserted).owner,record(inserted).id),true);
  assert.equal(await state.putLesson(record(130),50,null),true);
  assert.equal(await state.putLesson({...record(131),owner:'tester'},50,null),true);
 });
 test(`${name}: save reservations are atomic, separate from model calls, and share a daily ceiling`,async()=>{
  const {judgeStore:store}=await factory();
  for(let i=0;i<11;i++)await store.start({authId:'write-'+i,publicId:'write-'+i,client:'write-'+i});
  const first=await Promise.all(Array.from({length:15},()=>store.reserveWrite('write-0')));
  assert.equal(first.filter(r=>r.ok).length,10);
  assert.equal(first.filter(r=>r.error==='JUDGE_SAVE_LIMIT').length,5);
  for(let i=1;i<10;i++)for(let j=0;j<10;j++)assert.equal((await store.reserveWrite('write-'+i)).ok,true);
  assert.equal((await store.reserveWrite('write-10')).error,'JUDGE_DAILY_SAVE_LIMIT');
  assert.equal((await store.list()).daily.used,0);
 });
}
