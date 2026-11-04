import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cloudOrigins} from '../src/cloud.mjs';
import {createRedisClient} from '../src/redis-state.mjs';
import {createTrace} from '../src/trace.mjs';
test('cloud origins accept only configured HTTPS hosts and ignore forwarded headers',()=>{
 const origin=cloudOrigins({VERCEL_URL:'example-unique.vercel.app',VERCEL_BRANCH_URL:'example-branch.vercel.app'});
 assert.equal(origin({headers:{host:'example-unique.vercel.app'}}),'https://example-unique.vercel.app');
 assert.equal(origin({headers:{host:'attacker.vercel.app','x-forwarded-host':'example-unique.vercel.app'}}),null);
 assert.throws(()=>cloudOrigins({EXPLAINBACK_PUBLIC_ORIGINS:'http://localhost:4173'}));
 assert.throws(()=>cloudOrigins({}));
});
test('production accepts only explicit app domains and never falls back to Vercel aliases',()=>{
 const env={VERCEL_ENV:'production',VERCEL_URL:'example-unique.vercel.app',VERCEL_BRANCH_URL:'example-main.vercel.app',VERCEL_PROJECT_PRODUCTION_URL:'example.vercel.app',EXPLAINBACK_PUBLIC_ORIGINS:'https://explainback.app'};
 const origin=cloudOrigins(env);
 assert.equal(origin({headers:{host:'explainback.app'}}),'https://explainback.app');
 for(const host of [env.VERCEL_URL,env.VERCEL_BRANCH_URL,env.VERCEL_PROJECT_PRODUCTION_URL,'www.explainback.app','explainback.app.attacker.example'])assert.equal(origin({headers:{host,'x-forwarded-host':'explainback.app'}}),null,host);
 assert.throws(()=>cloudOrigins({...env,EXPLAINBACK_PUBLIC_ORIGINS:''}));
 const preview=cloudOrigins({...env,VERCEL_ENV:'preview'});
 assert.equal(preview({headers:{host:env.VERCEL_URL}}),'https://'+env.VERCEL_URL);
});
test('Redis transport is authenticated, bounded, and never retries or leaks raw errors',async()=>{
 let calls=0;
 const client=createRedisClient({url:'https://redis.example',token:'fixture-secret',fetchImpl:async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer fixture-secret');assert.equal(options.redirect,'error');assert.ok(options.signal);return Response.json({error:'private provider details'},{status:500});}});
 await assert.rejects(client(['GET','test']),e=>e.message==='Shared session storage is unavailable.');assert.equal(calls,1);
 for(const url of ['http://localhost:6379','https://user:password@redis.example','https://redis.example/path','https://redis.example?token=secret'])assert.throws(()=>createRedisClient({url,token:'fixture'}));
});
test('persisted traces redact before writing and preserve sequence across instances',async()=>{
 const written=[];const a=createTrace('fixture-secret',{onChange:async rows=>written.push(rows)}),call=a.start({input:'fixture-secret'});
 call.event({type:'response',body:{thinking:'private',content:'fixture-secret'}});call.finish('accepted');await a.flush();
 assert.doesNotMatch(JSON.stringify(written),/fixture-secret|private/);
 const b=createTrace('',{initial:written.at(-1)});b.start({input:'next'});assert.equal(b.read().at(-1).sequence,2);
});

test('the cloud handler counts sign-in failures by the platform client header',async()=>{
 const {vercelClientAddress}=await import('../src/cloud.mjs');
 assert.equal(vercelClientAddress({headers:{'x-real-ip':'203.0.113.7','x-forwarded-for':'10.0.0.1'},socket:{remoteAddress:'127.0.0.1'}}),'203.0.113.7');
 assert.equal(vercelClientAddress({headers:{'x-forwarded-for':'198.51.100.9, 10.0.0.1'},socket:{remoteAddress:'127.0.0.1'}}),'198.51.100.9');
 assert.equal(vercelClientAddress({headers:{},socket:{remoteAddress:'127.0.0.1'}}),'127.0.0.1');
});
