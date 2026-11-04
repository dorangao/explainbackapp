import {judgeBody} from '../test-support/judge-login.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMemoryJudgeStore,createJudgeAccess} from '../src/judge-access.mjs';
import {createTesterAuth} from '../src/tester-auth.mjs';

import {judgeStoreContract} from '../test-support/judge-store-contract.mjs';
import {judgeRecoveryContract} from '../test-support/judge-recovery-contract.mjs';
judgeStoreContract('memory',async now=>createMemoryJudgeStore({now}));
judgeRecoveryContract('memory',async now=>createMemoryJudgeStore({now}));

test('judge auth uses fixed cookie expiry, never admin, rejects disabled access and preserves ordinary login',async()=>{
 let time=1000;const store=createMemoryJudgeStore({now:()=>time}),base=createTesterAuth({username:'admin',password:'synthetic-only-password',now:()=>time});
 const gate=createJudgeAccess({auth:base,store,enabled:true,now:()=>time});
 const first=await gate.auth.login(await judgeBody(gate,'visitor'),'',{client:'visitor'}),c=first.cookie.split(';')[0];
 assert.match(first.cookie,/HttpOnly;.*SameSite=Strict;.*Max-Age=1800/);
 assert.equal((await gate.auth.authenticate(c)).audience.kind,'judge');assert.equal(await gate.auth.active(first.id),true);
 assert.equal(await createJudgeAccess({auth:base,store,enabled:false,now:()=>time}).auth.authenticate(c),null);
 time+=1_800_000;assert.equal(await gate.auth.authenticate(c),null);assert.equal(await gate.auth.active(first.id),false);
 const admin=await gate.auth.login({username:'admin',password:'synthetic-only-password'},c);
 assert.equal((await gate.auth.authenticate(admin.cookie)).audience,null);
});
