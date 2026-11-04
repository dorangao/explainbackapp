import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {createApp} from '../src/server.mjs';
import {cloudOrigins} from '../src/cloud.mjs';
import {createTesterAuth} from '../src/tester-auth.mjs';
import {testerCredentials} from '../test-support/tester.mjs';

test('production API rejects foreign browser requests before session storage and keeps same-origin access working',async t=>{
 let authReads=0,providerCalls=0;
 const original=createTesterAuth(testerCredentials);
 const auth={...original,authenticate(cookie){authReads++;return original.authenticate(cookie);}};
 const server=createApp({auth,configured:true,modelCall:async()=>{providerCalls++;throw new Error('No model call expected.');},getOrigin:cloudOrigins({VERCEL_ENV:'production',VERCEL_URL:'deployment.vercel.app',EXPLAINBACK_PUBLIC_ORIGINS:'https://explainback.app'})});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const call=(path,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{
  const request=httpRequest({hostname:'127.0.0.1',port:server.address().port,path,method,headers:{Host:'explainback.app',...headers}},response=>{
   let raw='';response.on('data',chunk=>raw+=chunk);response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:JSON.parse(raw)}));
  });request.on('error',reject);request.end(body===undefined?undefined:JSON.stringify(body));
 });
 const denied=[
  ['/api/shared',{headers:{Origin:'https://foreign.example'}}],
  ['/api/auth',{headers:{Origin:'null'}}],
  ['/api/shared',{headers:{'Sec-Fetch-Site':'cross-site'}}],
  ['/api/shared',{headers:{'Sec-Fetch-Site':'same-site'}}],
  ['/api/auth',{headers:{Origin:'https://explainback.app.attacker.example'}}],
  ['/api/auth',{headers:{Host:'deployment.vercel.app',Origin:'https://explainback.app'}}],
  ['/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:testerCredentials}],
  ['/api/login',{method:'POST',headers:{Origin:'https://foreign.example','Content-Type':'application/json'},body:testerCredentials}],
  ['/api/login',{method:'POST',headers:{Origin:'https://explainback.app','Sec-Fetch-Site':'cross-site','Content-Type':'application/json'},body:testerCredentials}],
  ['/api/studio/compose',{method:'OPTIONS',headers:{Origin:'https://foreign.example'}}],
 ];
 for(const [path,options] of denied){const r=await call(path,options);assert.equal(r.status,403,JSON.stringify(options));assert.equal(r.headers['access-control-allow-origin'],undefined);}
 assert.equal(authReads,0,'foreign requests must not look up session storage');
 assert.equal(providerCalls,0);
 assert.equal((await call('/api/health')).status,200,'health monitoring needs no Origin');
 const signedIn=await call('/api/login',{method:'POST',headers:{Origin:'https://explainback.app','Sec-Fetch-Site':'same-origin','Content-Type':'application/json'},body:testerCredentials});
 assert.equal(signedIn.status,200);
 const cookie=signedIn.headers['set-cookie'][0].split(';')[0];
 const status=await call('/api/status',{headers:{Cookie:cookie,'Sec-Fetch-Site':'same-origin'}});
 assert.equal(status.status,200,'same-origin browser GET normally omits Origin');
 assert.equal(status.headers['access-control-allow-origin'],undefined);
 assert.equal((await call('/api/status',{headers:{'Sec-Fetch-Site':'same-origin'}})).status,401,'source headers never grant authentication');
 assert.equal(providerCalls,0);
});
