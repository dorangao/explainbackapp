import test from 'node:test';import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';import {testerCredentials} from '../test-support/tester.mjs';
import {coolingLesson,processLesson} from '../test-support/generated-lessons.mjs';
import {buildSavedLesson,validateShowScript,lessonKind} from '../src/lessons.mjs';
import {createRedisServices} from '../src/redis-state.mjs';
import {fakeBlob} from './blob.test.mjs';
const bi=(en,zh)=>({en,zh});
const show=()=>({version:1,slides:[{kind:'cover',chapter:0,heading:bi('Hook','开场'),narration:bi('Why does coffee cool?','咖啡为什么会凉？')},{kind:'claim',chapter:0,heading:bi('Claim','观点'),narration:bi('Is it linear?','是线性的吗？')},{kind:'experiment',chapter:0,heading:bi('Watch','观察'),narration:bi('Sweep the settings.','调整设置。')},{kind:'takeaway',chapter:0,heading:bi('Takeaway','要点'),narration:bi('The gap drives the rate.','温差决定速率。')}],coverPrompt:'A cup of coffee by a window'});
const codes={codes:[{code:'JUDGE-INVITE-1',label:'judges',quota:40,expiresAt:Date.now()+86400000,hash:'x'},{code:'OTHER-INVITE-2',label:'other',quota:40,expiresAt:Date.now()+86400000,hash:'y'}],warnings:[]};
async function setup(t,extra={}){
 const server=createApp({testerCredentials,configured:true,accessCodes:codes,imageStore:null,...extra});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
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

const webpBytes=()=>{const b=Buffer.alloc(40);b.write('RIFF',0,'latin1');b.write('WEBP',8,'latin1');return b;};
const image=(seed=1)=>{const b=webpBytes();b[20]=seed;return `data:image/webp;base64,${b.toString('base64')}`;};
test('with Blob storage a saved lesson keeps its cover, illustrations and sketch as URLs; replaced and deleted images are removed',async t=>{
 const {store,puts,deleted}=fakeBlob();
 const {post,get,codeCookie}=await setup(t,{imageStore:store});
 const judge=await codeCookie('JUDGE-INVITE-1'),other=await codeCookie('OTHER-INVITE-2');
 const saved=await(await post('/api/lessons',{lesson:coolingLesson(),show:show(),model:'muse-wonder-1.0',cover:image(1),coverModel:'muse-image-1.0',illustrations:{1:image(2)},sketch:image(3)},judge)).json();
 assert.match(saved.cover,/^https:\/\/store\.public\.blob\.vercel-storage\.com\/images\/[a-f0-9]{24}\/r001\.webp$/);
 assert.match(saved.sketch,/r002\.webp$/);assert.equal(puts.length,3);assert.equal(puts[0].options.contentType,'image/webp');
 const full=await(await get('/api/lessons/'+saved.id,judge)).json();
 assert.equal(full.coverModel,'muse-image-1.0');assert.match(full.illustrations['1'],/r003\.webp$/);assert.equal(full.cover,saved.cover);
 // The record never holds bytes; the list and the public reader carry the URLs.
 assert.ok(!JSON.stringify(full).includes(image(1).slice(30,60)));
 await post('/api/lessons/share',{id:saved.id,shared:true},judge);
 const open=await(await get('/api/shared/'+saved.id)).json();assert.equal(open.cover,saved.cover);assert.equal(open.illustrations['1'],full.illustrations['1']);
 assert.equal((await(await get('/api/shared')).json()).lessons[0].cover,saved.cover);
 // Re-saving with the same URLs uploads nothing; a new cover replaces the old blob.
 const same=await(await post('/api/lessons',{id:saved.id,lesson:coolingLesson(),show:show(),cover:saved.cover,coverModel:'muse-image-1.0',illustrations:full.illustrations,sketch:saved.sketch},judge)).json();
 assert.equal(same.cover,saved.cover);assert.equal(puts.length,3);assert.deepEqual(deleted,[]);
 const redrawn=await(await post('/api/lessons',{id:saved.id,lesson:coolingLesson(),show:show(),cover:image(4),coverModel:'muse-image-1.0',sketch:saved.sketch},judge)).json();
 assert.match(redrawn.cover,/r004\.webp$/);assert.deepEqual(deleted.sort(),[saved.cover,full.illustrations['1']].sort());
 // A URL under another creator's prefix, or off our host, is refused.
 const theirs=await(await post('/api/lessons',{lesson:coolingLesson(),sketch:image(5)},other)).json();
 assert.equal((await post('/api/lessons',{id:saved.id,lesson:coolingLesson(),sketch:theirs.sketch},judge)).status,400);
 assert.equal((await post('/api/lessons',{id:saved.id,lesson:coolingLesson(),sketch:'https://example.com/x.webp'},judge)).status,400);
 assert.equal((await post('/api/lessons',{id:saved.id,lesson:coolingLesson(),show:show(),illustrations:{7:image(6)}},judge)).status,400);
 assert.equal((await post('/api/lessons',{id:saved.id,lesson:coolingLesson(),show:show(),cover:'data:image/webp;base64,QUJD'},judge)).status,400);
 // A cover without a show is dropped; deleting removes every stored image.
 const noShow=await(await post('/api/lessons',{id:saved.id,lesson:coolingLesson(),cover:redrawn.cover,sketch:saved.sketch},judge)).json();
 assert.equal(noShow.cover,null);assert.ok(deleted.includes(redrawn.cover));
 deleted.length=0;await post('/api/lessons/delete',{id:saved.id},judge);assert.deepEqual(deleted,[saved.sketch]);
});
test('without Blob storage images are dropped on save and the status says so',async t=>{
 const {post,get,codeCookie}=await setup(t);const judge=await codeCookie('JUDGE-INVITE-1');
 const saved=await(await post('/api/lessons',{lesson:coolingLesson(),show:show(),cover:image(1),coverModel:'muse-image-1.0',illustrations:{1:image(2)},sketch:image(3)},judge)).json();
 assert.equal(saved.cover,null);assert.equal(saved.sketch,null);
 const full=await(await get('/api/lessons/'+saved.id,judge)).json();assert.deepEqual(full.illustrations,{});assert.equal(full.coverModel,null);
 const status=await(await get('/api/status',judge)).json();assert.equal(status.imageStorage,false);assert.equal(status.images,false);
});
test('a slide illustration is drawn from the checked script, stored under the creator and counted as a request',async t=>{
 const {store,puts}=fakeBlob();const prompts=[];
 const {post,codeCookie}=await setup(t,{imageStore:store,modelCall:async args=>{
  const name=args.tools[0].name;
  if(name==='compose_lesson')return {toolCall:{name,arguments:JSON.stringify({status:'ready',message:bi('Ready','好'),lesson:coolingLesson()})}};
  return {structured:{name:'make_show',value:show()}};
 },imageCall:async args=>{prompts.push(args.prompt);return {dataUrl:image(prompts.length),model:'muse-image-1.0',usage:null};}});
 const judge=await codeCookie('JUDGE-INVITE-1');
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'},judge)).json();
 const made=await(await post('/api/studio/compose',{sessionId:s.sessionId,topic:'Cooling coffee'},judge)).json();
 const shown=await(await post('/api/studio/show',{sessionId:s.sessionId,lesson:made.lesson},judge)).json();
 assert.match(shown.cover,/r001\.webp$/);assert.equal(prompts[0],'A cup of coffee by a window');
 assert.equal((await post('/api/studio/illustrate',{sessionId:s.sessionId,lesson:made.lesson,show:shown.show,slide:9},judge)).status,400);
 assert.equal((await post('/api/studio/illustrate',{sessionId:s.sessionId,lesson:made.lesson,show:shown.show,slide:1,direction:'<script>'},judge)).status,400);
 const drawn=await(await post('/api/studio/illustrate',{sessionId:s.sessionId,lesson:made.lesson,show:shown.show,slide:1,direction:'warm morning light'},judge)).json();
 assert.match(drawn.image,/r002\.webp$/);assert.equal(drawn.slide,1);assert.equal(drawn.model,'muse-image-1.0');assert.equal(drawn.attemptsRemaining,5);
 assert.match(prompts[1],/^A calm, flat, editorial illustration.*Scene: Claim\. Is it linear\? Setting: A cup of coffee by a window Creator note: warm morning light$/);
 const cover=await(await post('/api/studio/illustrate',{sessionId:s.sessionId,lesson:made.lesson,show:shown.show},judge)).json();
 assert.equal(cover.slide,null);assert.equal(prompts[2],'A cup of coffee by a window');assert.equal(puts.length,3);
 // The stored URLs are accepted on save without a second upload.
 const saved=await(await post('/api/lessons',{lesson:made.lesson,show:shown.show,cover:cover.image,coverModel:cover.model,illustrations:{1:drawn.image}},judge)).json();
 assert.equal(saved.cover,cover.image);assert.equal(puts.length,3);
});
test('illustrations need the image model',async t=>{
 const {post,codeCookie}=await setup(t,{imageCall:null,modelCall:async args=>({toolCall:{name:args.tools[0].name,arguments:JSON.stringify({status:'ready',message:bi('Ready','好'),lesson:coolingLesson()})}})});
 const judge=await codeCookie('JUDGE-INVITE-1');
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'},judge)).json();
 assert.equal((await post('/api/studio/illustrate',{sessionId:s.sessionId,lesson:coolingLesson(),show:show(),slide:1},judge)).status,503);
});
test('SAM 3.1 finds the named object in an attached image and returns pixel boxes',async t=>{
 const calls=[];
 const {post,get,codeCookie}=await setup(t,{modelCall:async args=>({toolCall:{name:args.tools[0].name,arguments:JSON.stringify({status:'ready',message:bi('Ready','好'),lesson:coolingLesson()})}}),
  segmentCall:async args=>{calls.push(args.concept);if(args.concept==='unicorn')return {boxes:[],width:0,height:0,model:'sam-3.1',usage:null};return {boxes:[{x1:10,y1:20,x2:110,y2:220,confidence:0.9}],width:640,height:480,model:'sam-3.1',usage:null};}});
 const judge=await codeCookie('JUDGE-INVITE-1');
 assert.equal((await(await get('/api/status',judge)).json()).detect,true);
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'},judge)).json();
 assert.equal((await post('/api/studio/detect',{sessionId:s.sessionId,image:image(1),concept:'segment the cup?'},judge)).status,400);
 assert.equal((await post('/api/studio/detect',{sessionId:s.sessionId,image:'https://example.com/a.png',concept:'cup'},judge)).status,400);
 const found=await(await post('/api/studio/detect',{sessionId:s.sessionId,image:image(1),concept:' coffee cup '},judge)).json();
 assert.deepEqual(found.boxes,[{x1:10,y1:20,x2:110,y2:220,confidence:0.9}]);assert.equal(found.width,640);assert.equal(found.concept,'coffee cup');assert.equal(found.attemptsRemaining,7);
 const none=await(await post('/api/studio/detect',{sessionId:s.sessionId,image:image(1),concept:'unicorn'},judge)).json();
 assert.deepEqual(none.boxes,[]);assert.equal(none.attemptsRemaining,6);assert.deepEqual(calls,['coffee cup','unicorn']);
});
test('detection needs the segmentation model',async t=>{
 const {post,get,codeCookie}=await setup(t,{segmentCall:null,modelCall:async()=>{throw new Error('unused');}});
 const judge=await codeCookie('JUDGE-INVITE-1');assert.equal((await(await get('/api/status',judge)).json()).detect,false);
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'},judge)).json();
 assert.equal((await post('/api/studio/detect',{sessionId:s.sessionId,image:image(1),concept:'cup'},judge)).status,503);
});
