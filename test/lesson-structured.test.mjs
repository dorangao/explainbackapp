import test from 'node:test';
import assert from 'node:assert/strict';
import {callMeta} from '../src/meta.mjs';
import {lessonAuthorRequest,readLessonAuthor} from '../src/lesson-author.mjs';
import {processLesson,tinyPng} from '../test-support/generated-lessons.mjs';
const ready={status:'ready',message:{en:'Ready',zh:'已就绪'},lesson:processLesson()};
const response=text=>({status:'completed',model:'muse-spark-1.3',output:[{type:'message',role:'assistant',content:[{type:'output_text',text}]}]});
test('Meta lesson creation uses constrained JSON and preserves the validated lesson contract',async()=>{
 const options=lessonAuthorRequest({topic:'How a browser loads a page',creation:'generated'},'compose');
 assert.equal(options.structuredOutput,true);
 const traces=[];
 const result=await callMeta({...options,apiKey:'private-fixture',onTrace:e=>traces.push(e),fetchImpl:async(_url,{body})=>{
  const request=JSON.parse(body);assert.equal(request.tools,undefined);assert.equal(request.tool_choice,undefined);
  assert.equal(request.text.format.type,'json_schema');assert.equal(request.text.format.name,'compose_lesson');
  assert.equal(request.text.format.strict,true);assert.deepEqual(request.text.format.schema,options.tools[0].parameters);
  return Response.json(response(JSON.stringify(ready)));
 }});
 assert.equal(result.toolCall,undefined);assert.deepEqual(readLessonAuthor(result,'compose','generated'),ready);
 assert.doesNotMatch(JSON.stringify(traces),/private-fixture/);
});
test('structured transport never repairs malformed or string-encoded lessons',async()=>{
 const options=lessonAuthorRequest({topic:'Web requests',creation:'generated'},'compose');
 for(const data of [{...ready,lesson:JSON.stringify(ready.lesson)},{...ready,lesson:{...ready.lesson,code:'execute()'}}]){
  const result=await callMeta({...options,apiKey:'fixture',fetchImpl:async()=>Response.json(response(JSON.stringify(data)))});
  assert.throws(()=>readLessonAuthor(result,'compose','generated'));
 }
 await assert.rejects(callMeta({...options,apiKey:'fixture',fetchImpl:async()=>Response.json(response('broken fixture JSON'))}),/structured JSON/);
});
test('structured unsupported replies and existing tool-based providers keep their contracts',()=>{
 const unsupported={status:'unsupported',message:{en:'Unsupported',zh:'不支持'},lesson:null};
 assert.deepEqual(readLessonAuthor({structured:{name:'compose_lesson',value:unsupported}},'compose'),unsupported);
 assert.deepEqual(readLessonAuthor({toolCall:{name:'compose_lesson',arguments:JSON.stringify(ready)}},'compose','generated'),ready);
 assert.equal(lessonAuthorRequest({topic:'Car acceleration'},'compose').structuredOutput,true);
});
test('an attached image becomes one Responses user message with text and image parts, and traces omit the bytes',async()=>{
 const options=lessonAuthorRequest({topic:'',creation:'generated',image:tinyPng},'compose');
 assert.deepEqual(options.images,[tinyPng]);assert.match(options.instructions,/^An image is attached/);assert.match(options.input,/"imageAttached":true/);assert.match(options.input,/attached image/);
 const traces=[];let sent;
 const result=await callMeta({...options,apiKey:'fixture',onTrace:e=>traces.push(e),fetchImpl:async(_url,{body})=>{sent=JSON.parse(body);return Response.json(response(JSON.stringify(ready)));}});
 assert.equal(sent.input.length,1);assert.equal(sent.input[0].role,'user');assert.deepEqual(sent.input[0].content.map(c=>c.type),['input_text','input_image']);assert.equal(sent.input[0].content[1].image_url,tinyPng);
 assert.doesNotMatch(JSON.stringify(traces),/iVBORw0KGgo/);assert.match(JSON.stringify(traces),/image omitted/);
 assert.deepEqual(readLessonAuthor(result,'compose','generated'),ready);
 for(const image of ['data:text/plain;base64,QQ==','data:image/png;base64,not base64!!','x'.repeat(10),'data:image/svg+xml;base64,QQ=='])assert.throws(()=>lessonAuthorRequest({topic:'t',creation:'generated',image},'compose'),/Invalid image/);
 assert.throws(()=>lessonAuthorRequest({topic:'t',creation:'generated',image:'data:image/png;base64,'+'A'.repeat(1_200_001)},'compose'),/Invalid image/);
 const catalog=lessonAuthorRequest({topic:'What is in this sketch?',creation:'catalog',image:tinyPng},'compose');assert.deepEqual(catalog.images,[tinyPng]);
 assert.equal(lessonAuthorRequest({topic:'plain',creation:'generated'},'compose').images,undefined);
});
