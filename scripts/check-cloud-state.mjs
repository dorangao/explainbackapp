// Opt-in integration check against a dedicated Redis database. Synthetic data only.
// node --env-file=<ignored-test-env> scripts/check-cloud-state.mjs
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRedisClient,createRedisServices} from '../src/redis-state.mjs';
import {createSession} from '../src/learning.mjs';
import {createServer,request as httpRequest} from 'node:http';
import {createCloudHandler} from '../src/cloud.mjs';
const namespace='explainback-integration-'+randomUUID(),keys=new Set();
const client=createRedisClient({url:process.env.UPSTASH_REDIS_REST_URL,token:process.env.UPSTASH_REDIS_REST_TOKEN});
const command=async args=>{if(args[0]==='EVAL')for(const key of args.slice(3,3+args[2]))keys.add(key);return client(args);};
const credentials={username:'synthetic-tester',password:'synthetic-integration-password'};
const a=createRedisServices({command,namespace,...credentials}),b=createRedisServices({command,namespace,...credentials});
const servers=[];
try{
 const env={VERCEL_ENV:namespace,VERCEL_URL:'synthetic-preview.vercel.app',EXPLAINBACK_TESTER_USERNAME:credentials.username,EXPLAINBACK_TESTER_PASSWORD:credentials.password,MODEL_API_KEY:'synthetic-not-used',EXPLAINBACK_TRACE:'1',OLLAMA_BASE_URL:'http://192.0.2.1:11434'};
 for(let i=0;i<2;i++){const server=createServer(createCloudHandler({env,command}));await new Promise(r=>server.listen(0,'127.0.0.1',r));servers.push(server);}
 const request=(i,path,body,cookie='')=>new Promise((resolve,reject)=>{
  const req=httpRequest('http://127.0.0.1:'+servers[i].address().port+path,{method:body?'POST':'GET',headers:{Host:env.VERCEL_URL,Origin:'https://'+env.VERCEL_URL,'Content-Type':'application/json',Cookie:cookie}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
  });req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 const signedIn=await request(0,'/api/login',credentials);assert.equal(signedIn.status,200);
 const httpCookie=signedIn.headers.get('set-cookie').split(';')[0];
 const status=await(await request(1,'/api/status',undefined,httpCookie)).json();assert.deepEqual(status.models.map(m=>m.id),['meta:muse-spark-1.3','meta:muse-wonder-1.0']);
 const httpSession=await(await request(0,'/api/session',{problemId:'flight',language:'zh',synthetic:true},httpCookie)).json();assert.equal(httpSession.language,'zh');
 assert.equal((await request(1,'/api/trace',{sessionId:httpSession.sessionId},httpCookie)).status,200);
 assert.equal((await request(1,'/api/logout',{},httpCookie)).status,200);assert.equal((await request(0,'/api/status',undefined,httpCookie)).status,401);
 const login=await a.auth.login(credentials),cookie=login.cookie.split(';')[0];
 assert.match(login.cookie,/; Secure;/);assert.equal((await b.auth.authenticate(cookie)).id,login.id);
 const s={...createSession('crossing','en','claim-testing'),owner:login.id},id='a'.repeat(48);
 assert.equal(await a.state.create(id,s),true);assert.equal((await b.state.get(id)).phase,'claim');
 const locks=await Promise.all([a.state.acquire(id),b.state.acquire(id)]);assert.equal(locks.filter(Boolean).length,1);
 const lock=locks.find(Boolean);s.attempts=1;assert.equal(await b.state.save(id,s,lock),true);
 await a.state.writeTrace(id,[{sequence:1,outcome:'pending'}],lock);assert.equal((await b.state.readTrace(id))[0].outcome,'pending');
 assert.equal(await b.state.save(id,s,lock,[{sequence:1,outcome:'accepted'}]),true);assert.equal((await a.state.readTrace(id))[0].outcome,'accepted');
 assert.equal((await a.state.get(id)).attempts,1);assert.equal(await a.state.save(id,s,'wrong-token'),false);
 await b.auth.revoke(cookie);assert.equal(await a.auth.active(login.id),false);assert.equal(await a.state.save(id,s,lock),false);
 await b.state.remove(id);assert.equal(await a.state.save(id,s,lock),false);assert.deepEqual(await a.state.readTrace(id),[]);
 await a.state.writeTrace(id,[{sequence:2}],lock);assert.deepEqual(await b.state.readTrace(id),[]);
 const next=await b.auth.login(credentials),second={...s,owner:next.id,createdAt:Date.now()};
 assert.equal(await b.state.create(id,second),true);const newLock=await b.state.acquire(id);await a.state.release(id,lock);assert.equal(await a.state.acquire(id),null);
 await b.state.release(id,newLock);assert.ok(await a.state.acquire(id));
 const rotated=await a.auth.login(credentials,next.cookie);assert.equal(await b.auth.active(next.id),false);assert.equal(await b.auth.active(rotated.id),true);
 const changed=createRedisServices({command,namespace,...credentials,password:'synthetic-rotated-password'});assert.equal(await changed.auth.authenticate(rotated.cookie),null);
 for(let i=0;i<5;i++)await assert.rejects((i%2?a:b).auth.login({...credentials,password:'wrong'}),e=>e.status===401);
 await assert.rejects(a.auth.login(credentials),e=>e.status===429);
 const allowance=await Promise.all(Array.from({length:65},(_,i)=>(i%2?a:b).state.consumeTurn()));assert.equal(allowance.filter(Boolean).length,60);
 const sessionKey=[...keys].find(k=>k.startsWith(namespace+':')&&k.endsWith(':session:'+id));
 await client(['PEXPIRE',sessionKey,1]);await new Promise(r=>setTimeout(r,20));assert.equal(await a.state.get(id),null);
 console.log('PASS: cloud HTTP entry and real Redis cross-instance login, Meta-only catalog, Chinese session, rotation/revocation, persistence, atomic locks, trace/reset, expiry and shared limits. No provider calls.');
}finally{
 for(const server of servers)await new Promise(r=>server.close(r));
 if(keys.size)await client(['DEL',...[...keys].filter(k=>k.startsWith(namespace+':')||k.startsWith('explainback:'+namespace+':'))]);
 console.log('Removed this check’s synthetic Redis keys.');
}
