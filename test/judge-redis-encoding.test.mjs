import test from 'node:test';
import assert from 'node:assert/strict';
import {createJudgeAccess,judgeCookieId,judgeSummary} from '../src/judge-access.mjs';
import {createRedisJudgeStore} from '../src/judge-redis.mjs';

test('a judge stays authenticated after a Redis JSON rewrite omits null fields',async()=>{
 const cookie='explainback_tester='+'a'.repeat(64),id=judgeCookieId(cookie),now=()=>2000;
 // Production Upstash cjson.encode omits revokedAt:null on the first reservation.
 // This wire-format fixture represents a session with one charged provider call.
 const record={authId:id,id:'public-test-session',createdAt:1000,expiresAt:1801000,calls:[{number:1,model:'muse-spark-1.3',action:'/api/studio/compose',outcome:'pending',at:1500}]};
 let raw=JSON.stringify(record);
 const store=createRedisJudgeStore({key:(kind,id)=>kind+':'+id,get:async()=>raw,now});
 const gate=createJudgeAccess({auth:{authenticate:async()=>null},store,enabled:true,now});
 const tester=await gate.auth.authenticate(cookie);
 assert.equal(tester?.id,id);
 assert.equal(await gate.auth.active(id),true);
 assert.equal((await gate.status(tester)).remaining,49);
 assert.equal(judgeSummary(await store.find(id),now()).status,'active');
 raw=JSON.stringify({...record,revokedAt:1900});
 assert.equal(await gate.auth.authenticate(cookie),null);
 raw=JSON.stringify({...record,expiresAt:1999});
 assert.equal(await gate.auth.authenticate(cookie),null);
});
