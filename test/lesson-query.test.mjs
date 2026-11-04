import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHandler} from '../src/server.mjs';
import {createMemoryState} from '../src/state.mjs';
import {buildSavedLesson} from '../src/lessons.mjs';
import {coolingLesson} from '../test-support/generated-lessons.mjs';
import {testerCredentials,testerCookie} from '../test-support/tester.mjs';

async function setup(t){
 const state=createMemoryState(),ids=[];
 for(let i=0;i<3;i++){
  const record={...buildSavedLesson({lesson:coolingLesson()},{owner:'creator',now:i}),shared:true};
  await state.putLesson(record);ids.unshift(record.id);
 }
 const app=createHandler({state,testerCredentials,imageStore:null});
 // Serverless helpers define an own query getter that shadows Express's parser.
 // Failing on access catches a return to that potentially legacy URL parser.
 const server=createServer((req,res)=>{
  Object.defineProperty(req,'query',{configurable:true,get(){throw new Error('Platform query helper accessed.');}});
  app(req,res);
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const get=(path,cookie)=>fetch(origin+path,{headers:cookie?{Cookie:cookie}:{}});
 return {origin,get,ids};
}

for(const [name,path,admin] of [['shared','/api/shared',false],['administrator','/api/lessons',true]]){
 test(`${name} pagination parses request URLs independently of serverless query helpers`,async t=>{
  const {origin,get,ids}=await setup(t),cookie=admin?await testerCookie(origin):undefined;
  for(const [query,want] of [['',ids],['?cursor=%31',ids.slice(1)],['?unrelated=value',ids]]){
   const response=await get(path+query,cookie);
   assert.equal(response.status,200,query);
   const body=await response.json();
   assert.deepEqual(body.lessons.map(lesson=>lesson.id),want);
   assert.equal(body.cursor,null);
  }
  for(const query of ['?cursor=','?cursor=-1','?cursor=1.5','?cursor=0&cursor=1','?cursor=0&%63ursor=0','?cursor=18446744073709551616']){
   assert.equal((await get(path+query,cookie)).status,400,query);
  }
 });
}
