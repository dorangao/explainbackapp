import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {testerCredentials} from '../test-support/tester.mjs';
import {createMemoryState} from '../src/state.mjs';
import {coverPrompt,coverLesson,coverTargets,publicCover,coverPromptVersion} from '../src/lesson-covers.mjs';
import {coverPrompt as scriptPrompt} from '../scripts/lesson-covers.mjs';
import {ILLUSTRATION_STYLE} from '../src/lesson-show.mjs';
import {fakeBlob} from './blob.test.mjs';

const codes={codes:[{code:'JUDGE-INVITE-1',label:'judges',quota:40,expiresAt:Date.now()+86400000,hash:'x'},{code:'OTHER-INVITE-2',label:'other',quota:40,expiresAt:Date.now()+86400000,hash:'y'}],warnings:[]};
const webp=seed=>{const b=Buffer.alloc(40);b.write('RIFF',0,'latin1');b.write('WEBP',8,'latin1');b[20]=seed;return `data:image/webp;base64,${b.toString('base64')}`;};
async function setup(t,extra={}){
 const server=createApp({testerCredentials,configured:true,accessCodes:codes,imageStore:null,...extra});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const codeCookie=async code=>{const r=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({code})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const post=(path,body,cookie)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),'Content-Type':'application/json'},body:JSON.stringify(body)});
 const get=(path,cookie)=>fetch(origin+path,{headers:cookie?{Cookie:cookie}:{}});
 return {origin,post,get,codeCookie};
}

test('the cover prompt is shared between the script and the app, and only reviewed lessons can be drawn',()=>{
 const lesson=coverLesson('cooling');
 assert.ok(lesson&&lesson.title.en);assert.equal(coverLesson('invented'),null);
 assert.ok(coverPrompt(lesson).startsWith(ILLUSTRATION_STYLE));assert.equal(scriptPrompt(lesson),coverPrompt(lesson));
 assert.deepEqual(coverTargets({ids:['cooling']}).map(i=>i.id),['cooling']);assert.throws(()=>coverTargets({ids:['invented']}),/Unknown lesson ids/);
 assert.deepEqual(publicCover({src:'https://x/a.webp',model:'m',createdAt:'2026-10-31',promptVersion:coverPromptVersion,owner:'code:judges'}),{src:'https://x/a.webp',model:'m',createdAt:'2026-10-31',promptVersion:coverPromptVersion});
});

test('memory state keeps creator-drawn covers by lesson id',async()=>{
 const state=createMemoryState();
 assert.deepEqual(await state.getCovers(),{});
 await state.putCover('cooling',{src:'https://x/a.webp',model:'m',createdAt:'2026-10-31',promptVersion:'cover-v1',owner:'code:judges'});
 const covers=await state.getCovers();assert.equal(covers.cooling.src,'https://x/a.webp');
 covers.cooling.src='changed';assert.equal((await state.getCovers()).cooling.src,'https://x/a.webp','copies, not references');
});

test('a signed-in creator draws a cover for a reviewed lesson; the library reads it without the owner; a redraw replaces the stored file',async t=>{
 const {store,puts,deleted}=fakeBlob();
 const prompts=[];
 const {post,get,codeCookie}=await setup(t,{imageStore:store,imageCall:async({prompt})=>{prompts.push(prompt);return {dataUrl:webp(prompts.length),model:'muse-image-1.0',usage:null};}});
 const judge=await codeCookie('JUDGE-INVITE-1');
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'},judge)).json();
 assert.equal((await post('/api/studio/cover',{sessionId:s.sessionId,lessonId:'invented'},judge)).status,400);
 assert.equal((await post('/api/studio/cover',{sessionId:s.sessionId,lessonId:'../etc'},judge)).status,400);
 assert.equal(prompts.length,0);
 const drawn=await(await post('/api/studio/cover',{sessionId:s.sessionId,lessonId:'cooling'},judge)).json();
 assert.equal(drawn.lessonId,'cooling');assert.match(drawn.cover,/^https:\/\/store\.public\.blob\.vercel-storage\.com\/images\/[a-f0-9]{24}\/r001\.webp$/);
 assert.equal(drawn.model,'muse-image-1.0');assert.equal(drawn.promptVersion,'cover-v1');assert.match(drawn.createdAt,/^\d{4}-\d{2}-\d{2}$/);assert.equal(drawn.attemptsRemaining,7);
 assert.equal(prompts[0],coverPrompt(coverLesson('cooling')));assert.equal(puts.length,1);
 // Public, like the gallery; the owner never leaves the server.
 const listed=await(await get('/api/covers')).json();
 assert.deepEqual(listed.covers.cooling,{src:drawn.cover,model:'muse-image-1.0',createdAt:drawn.createdAt,promptVersion:'cover-v1'});
 assert.ok(!JSON.stringify(listed).includes('judges'));
 // Another creator redraws it: the new file replaces the old one for everyone.
 const other=await codeCookie('OTHER-INVITE-2');
 const s2=await(await post('/api/studio/session',{synthetic:true,language:'en'},other)).json();
 const again=await(await post('/api/studio/cover',{sessionId:s2.sessionId,lessonId:'cooling'},other)).json();
 assert.match(again.cover,/r002\.webp$/);assert.deepEqual(deleted,[drawn.cover]);
 assert.equal((await(await get('/api/covers')).json()).covers.cooling.src,again.cover);
 // Signed out, nothing can be drawn.
 assert.equal((await post('/api/studio/cover',{sessionId:s.sessionId,lessonId:'cooling'})).status,401);
});

test('without an image model the cover route says so and spends nothing',async t=>{
 const {post,codeCookie}=await setup(t);
 const judge=await codeCookie('JUDGE-INVITE-1');
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en'},judge)).json();
 const r=await post('/api/studio/cover',{sessionId:s.sessionId,lessonId:'cooling'},judge);
 assert.equal(r.status,503);
 assert.equal((await(await post('/api/studio/session',{synthetic:true,language:'en'},judge)).json()).attemptsRemaining,8);
});
