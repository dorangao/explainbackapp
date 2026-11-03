import test from 'node:test';import assert from 'node:assert/strict';
import {createMemoryState,MAX_SESSIONS_PER_BUCKET} from '../src/state.mjs';

const session=(owner,audience,createdAt)=>({workflow:'lesson-studio',language:'en',owner,audience,createdAt,attempts:0});

test('one sign-in bucket cannot crowd the others out of the shared session cap',async()=>{
 let clock=1_000;const state=createMemoryState({now:()=>clock});
 // A code fills its own bucket; each later session evicts that bucket's oldest one.
 for(let i=0;i<MAX_SESSIONS_PER_BUCKET;i++)assert.equal(await state.create(`a${i}`,session('code-a','judges',clock+i)),true);
 assert.equal(await state.create('a-next',session('code-a','judges',clock+99)),true);
 assert.equal(await state.get('a0'),null,'the oldest session of the full bucket is gone');
 assert.ok(await state.get('a1'));assert.ok(await state.get('a-next'));
 // A session inside a request is never the one evicted.
 const token=await state.acquire('a1');assert.ok(token);
 assert.equal(await state.create('a-more',session('code-a','judges',clock+100)),true);
 assert.ok(await state.get('a1'),'the locked session stays');assert.equal(await state.get('a2'),null);
 await state.release('a1',token);
 // The tester account and another code are unaffected and still get sessions.
 assert.equal(await state.create('t0',session('tester-login',null,clock+5)),true);
 assert.equal(await state.create('b0',session('code-b','reviewers',clock+5)),true);
 assert.equal((await state.get('t0')).owner,'tester-login');
 // The shared cap still holds overall.
 let made=0;for(let i=0;i<120;i++)if(await state.create(`c${i}`,session(`login-${i}`,`code-${i%10}`,clock+200+i)))made++;
 assert.ok(made<=100-MAX_SESSIONS_PER_BUCKET-2,`${made} further sessions fit under the shared cap`);
 assert.equal(await state.create('over',session('login-x','code-x',clock+999)),false);
});
