import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callMeta, retrieveMetaBackground, META_ENDPOINT } from '../src/meta.mjs';

// A finished Responses payload: a reasoning item the adapter must never surface, then the
// assistant's message. Tests pass overrides to reshape the reply.
const reasoningItem = { type: 'reasoning', summary: [{ text: 'Do not expose this.' }] };
const assistantItem = text => ({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] });
const finished = (overrides = {}) => ({
  id: 'resp_test', status: 'completed', model: 'muse-spark-1.3', usage: { input_tokens: 5, output_tokens: 10 },
  output: [reasoningItem, assistantItem('连接成功')],
  ...overrides,
});
const completed = finished();
// A fetch stand-in that remembers the one request it saw and answers with a fixed body.
function recorder(answer = () => Response.json(completed)) {
  const seen = { request: null };
  seen.fetch = async (url, options) => {
    seen.request = { url, options, body: options?.body ? JSON.parse(options.body) : null };
    return answer();
  };
  return seen;
}
const neverFetch = () => assert.fail('a request was made');
const key = 'test-secret';

test('background creation acknowledges immediately and retrieves a completed response',async()=>{
 const requests=[];
 const fetchImpl=async(url,options)=>{requests.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});return Response.json(requests.length===1?{id:'resp_test',status:'queued',background:true}:completed);};
 const start=await callMeta({apiKey:'test-secret',input:'synthetic',background:true,fetchImpl});
 assert.equal(start.pendingId,'resp_test');assert.equal(requests[0].body.background,true);assert.equal(requests[0].body.store,true);
 const result=await retrieveMetaBackground({apiKey:'test-secret',id:start.pendingId,fetchImpl});
 assert.equal(result.text,'连接成功');assert.equal(requests[1].url,'https://api.meta.ai/v1/responses/resp_test');
});
test('background retrieval distinguishes pending and terminal failures without exposing upstream text',async()=>{
 const pending=await retrieveMetaBackground({apiKey:'test-secret',id:'resp_test',fetchImpl:async()=>Response.json({status:'in_progress'})});
 assert.deepEqual(pending,{pending:true});
 const failed=await retrieveMetaBackground({apiKey:'test-secret',id:'resp_test',fetchImpl:async()=>Response.json({status:'failed',error:'private upstream detail'})});
 assert.deepEqual(failed,{failed:true});
 await assert.rejects(retrieveMetaBackground({apiKey:'test-secret',id:'../../bad',fetchImpl:()=>assert.fail('network called')}),/Invalid background/);
});

test('provider trace reports payload and safe output without headers or reasoning',async()=>{
 const events=[];
 await callMeta({apiKey:'test-secret',input:'synthetic',onTrace:e=>events.push(e),fetchImpl:async()=>Response.json(completed)});
 assert.equal(events[0].type,'request');assert.equal(events[0].body.input,'synthetic');
 assert.equal(events[1].status,200);assert.equal(events[1].body.output[0].content[0].text,'连接成功');
 assert.doesNotMatch(JSON.stringify(events),/test-secret|Do not expose|Authorization/);
});
test('provider trace captures safe HTTP and timeout failures without raw upstream content',async()=>{
 const events=[];
 await assert.rejects(callMeta({apiKey:'test-secret',input:'synthetic',onTrace:e=>events.push(e),fetchImpl:async()=>new Response('private test-secret',{status:429})}));
 assert.equal(events.at(-1).status,429);assert.doesNotMatch(JSON.stringify(events),/private|test-secret/);
});

test('a plain request is not stored, carries model, input and token cap only, and yields the assistant text alone', async () => {
  const seen = recorder();
  const result = await callMeta({ apiKey: key, input: 'Synthetic connection check', fetchImpl: seen.fetch });
  assert.equal(seen.request.url, META_ENDPOINT);
  assert.equal(seen.request.options.headers.Authorization, `Bearer ${key}`);
  assert.deepEqual(seen.request.body, { model: 'muse-spark-1.3', input: 'Synthetic connection check', store: false, max_output_tokens: 2048 });
  assert.deepEqual({ text: result.text, model: result.model, usage: result.usage }, { text: '连接成功', model: 'muse-spark-1.3', usage: completed.usage });
  assert.doesNotMatch(JSON.stringify(result), /Do not expose/);
});

test('without an API key nothing is sent', async () => {
  await assert.rejects(callMeta({ input: 'hello', fetchImpl: neverFetch }), /MODEL_API_KEY is missing/);
});

test('instructions travel in their own field, apart from the learner text, with the effort and cap requested', async () => {
  const seen = recorder();
  await callMeta({ apiKey: key, input: 'learner text', instructions: 'trusted coaching rules', reasoningEffort: 'low', maxOutputTokens: 4096, fetchImpl: seen.fetch });
  const { body, options } = seen.request;
  assert.equal(body.instructions, 'trusted coaching rules');
  assert.equal(body.input, 'learner text');
  assert.equal(body.store, false);
  assert.deepEqual(body.reasoning, { effort: 'low' });
  assert.equal(body.max_output_tokens, 4096);
  assert.equal(options.redirect, 'error', 'redirects are refused');
});

test('blank input is refused before any request', async () => {
  await assert.rejects(callMeta({ apiKey: key, input: '   ', fetchImpl: neverFetch }), /input must be non-empty/);
});

test('an HTTP error names the status and a hint, never the upstream body or the key', async () => {
  const seen = recorder(() => new Response(`${key} private response`, { status: 401 }));
  await assert.rejects(callMeta({ apiKey: key, input: 'hello', fetchImpl: seen.fetch }), error => {
    assert.match(error.message, /HTTP 401\. Check your Meta API key/);
    assert.doesNotMatch(error.message, new RegExp(`${key}|private response`));
    return true;
  });
});

test('a reply whose status is not completed is not treated as a success', async () => {
  const seen = recorder(() => Response.json(finished({ status: 'incomplete' })));
  await assert.rejects(callMeta({ apiKey: key, input: 'hello', fetchImpl: seen.fetch }), /not completed/);
});

test('a completed reply with no assistant message is an error', async () => {
  const seen = recorder(() => Response.json(finished({ output: [] })));
  await assert.rejects(callMeta({ apiKey: key, input: 'hello', fetchImpl: seen.fetch }), /no assistant text/);
});

test('a request that outlives its timeout fails with a safe message', async () => {
  // Behaves like an open socket: settles only when the adapter aborts it.
  const hanging = (_url, { signal }) => new Promise((_resolve, reject) => {
    const guard = setTimeout(() => reject(new Error('the adapter never aborted')), 1000);
    signal.addEventListener('abort', () => { clearTimeout(guard); reject(signal.reason); }, { once: true });
  });
  await assert.rejects(callMeta({ apiKey: key, input: 'hello', timeoutMs: 5, fetchImpl: hanging }), /timed out/);
});

test('one requested tool call comes back as a decision, with no text and no reasoning', async () => {
  const tool = { type: 'function', name: 'ask_clarification', parameters: { type: 'object', properties: {} } };
  const call = { type: 'function_call', name: 'ask_clarification', call_id: 'call_test', arguments: '{"question":"Which end?"}' };
  const seen = recorder(() => Response.json(finished({ output: [call] })));
  const result = await callMeta({ apiKey: key, input: 'synthetic', tools: [tool], fetchImpl: seen.fetch });
  assert.deepEqual(seen.request.body.tools, [tool]);
  assert.equal(seen.request.body.tool_choice, 'auto');
  assert.equal(seen.request.body.parallel_tool_calls, false);
  assert.deepEqual([result.toolCall, result.text], [{ name: 'ask_clarification', arguments: '{"question":"Which end?"}' }, '']);
  assert.doesNotMatch(JSON.stringify(result), /Do not expose/);
});

test('zero, duplicate or unrequested tool calls are refused rather than executed', async () => {
  const call = { type: 'function_call', call_id: 'call_1', name: 'ask_clarification', arguments: '{}' };
  for (const output of [[], [call, call], [{ ...call, name: 'run_code' }]]) {
    const seen = recorder(() => Response.json(finished({ output })));
    await assert.rejects(callMeta({ apiKey: key, input: 'synthetic', tools: [{ name: 'ask_clarification' }], fetchImpl: seen.fetch }), /one allowed learning action/);
  }
});

test('responses transport makes one request and strips unrelated SDK environment headers', async () => {
  const oldOrg = process.env.OPENAI_ORG_ID, oldProject = process.env.OPENAI_PROJECT_ID, oldCustom = process.env.OPENAI_CUSTOM_HEADERS;
  process.env.OPENAI_ORG_ID = 'foreign-org';
  process.env.OPENAI_PROJECT_ID = 'foreign-project';
  process.env.OPENAI_CUSTOM_HEADERS = 'X-Foreign-Secret: must-not-leak';
  let calls = 0;
  try {
    await assert.rejects(callMeta({apiKey:'test-secret',input:'synthetic',fetchImpl:async (_url, options)=>{
      calls++;
      const headers = new Headers(options.headers);
      assert.equal(headers.get('x-foreign-secret'), null);
      assert.equal(headers.get('openai-organization'), null);
      assert.equal(headers.get('openai-project'), null);
      assert.equal(headers.get('authorization'),'Bearer test-secret');
      assert.equal(options.redirect,'error');
      return new Response('private test-secret', {status:429});
    }}), /429/);
    assert.equal(calls, 1);
  } finally {
    for(const [key,value] of Object.entries({OPENAI_ORG_ID:oldOrg,OPENAI_PROJECT_ID:oldProject,OPENAI_CUSTOM_HEADERS:oldCustom})) {
      if(value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('server and transport failures never retry or expose upstream details', async () => {
  for (const fetchResult of [() => new Response('private upstream payload', {status:503}), () => {throw new Error('secret transport detail');}]) {
    let calls = 0;
    await assert.rejects(callMeta({apiKey:'test-secret',input:'synthetic',fetchImpl:async()=>{calls++;return fetchResult();}}), error => {
      assert.doesNotMatch(error.message, /private|secret|payload|detail/i);
      return true;
    });
    assert.equal(calls, 1);
  }
});

test('an invalid JSON response fails without exposing its contents', async () => {
  await assert.rejects(callMeta({apiKey:'test-secret', input:'synthetic', fetchImpl:async()=>new Response('private malformed',{headers:{'content-type':'application/json'}})}), error=>{
    assert.match(error.message,/invalid JSON/);
    assert.doesNotMatch(error.message,/private|malformed|test-secret/);
    return true;
  });
});
test('SAM output parses into pixel boxes and the segmentation request hides image bytes from traces',async()=>{
 const {parseSegmentation,segmentMetaImage,validConcept}=await import('../src/meta.mjs');
 const parsed=parseSegmentation('<0f>0<|box;x1=181;y1=365;x2=556;y2=486;w=1516;h=1600;c=0.96|><|mask;x=0;y=0;c=0.96;data=1,2,!a|>,1<|box;x1=5;y1=6;x2=7;y2=8;w=1516;h=1600;c=0.5|><|mask;x=0;y=0;data=1,!b|>');
 assert.deepEqual(parsed,{boxes:[{x1:181,y1:365,x2:556,y2:486,confidence:0.96},{x1:5,y1:6,x2:7,y2:8,confidence:0.5}],width:1516,height:1600});
 assert.deepEqual(parseSegmentation(''),{boxes:[],width:0,height:0});
 assert.equal(validConcept('yellow school bus'),true);assert.equal(validConcept('where is the bus?'),false);assert.equal(validConcept('x'.repeat(61)),false);
 const events=[];let sent;
 const result=await segmentMetaImage({apiKey:'k',image:'data:image/png;base64,QUJD',concept:'glasses',onTrace:e=>events.push(e),fetchImpl:async(url,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({model:'sam-3.1',output_text:'<0f>0<|box;x1=1;y1=2;x2=3;y2=4;w=10;h=20|><|mask;x=0;y=0;data=!a|>',usage:{input_tokens:5,output_tokens:6}}),{status:200});}});
 assert.equal(sent.model,'sam-3.1');assert.equal(sent.input[0].content[0].text,'glasses');assert.equal(sent.input[0].content[1].image_url,'data:image/png;base64,QUJD');assert.equal(sent.stream,undefined);
 assert.deepEqual(result.boxes,[{x1:1,y1:2,x2:3,y2:4}]);assert.equal(result.width,10);assert.deepEqual(result.usage,{input_tokens:5,output_tokens:6});
 assert.ok(!JSON.stringify(events).includes('QUJD'));assert.equal(events.at(-1).body.matches,1);
 await assert.rejects(segmentMetaImage({apiKey:'k',image:'data:image/png;base64,QUJD',concept:'glasses',fetchImpl:async()=>new Response('{}',{status:404})}),/status 404/);
});
test('a chained turn sends previous_response_id, store and the cache key, and usage reports cached tokens',async()=>{
 const {callMeta,usageSummary}=await import('../src/meta.mjs');
 let sent;
 const fetchImpl=async(url,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify({id:'resp_2',status:'completed',model:'muse-spark-1.3',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:'ok'}]}],usage:{input_tokens:1847,output_tokens:98,input_tokens_details:{cached_tokens:1792}}}),{status:200,headers:{'Content-Type':'application/json'}});};
 const result=await callMeta({apiKey:'k',input:'Next turn.',previousResponseId:'resp_1',promptCacheKey:'explainback-guide',store:true,fetchImpl});
 assert.equal(sent.previous_response_id,'resp_1');assert.equal(sent.prompt_cache_key,'explainback-guide');assert.equal(sent.prompt_cache_retention,'24h');assert.equal(sent.store,true);
 assert.equal(result.id,'resp_2');assert.deepEqual(usageSummary(result.usage),{input:1847,output:98,cached:1792});
 assert.deepEqual(usageSummary(null),null);assert.deepEqual(usageSummary({input_tokens:5,output_tokens:6}),{input:5,output:6,cached:null});
 // An unchained request stores nothing by default and sends neither field.
 await callMeta({apiKey:'k',input:'Fresh.',fetchImpl});
 assert.equal(sent.store,false);assert.equal('previous_response_id' in sent,false);assert.equal('prompt_cache_key' in sent,false);assert.equal('prompt_cache_retention' in sent,false);
 await assert.rejects(callMeta({apiKey:'k',input:'x',previousResponseId:'not an id',fetchImpl}),/response id/);
 // HTTP errors carry their status so a caller can fall back once.
 await assert.rejects(callMeta({apiKey:'k',input:'x',fetchImpl:async()=>new Response('{}',{status:404,headers:{'Content-Type':'application/json'}})}),e=>e.status===404&&/HTTP 404/.test(e.message));
});
test('a reasoning summary is requested and read from the reasoning output item, never the raw chain of thought',async()=>{
 const {callMeta,reasoningSummaryText}=await import('../src/meta.mjs');
 let sent;
 const data={id:'resp_9',status:'completed',model:'muse-spark-1.3',output:[{type:'reasoning',summary:[{type:'summary_text',text:'Compared the cooling rates at two gaps.'},{type:'summary_text',text:'Chose a one-chapter model.'}]},{type:'message',role:'assistant',content:[{type:'output_text',text:'ok'}]}],usage:{input_tokens:5,output_tokens:6}};
 const r=await callMeta({apiKey:'k',input:'x',reasoningEffort:'low',reasoningSummary:'auto',fetchImpl:async(u,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});}});
 assert.deepEqual(sent.reasoning,{effort:'low',summary:'auto'});
 assert.equal(r.reasoning,'Compared the cooling rates at two gaps. Chose a one-chapter model.');
 assert.equal(reasoningSummaryText({output:[{type:'reasoning',summary:[]}]}),null);
 assert.equal(reasoningSummaryText({output:[{type:'reasoning',summary:[{type:'summary_text',text:'x'.repeat(700)}]}]}).length,600);
 await callMeta({apiKey:'k',input:'x',fetchImpl:async(u,init)=>{sent=JSON.parse(init.body);return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});}});
 assert.equal('reasoning' in sent,false,'no reasoning block unless effort or summary was asked for');
});
