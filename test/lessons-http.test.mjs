import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';import {testerCredentials} from '../test-support/tester.mjs';
import {coolingLesson,processLesson} from '../test-support/generated-lessons.mjs';
import {buildSavedLesson,validateShowScript,lessonKind} from '../src/lessons.mjs';
import {createRedisServices} from '../src/redis-state.mjs';
const bi=(en,zh)=>({en,zh});
const show=()=>({version:1,slides:[{kind:'cover',chapter:0,heading:bi('Hook','开场'),narration:bi('Why does coffee cool?','咖啡为什么会凉？')},{kind:'claim',chapter:0,heading:bi('Claim','观点'),narration:bi('Is it linear?','是线性的吗？')},{kind:'experiment',chapter:0,heading:bi('Watch','观察'),narration:bi('Sweep the settings.','调整设置。')},{kind:'takeaway',chapter:0,heading:bi('Takeaway','要点'),narration:bi('The gap drives the rate.','温差决定速率。')}],coverPrompt:'A cup of coffee by a window'});
const codes={codes:[{code:'JUDGE-INVITE-1',label:'judges',quota:40,expiresAt:Date.now()+86400000,hash:'x'},{code:'OTHER-INVITE-2',label:'other',quota:40,expiresAt:Date.now()+86400000,hash:'y'}],warnings:[]};
async function setup(t){
 const server=createApp({testerCredentials,configured:true,accessCodes:codes});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const codeCookie=async code=>{const r=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const post=(path,body,cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});
 const get=(path,cookie)=>fetch(origin+path,{headers:cookie?{Cookie:cookie}:{}});
 return {origin,post,get,codeCookie};
}
test('a reviewer saves, lists, updates, shares and deletes lessons; another invite cannot see them',async t=>{
 const {post,get,codeCookie}=await setup(t);
 const judge=await codeCookie('JUDGE-INVITE-1'),other=await codeCookie('OTHER-INVITE-2');
 assert.equal((await post('/api/lessons',{lesson:coolingLesson()})).status,401);
 assert.equal((await post('/api/lessons',{lesson:{version:9}},judge)).status,400);
 assert.equal((await post('/api/lessons',{lesson:coolingLesson(),show:{version:1,slides:[]}},judge)).status,400);
 const saved=await(await post('/api/lessons',{lesson:coolingLesson(),show:show(),model:'muse-wonder-1.0'},judge)).json();
 assert.match(saved.id,/^[a-f0-9]{16}$/);assert.equal(saved.kind,'model');assert.equal(saved.hasShow,true);assert.equal(saved.shared,false);assert.equal(saved.title.en,'Cooling coffee');
 assert.equal(saved.owner,undefined);
 const mine=await(await get('/api/lessons',judge)).json();assert.equal(mine.lessons.length,1);assert.equal(mine.lessons[0].id,saved.id);assert.equal(mine.limit,50);
 assert.equal((await(await get('/api/lessons',other)).json()).lessons.length,0);
 assert.equal((await get('/api/lessons/'+saved.id,other)).status,404);
 const full=await(await get('/api/lessons/'+saved.id,judge)).json();assert.equal(full.lesson.chapters[0].demo.kind,'model');assert.equal(full.show.slides.length,4);
 // Not shared yet: the public route hides it.
 assert.equal((await get('/api/shared/'+saved.id)).status,404);
 assert.deepEqual((await(await get('/api/shared')).json()).lessons,[]);
 // Updating keeps the id; the other invite cannot update or share it.
 const edited=coolingLesson();edited.title=bi('Cooling coffee, revised','咖啡冷却（修订）');
 const updated=await(await post('/api/lessons',{id:saved.id,lesson:edited},judge)).json();assert.equal(updated.id,saved.id);assert.equal(updated.title.en,'Cooling coffee, revised');assert.equal(updated.hasShow,false);
 assert.equal((await post('/api/lessons',{id:saved.id,lesson:edited},other)).status,404);
 assert.equal((await post('/api/lessons/share',{id:saved.id,shared:true},other)).status,404);
 assert.equal((await post('/api/lessons/share',{id:saved.id,shared:'yes'},judge)).status,400);
 const shared=await(await post('/api/lessons/share',{id:saved.id,shared:true},judge)).json();assert.equal(shared.shared,true);
 const open=await(await get('/api/shared/'+saved.id)).json();assert.equal(open.title.en,'Cooling coffee, revised');assert.equal(open.lesson.version,2);assert.equal(open.owner,undefined);
 const listed=await(await get('/api/shared')).json();assert.equal(listed.lessons.length,1);assert.equal(listed.lessons[0].id,saved.id);assert.equal(listed.lessons[0].lesson,undefined);
 // Unsharing hides it again; deleting removes it for everyone.
 await post('/api/lessons/share',{id:saved.id,shared:false},judge);assert.equal((await get('/api/shared/'+saved.id)).status,404);
 assert.equal((await post('/api/lessons/delete',{id:saved.id},other)).status,404);
 assert.equal((await(await post('/api/lessons/delete',{id:saved.id},judge)).json()).deleted,true);
 assert.equal((await get('/api/lessons/'+saved.id,judge)).status,404);
 assert.equal((await(await get('/api/lessons',judge)).json()).lessons.length,0);
});
test('saved lessons are capped per creator and malformed ids are rejected',async t=>{
 const {post,get,codeCookie}=await setup(t);const judge=await codeCookie('JUDGE-INVITE-1');
 for(let i=0;i<50;i++)assert.equal((await post('/api/lessons',{lesson:i%2?coolingLesson():processLesson()},judge)).status,200);
 const full=await post('/api/lessons',{lesson:coolingLesson()},judge);assert.equal(full.status,409);assert.match((await full.json()).error,/up to 50/);
 const mine=await(await get('/api/lessons',judge)).json();assert.equal(mine.lessons.length,50);assert.equal(mine.lessons.filter(l=>l.kind==='process').length,25);
 assert.equal((await get('/api/shared/not-an-id')).status,404);
 assert.equal((await get('/api/lessons/not-an-id',judge)).status,404);
 assert.equal((await post('/api/lessons/delete',{id:'zz'},judge)).status,404);
});
test('record building and show validation',()=>{
 const record=buildSavedLesson({lesson:processLesson(),model:'muse-wonder-1.0'},{owner:'code:judges',now:5});
 assert.equal(record.kind,'process');assert.equal(record.createdAt,5);assert.equal(record.shared,false);assert.equal(record.show,null);
 const again=buildSavedLesson({lesson:processLesson(),show:null},{owner:'code:judges',now:9,previous:{...record,shared:true}});
 assert.equal(again.id,record.id);assert.equal(again.createdAt,5);assert.equal(again.updatedAt,9);assert.equal(again.shared,true);
 assert.equal(lessonKind({version:1,chapters:[]}),'catalog');
 assert.throws(()=>validateShowScript({version:1,slides:show().slides.slice(1),coverPrompt:'x'},coolingLesson()),/order|script/);
 assert.throws(()=>validateShowScript({...show(),slides:show().slides.map(s=>({...s,chapter:3}))},coolingLesson()),/slide/);
 assert.equal(validateShowScript(undefined,coolingLesson()),null);
});
// The Redis adapter runs its lesson scripts against a small in-memory Redis.
function fakeRedis(){
 const strings=new Map(),zsets=new Map();
 const z=k=>{if(!zsets.has(k))zsets.set(k,new Map());return zsets.get(k);};
 const call=(name,...args)=>{
  switch(name){
   case 'GET':return strings.get(args[0])??false;
   case 'SET':strings.set(args[0],String(args[1]));return 'OK';
   case 'DEL':{let n=0;for(const k of args)if(strings.delete(k))n++;return n;}
   case 'EXISTS':return strings.has(args[0])?1:0;
   case 'ZADD':z(args[0]).set(String(args[2]),Number(args[1]));return 1;
   case 'ZREM':return z(args[0]).delete(String(args[1]))?1:0;
   case 'ZCARD':return z(args[0]).size;
   case 'ZREVRANGE':{const start=Number(args[1]),stop=Number(args[2]);const rows=[...z(args[0]).entries()].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?1:-1)).map(e=>e[0]);return rows.slice(start,stop<0?undefined:stop+1);}
   case 'MGET':return args.map(k=>strings.get(k)??null);
   default:throw new Error('unsupported '+name);
  }
 };
 return async command=>{
  if(command[0]!=='EVAL')return call(...command);
  const [,script,n,...rest]=command;const KEYS=rest.slice(0,n),ARGV=rest.slice(n).map(String);
  // Interpret the handful of lesson scripts by shape rather than running Lua.
  if(script.includes("ZREVRANGE"))return call('ZREVRANGE',KEYS[0],0,ARGV[0]!==undefined?Number(ARGV[0])-1:99);
  if(script.includes("redis.call('DEL',KEYS[1]);redis.call('ZREM',KEYS[2]")){const v=call('GET',KEYS[0]);if(!v||JSON.parse(v).owner!==ARGV[0])return 0;call('DEL',KEYS[0]);call('ZREM',KEYS[1],ARGV[1]);call('ZREM',KEYS[2],ARGV[1]);return 1;}
  if(script.includes("local existing=redis.call('GET',KEYS[1])")){const v=call('GET',KEYS[0]);if(v){if(JSON.parse(v).owner!==ARGV[0])return 0;}else if(call('ZCARD',KEYS[1])>=Number(ARGV[2]))return 0;call('SET',KEYS[0],ARGV[1]);call('ZADD',KEYS[1],ARGV[3],ARGV[4]);if(ARGV[5]==='1')call('ZADD',KEYS[2],ARGV[3],ARGV[4]);else call('ZREM',KEYS[2],ARGV[4]);return 1;}
  if(script.trim()==="return redis.call('GET',KEYS[1])")return call('GET',KEYS[0]);
  throw new Error('unexpected script');
 };
}
test('redis adapter keeps per-owner and shared indexes consistent',async()=>{
 const {state}=createRedisServices({command:fakeRedis(),username:'u',password:'password-long-enough'});
 const a=buildSavedLesson({lesson:coolingLesson()},{owner:'code:judges',now:1}),b=buildSavedLesson({lesson:processLesson()},{owner:'code:judges',now:2});
 assert.equal(await state.putLesson(a,50),true);assert.equal(await state.putLesson(b,50),true);
 assert.deepEqual((await state.listLessons('code:judges')).map(r=>r.id),[b.id,a.id]);
 assert.deepEqual(await state.listLessons('code:other'),[]);
 assert.equal(await state.putLesson({...a,owner:'code:other'},50),false);
 assert.equal(await state.putLesson({...a,shared:true,updatedAt:3},50),true);
 assert.deepEqual((await state.listSharedLessons()).map(r=>r.id),[a.id]);
 assert.equal((await state.getLesson(a.id)).shared,true);
 assert.equal(await state.putLesson({...a,shared:false,updatedAt:4},50),true);
 assert.deepEqual(await state.listSharedLessons(),[]);
 assert.equal(await state.putLesson(buildSavedLesson({lesson:coolingLesson()},{owner:'code:judges',now:5}),2),false);
 assert.equal(await state.deleteLesson('code:other',a.id),false);
 assert.equal(await state.deleteLesson('code:judges',a.id),true);
 assert.deepEqual((await state.listLessons('code:judges')).map(r=>r.id),[b.id]);
 assert.equal(await state.getLesson(a.id),null);
});
