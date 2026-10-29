import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createOllamaCoordinator} from '../src/llm/ollama-coordinator.mjs';
async function fixture(t,fetchImpl){const dir=await mkdtemp(join(tmpdir(),'eb-lock-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));return {baseUrl:'http://localhost:11434',models:['a','b'],lockDir:dir,fetchImpl};}
test('coordinators share an exclusive lock and unload/verify old model before generation',async t=>{
 let loaded=['a'],release;const events=[];
 const options=await fixture(t,async(url,req)=>{if(url.endsWith('/api/ps'))return Response.json({models:loaded.map(name=>({name}))});const body=JSON.parse(req.body);events.push('unload:'+body.model);loaded=[];return Response.json({done:true});});
 const one=createOllamaCoordinator(options),two=createOllamaCoordinator(options);
 const pending=one.exclusive(async api=>{await api.prepare('b');events.push('generate:b');await new Promise(r=>release=r);});
 while(!release)await new Promise(r=>setImmediate(r));
 await assert.rejects(two.exclusive(()=>assert.fail('overlap')),e=>e.code==='OLLAMA_BUSY');
 assert.deepEqual(events,['unload:a','generate:b']);release();await pending;await two.exclusive(async api=>api.prepare('a'));
});
test('unknown loaded model or unconfirmed unload prevents switching',async t=>{
 for(const loaded of ['other','a']){const options=await fixture(t,async()=>Response.json({models:[{name:loaded}],done:true}));const c=createOllamaCoordinator({...options,pollMs:1,unloadTimeoutMs:3});await assert.rejects(c.exclusive(api=>api.prepare('b')));}
});
test('uncertain failures block subsequent calls until explicit recovery',async t=>{
 const options=await fixture(t,async()=>Response.json({models:[]}));const c=createOllamaCoordinator(options);
 await assert.rejects(c.exclusive(async()=>{throw Object.assign(new Error('timeout'),{uncertain:true});}));
 await assert.rejects(c.exclusive(()=>assert.fail('must stay blocked')),e=>e.code==='OLLAMA_UNCERTAIN');
 await c.recover();await c.exclusive(()=>Promise.resolve());
});
test('uncertainty explicitly recorded inside an evaluation persists after a caught failure',async t=>{
 const options=await fixture(t,async()=>Response.json({models:[]}));const c=createOllamaCoordinator(options);
 await c.exclusive(async api=>{await api.block();await assert.rejects(api.prepare('b'),e=>e.code==='OLLAMA_UNCERTAIN');});
 await assert.rejects(c.exclusive(()=>assert.fail('must stay blocked')),e=>e.code==='OLLAMA_UNCERTAIN');
});
test('recovery guard blocks both recovery and ordinary acquisition',async t=>{
 const {writeFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');const options=await fixture(t,()=>assert.fail('must not reach control API'));
 const lock=join(options.lockDir,'explainback-ollama-'+createHash('sha256').update(options.baseUrl).digest('hex').slice(0,20)+'.lock');
 await writeFile(lock+'.recovery',JSON.stringify({pid:process.pid,token:'live-recovery'}));
 const c=createOllamaCoordinator(options);await assert.rejects(c.recover(),e=>e.code==='OLLAMA_BUSY');await assert.rejects(c.exclusive(()=>assert.fail('guarded')),e=>e.code==='OLLAMA_BUSY');
});
test('explicit recovery handles old incomplete metadata but refuses fresh incomplete metadata',async t=>{
 const {writeFile,utimes,access}=await import('node:fs/promises'),{createHash}=await import('node:crypto');const options=await fixture(t,async()=>Response.json({models:[]}));
 const lock=join(options.lockDir,'explainback-ollama-'+createHash('sha256').update(options.baseUrl).digest('hex').slice(0,20)+'.lock'),c=createOllamaCoordinator(options);
 await writeFile(lock,'');await assert.rejects(c.recover(),e=>e.code==='OLLAMA_BUSY');await access(lock);
 await utimes(lock,new Date(0),new Date(0));await c.recover();await c.exclusive(()=>Promise.resolve());
});
test('concurrent stale-owner recoveries never overlap control operations or remove the replacement owner',async t=>{
 const {writeFile}=await import('node:fs/promises'),{createHash}=await import('node:crypto');let active=0,max=0;
 const options=await fixture(t,async()=>{max=Math.max(max,++active);await new Promise(r=>setTimeout(r,5));active--;return Response.json({models:[]});});
 const lock=join(options.lockDir,'explainback-ollama-'+createHash('sha256').update(options.baseUrl).digest('hex').slice(0,20)+'.lock');
 await writeFile(lock,JSON.stringify({pid:2147483647,token:'dead'}));
 const results=await Promise.allSettled(Array.from({length:8},()=>createOllamaCoordinator(options).recover()));
 assert.equal(max,1);assert.ok(results.some(r=>r.status==='fulfilled'));assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.code==='OLLAMA_BUSY'));
 await createOllamaCoordinator(options).exclusive(async()=>{await assert.rejects(createOllamaCoordinator(options).recover(),e=>e.code==='OLLAMA_BUSY');});
});
