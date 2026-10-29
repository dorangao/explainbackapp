import test from 'node:test';import assert from 'node:assert/strict';
import {showRequest,readShow,slideKinds} from '../src/lesson-show.mjs';
import {generateMetaImage} from '../src/meta.mjs';
import {coolingLesson,processLesson} from '../test-support/generated-lessons.mjs';
const bi=(en,zh=en+'（中文）')=>({en,zh});
const slide=(kind,chapter=0)=>({kind,chapter,heading:bi(kind+' heading'),narration:bi('Spoken '+kind+' line.')});
const good=()=>[slide('cover'),slide('claim'),slide('experiment'),slide('evidence'),slide('transfer'),slide('takeaway')];
const reply=(slides,coverPrompt='A warm mug on a table')=>({structured:{name:'make_show',value:{slides,coverPrompt}}});
test('the show request sends only lesson text, labels and questions and asks for both languages',()=>{
 const r=showRequest({lesson:coolingLesson()});
 assert.equal(r.structuredOutput,true);assert.equal(r.tools[0].name,'make_show');assert.match(r.instructions,/Simplified Chinese/);
 assert.doesNotMatch(r.input,/expression/);assert.doesNotMatch(r.input,/"values"/);assert.match(r.input,/Room temperature/);
 assert.throws(()=>showRequest({lesson:{version:3}}));
});
test('a valid script is normalised and bad order, kinds or lengths are rejected',()=>{
 const lesson=coolingLesson(),show=readShow(reply(good()),lesson);
 assert.equal(show.slides.length,6);assert.equal(show.slides[0].kind,'cover');assert.equal(show.slides.at(-1).kind,'takeaway');assert.equal(show.coverPrompt,'A warm mug on a table');
 assert.throws(()=>readShow(reply(good().slice(1)),lesson),/Invalid show order/);
 assert.throws(()=>readShow(reply([slide('cover'),slide('claim'),slide('evidence'),slide('takeaway')]),lesson),/Invalid show order/);
 assert.throws(()=>readShow(reply([...good(),slide('cover')]),lesson),/Invalid show order/);
 assert.throws(()=>readShow(reply([slide('cover'),slide('claim',3),slide('experiment'),slide('takeaway')]),lesson),/Invalid slide/);
 assert.throws(()=>readShow(reply([slide('cover'),{...slide('claim'),narration:bi('x'.repeat(361))},slide('experiment'),slide('takeaway')]),lesson),/Invalid slide/);
 assert.throws(()=>readShow(reply(good(),''),lesson),/Invalid show/);
 assert.throws(()=>readShow({toolCall:{name:'compose_lesson',arguments:'{}'}},lesson),/Unexpected show tool/);
 assert.deepEqual(slideKinds,['cover','claim','experiment','evidence','transfer','takeaway']);
 assert.equal(readShow(reply(good()),processLesson()).slides[2].kind,'experiment');
});
test('image generation posts the documented body and returns a data URL without logging bytes',async()=>{
 const calls=[],events=[];
 const fetchImpl=async(url,init)=>{calls.push({url,body:JSON.parse(init.body),auth:init.headers.Authorization});return {ok:true,status:200,json:async()=>({created:1,data:[{b64_json:'AAAA'}],output_format:'webp',usage:{input_tokens:10,output_tokens:5}})};};
 const image=await generateMetaImage({apiKey:'k',prompt:'A mug',fetchImpl,onTrace:e=>events.push(e)});
 assert.equal(image.dataUrl,'data:image/webp;base64,AAAA');assert.equal(image.model,'muse-image-1.0');
 assert.equal(calls[0].url,'https://api.meta.ai/v1/images/generations');assert.equal(calls[0].auth,'Bearer k');
 assert.deepEqual(calls[0].body,{model:'muse-image-1.0',prompt:'A mug',n:1,size:'1536x1024',response_format:'b64_json',output_format:'webp'});
 assert.ok(!JSON.stringify(events).includes('AAAA'));assert.equal(events.at(-1).body.bytes,3);
 await assert.rejects(()=>generateMetaImage({apiKey:'k',prompt:'A mug',fetchImpl:async()=>({ok:false,status:429})}),/status 429/);
 await assert.rejects(()=>generateMetaImage({apiKey:'k',prompt:'A mug',fetchImpl:async()=>({ok:true,status:200,json:async()=>({data:[]})})}),/no image/);
 await assert.rejects(()=>generateMetaImage({apiKey:'',prompt:'A mug',fetchImpl}),/MODEL_API_KEY/);
});
