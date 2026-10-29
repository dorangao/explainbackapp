import {test} from 'node:test';import assert from 'node:assert/strict';
import {callOllama} from '../src/llm/ollama.mjs';
const tool={type:'function',name:'ask_clarification',description:'Clarify',strict:true,parameters:{type:'object',properties:{question:{type:'string'}},required:['question'],additionalProperties:false}};
const ok={model:'local:test',done:true,done_reason:'stop',message:{role:'assistant',content:'',thinking:'PRIVATE THOUGHT',tool_calls:[{function:{name:'ask_clarification',arguments:{question:'Which end?'}}}]},prompt_eval_count:10,eval_count:8,total_duration:2e9,load_duration:1e9};
test('Ollama preserves native tools and trusted/system separation, normalizing safe output',async()=>{
 let sent;const events=[];const r=await callOllama({baseUrl:'http://localhost:11434',model:'local:test',input:'synthetic',instructions:'trusted',tools:[tool],onTrace:e=>events.push(e),fetchImpl:async(url,options)=>{sent={url,options,body:JSON.parse(options.body)};return Response.json(ok);}});
 assert.equal(sent.url,'http://localhost:11434/api/chat');assert.equal(sent.options.headers.Authorization,undefined);
 assert.deepEqual(sent.body.messages,[{role:'system',content:'trusted'},{role:'user',content:'synthetic'}]);assert.equal(sent.body.stream,false);assert.equal(sent.body.think,false);assert.equal(sent.body.options.num_ctx,16384);
 assert.equal(sent.body.tools[0].function.name,tool.name);assert.equal(r.provider,'ollama');assert.equal(r.toolCall.name,tool.name);assert.deepEqual(JSON.parse(r.toolCall.arguments),{question:'Which end?'});
 assert.equal(r.usage.input_tokens,10);assert.equal(r.timings.loadMs,1000);assert.doesNotMatch(JSON.stringify(events),/PRIVATE THOUGHT|thinking/);
});
test('Ollama rejects incomplete, multiple, unallowed or malformed actions without repair',async()=>{
 for(const patch of [{done:false},{done_reason:'length'},{message:{role:'assistant',content:'text only'}},{message:{role:'assistant',tool_calls:[...ok.message.tool_calls,...ok.message.tool_calls]}},{message:{role:'assistant',tool_calls:[{function:{name:'invented',arguments:{}}}]}},{message:{role:'assistant',tool_calls:[{function:{name:tool.name,arguments:'not-json'}}]}}]){
  await assert.rejects(callOllama({baseUrl:'http://localhost:11434',model:'local:test',input:'x',tools:[tool],fetchImpl:async()=>Response.json({...ok,...patch})}));
 }
});
test('Ollama hides raw transport and HTTP failures and marks uncertainty',async()=>{
 const events=[];await assert.rejects(callOllama({baseUrl:'http://localhost:11434',model:'local:test',input:'x',onTrace:e=>events.push(e),fetchImpl:async()=>{throw new Error('PRIVATE TRANSPORT');}}),e=>e.uncertain===true&&!e.message.includes('PRIVATE'));
 await assert.rejects(callOllama({baseUrl:'http://localhost:11434',model:'local:test',input:'x',onTrace:e=>events.push(e),fetchImpl:async()=>new Response('PRIVATE BODY',{status:500})}),/HTTP 500/);
 assert.doesNotMatch(JSON.stringify(events),/PRIVATE/);
});
