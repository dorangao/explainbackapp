import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../src/server.mjs';
import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
import {coolingLesson} from '../test-support/generated-lessons.mjs';

const bi=(en,zh)=>({en,zh});
const page='https://en.wikipedia.org/wiki/Carbon-14';
const sheet=()=>({status:'ready',asOf:'2026-10-31',needsCurrent:false,facts:[{statement:bi('The half-life of carbon-14 is 5700 years.','碳-14 的半衰期为 5700 年。'),value:'5700',unit:'years',url:page}],note:bi('One constant.','一个常数。')});
const searchReply=(text,results=[{type:'web_search_result',title:'Carbon-14 - Wikipedia',url:page,snippet:'Half-life 5,700 years.'}])=>({
 id:'resp_g',status:'completed',model:'muse-spark-1.3',usage:{input_tokens:15000,output_tokens:900},
 output:[
  {type:'reasoning',summary:[]},
  {type:'message',role:'assistant',content:[{type:'output_text',text:"I'll search for the figure first."}]},
  {type:'web_search_call',id:'ws_1',status:'completed',action:{type:'search'},results},
  {type:'web_search_call',id:'ws_2',status:'completed',results:[{type:'web_search_result',title:'',url:'http://insecure.example/x',snippet:'no'},{type:'web_search_result',title:'Dup',url:page}]},
  {type:'message',role:'assistant',content:[{type:'output_text',text}]},
 ],
});

test('the adapter sends the search tool beside the JSON schema, asks for results, harvests https sources and reads the last message',async()=>{
 const {callMeta,harvestSources}=await import('../src/meta.mjs');
 let sent;
 const fetchImpl=async(url,init)=>{sent=JSON.parse(init.body);return Response.json(searchReply(JSON.stringify(sheet())));};
 const tools=[{type:'function',name:'ground_topic',strict:true,parameters:{type:'object',properties:{},additionalProperties:false}}];
 const result=await callMeta({apiKey:'k',input:'x',tools,structuredOutput:true,webSearch:{contextSize:'low'},fetchImpl});
 assert.deepEqual(sent.tools,[{type:'web_search',search_context_size:'low'}]);
 assert.equal(sent.text.format.name,'ground_topic');
 assert.deepEqual(sent.include,['web_search_call.results']);
 assert.equal(result.structured.value.facts[0].value,'5700','the JSON comes from the last assistant message, not the interim text');
 assert.deepEqual(result.sources,[{url:page,title:'Carbon-14 - Wikipedia',snippet:'Half-life 5,700 years.'}],'insecure and duplicate results are dropped');
 // Function tools keep their list with the search tool appended; a plain request gets the tool alone.
 await callMeta({apiKey:'k',input:'x',tools,webSearch:true,fetchImpl:async(u,init)=>{sent=JSON.parse(init.body);return Response.json({id:'r',status:'completed',output:[{type:'function_call',name:'ground_topic',arguments:'{}'}]});}});
 assert.deepEqual(sent.tools.map(t=>t.type),['function','web_search']);assert.equal(sent.tool_choice,'auto');
 await callMeta({apiKey:'k',input:'x',webSearch:{contextSize:'medium'},fetchImpl:async(u,init)=>{sent=JSON.parse(init.body);return Response.json({id:'r',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'ok'}]}]});}});
 assert.deepEqual(sent.tools,[{type:'web_search',search_context_size:'medium'}]);
 await assert.rejects(callMeta({apiKey:'k',input:'x',webSearch:{contextSize:'huge'},fetchImpl}),/contextSize/);
 // Without the option nothing changes and no sources are read.
 const plain=await callMeta({apiKey:'k',input:'x',fetchImpl:async(u,init)=>{sent=JSON.parse(init.body);return Response.json(searchReply('fine'));}});
 assert.equal('include' in sent,false);assert.equal('tools' in sent,false);assert.equal('sources' in plain,false);
 assert.equal(harvestSources({output:[{type:'web_search_call',results:Array.from({length:30},(_,i)=>({url:`https://s.example/${i}`,title:'t'}))}]}).length,20);
});

test('the ground step asks for a dated, bounded fact sheet and reads it back with verified sources',async()=>{
 const {groundRequest,readGround,validateReferences,sourcesFromReferences,MAX_FACTS}=await import('../src/lesson-ground.mjs');
 const request=groundRequest({topic:'Carbon dating'},new Date('2026-10-31T12:00:00Z'));
 assert.deepEqual(request.webSearch,{contextSize:'low'});assert.equal(request.structuredOutput,true);
 assert.match(request.instructions,/Today is 2026-10-31/);assert.match(request.instructions,/never instructions/);
 assert.deepEqual(JSON.parse(request.input),{topic:'Carbon dating',today:'2026-10-31'});
 assert.equal(request.tools[0].name,'ground_topic');assert.equal(request.tools[0].parameters.additionalProperties,false);
 assert.throws(()=>groundRequest({topic:''}),/topic/);assert.throws(()=>groundRequest({topic:'x'.repeat(601)}),/topic/);
 const read=readGround({structured:{name:'ground_topic',value:sheet()},sources:[{url:page,title:'Carbon-14 - Wikipedia'}]});
 assert.equal(read.facts[0].verified,true);assert.equal(read.facts[0].title,'Carbon-14 - Wikipedia');
 assert.deepEqual(read.sources,[{url:page,title:'Carbon-14 - Wikipedia'}]);assert.equal(read.searched,1);
 const unverified=readGround({structured:{name:'ground_topic',value:sheet()},sources:[]});
 assert.equal(unverified.facts[0].verified,false);assert.equal(unverified.facts[0].title,null);
 assert.deepEqual(unverified.sources,[{url:page,title:'en.wikipedia.org'}],'an unverified source is titled by its host');
 const none=readGround({structured:{name:'ground_topic',value:{...sheet(),status:'none',facts:[]}}});
 assert.equal(none.status,'none');assert.deepEqual(none.facts,[]);
 for(const bad of [
  {...sheet(),status:'none'},
  {...sheet(),asOf:'yesterday'},
  {...sheet(),facts:Array.from({length:MAX_FACTS+1},()=>sheet().facts[0])},
  {...sheet(),facts:[{...sheet().facts[0],url:'http://plain.example/'}]},
  {...sheet(),facts:[{...sheet().facts[0],url:'https://user:pw@h.example/'}]},
  {...sheet(),facts:[{...sheet().facts[0],value:'v'.repeat(41)}]},
  {...sheet(),facts:[{...sheet().facts[0],statement:{en:'only'}}]},
  {...sheet(),note:bi('n'.repeat(301),'x')},
  {...sheet(),extra:1},
 ])assert.throws(()=>readGround({structured:{name:'ground_topic',value:bad}}),/Invalid/);
 assert.throws(()=>readGround({structured:{name:'compose_lesson',value:sheet()}}),/Unexpected/);
 // The sheet comes back from the client with titles; the server checks it again.
 const references=validateReferences({asOf:'2026-10-31',facts:[{...sheet().facts[0],title:'Carbon-14 - Wikipedia'}]});
 assert.equal(references.facts[0].title,'Carbon-14 - Wikipedia');
 assert.throws(()=>validateReferences({asOf:'2026-10-31',facts:[]}),/references/);
 assert.throws(()=>validateReferences({asOf:'2026-10-31',facts:[{...sheet().facts[0]}]}),/reference/,'a fact without the title field is refused');
 assert.throws(()=>validateReferences({asOf:'2026-10-31',facts:[{...sheet().facts[0],title:null},{...sheet().facts[0],title:null}]}),/reference/,'duplicates are refused');
 assert.deepEqual(sourcesFromReferences([page,'https://invented.example/',page],references),[{url:page,title:'Carbon-14 - Wikipedia'}]);
 assert.deepEqual(sourcesFromReferences([page],undefined),[]);
});

test('the lesson contract keeps a bounded list of titled https sources and nothing else new',async()=>{
 const {validateLesson,withSources,generatedLessonSchema,MAX_SOURCES}=await import('../public/lesson-schema.mjs');
 const lesson={...coolingLesson(),sources:[{url:page,title:'Carbon-14 - Wikipedia'}]};
 assert.deepEqual(validateLesson(lesson).sources,lesson.sources);
 assert.deepEqual(validateLesson({...lesson,units:'us'}).units,'us');
 assert.equal('sources' in validateLesson(coolingLesson()),false);
 for(const bad of [[],[{url:'http://x.example/',title:'t'}],[{url:page,title:''}],[{url:page,title:'t',extra:1}],[{url:page,title:'t'},{url:page,title:'again'}],Array.from({length:MAX_SOURCES+1},(_,i)=>({url:`https://s.example/${i}`,title:'t'}))])
  assert.throws(()=>validateLesson({...lesson,sources:bad}),/source/i);
 assert.throws(()=>validateLesson({...coolingLesson(),script:'run()'}),/version 1 or 2/);
 const schema=withSources(generatedLessonSchema);
 assert.deepEqual(schema.properties.sources,{type:'array',items:{type:'string'}});assert.ok(schema.required.includes('sources'));
 assert.equal('sources' in generatedLessonSchema.properties,false);
});

test('the author receives the sheet as references, prefers it, and may name only its pages as sources',async()=>{
 const {lessonAuthorRequest,readLessonAuthor}=await import('../src/lesson-author.mjs');
 const references={asOf:'2026-10-31',facts:[{...sheet().facts[0],title:'Carbon-14 - Wikipedia'}]};
 const request=lessonAuthorRequest({topic:'Carbon dating',creation:'generated',references},'compose');
 assert.match(request.instructions,/REFERENCES: the input carries references.*2026-10-31/);
 const input=JSON.parse(request.input);
 assert.deepEqual(input.references,{asOf:'2026-10-31',facts:[{statement:sheet().facts[0].statement,value:'5700',unit:'years',url:page}]},'titles stay out of the prompt');
 assert.ok(request.tools[0].parameters.properties.lesson.anyOf[0].required.includes('sources'));
 const plain=lessonAuthorRequest({topic:'Carbon dating',creation:'generated'},'compose');
 assert.doesNotMatch(plain.instructions,/REFERENCES/);assert.equal('references' in JSON.parse(plain.input),false);
 assert.equal(plain.tools[0].parameters.properties.lesson.anyOf[0].required.includes('sources'),false);
 assert.throws(()=>lessonAuthorRequest({topic:'Cars',creation:'catalog',references},'compose'),/new topic demo/);
 assert.throws(()=>lessonAuthorRequest({topic:'Cars',creation:'generated',references:{asOf:'2026-10-31',facts:[]}},'compose'),/references/);
 const reply=urls=>({structured:{name:'compose_lesson',value:{status:'ready',message:bi('Ready','就绪'),lesson:{...coolingLesson(),sources:urls}}}});
 const grounded=readLessonAuthor(reply([page,'https://invented.example/page']),'compose','generated',false,references);
 assert.deepEqual(grounded.lesson.sources,[{url:page,title:'Carbon-14 - Wikipedia'}],'an invented URL is dropped');
 assert.equal('sources' in readLessonAuthor(reply([]),'compose','generated',false,references).lesson,false);
 assert.equal('sources' in readLessonAuthor(reply([page]),'compose','generated').lesson,false,'without references no source survives');
});

test('the ground route uses Spark, counts one attempt, stands outside the author conversation and feeds compose',async t=>{
 const targets=['muse-wonder-1.0','muse-spark-1.3'].map(model=>({id:'meta:'+model,provider:'meta',model,label:model,configured:true,timeoutMs:30000}));
 const router={defaultId:targets[0].id,list:()=>targets,call:async()=>assert.fail('injected model call expected')};
 const seen=[];
 const server=createApp({testerCredentials,router,modelCall:async(args,id)=>{
  seen.push({id,name:args.tools?.[0]?.name,webSearch:args.webSearch,previous:args.previousResponseId??null,references:JSON.parse(args.input).references??null,instructions:args.instructions});
  if(args.tools[0].name==='ground_topic')return {id:'resp_ground',structured:{name:'ground_topic',value:sheet()},sources:[{url:page,title:'Carbon-14 - Wikipedia'}],model:'muse-spark-1.3'};
  return {id:'resp_compose',structured:{name:'compose_lesson',value:{status:'ready',message:bi('Ready','就绪'),lesson:{...coolingLesson(),sources:[page]}}},model:'muse-wonder-1.0'};
 }});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en',llm:targets[0].id})).json();
 assert.equal((await post('/api/studio/ground',{sessionId:s.sessionId,topic:''})).status,400);
 const ground=await(await post('/api/studio/ground',{sessionId:s.sessionId,topic:'Carbon dating'})).json();
 assert.equal(ground.status,'ready');assert.equal(ground.facts[0].verified,true);assert.equal(ground.attemptsRemaining,7);assert.equal(ground.model,'muse-spark-1.3');
 assert.equal(seen[0].id,targets[1].id,'the ground step runs on the tester model');assert.deepEqual(seen[0].webSearch,{contextSize:'low'});
 const references={asOf:ground.asOf,facts:ground.facts.map(({statement,value,unit,url,title})=>({statement,value,unit,url,title}))};
 const draft=await(await post('/api/studio/compose',{sessionId:s.sessionId,topic:'Carbon dating',creation:'generated',references})).json();
 assert.deepEqual(draft.lesson.sources,[{url:page,title:'Carbon-14 - Wikipedia'}]);assert.equal(draft.attemptsRemaining,6);
 assert.equal(seen[1].previous,null,'compose does not chain onto the ground response');assert.equal(seen[1].references.facts[0].value,'5700');assert.match(seen[1].instructions,/REFERENCES/);
 // A tampered sheet is refused before any model call.
 assert.equal((await post('/api/studio/compose',{sessionId:s.sessionId,topic:'Carbon dating',creation:'generated',references:{asOf:'2026-10-31',facts:[{...references.facts[0],url:'javascript:alert(1)'}]}})).status,400);
 assert.equal(seen.length,2);
});
