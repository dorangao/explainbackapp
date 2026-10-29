import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callMeta, retrieveMetaBackground } from '../src/meta.mjs';

const completed = {
  id: 'resp_test', status: 'completed', model: 'muse-spark-1.3',
  output: [
    { type: 'reasoning', summary: [{ text: 'Do not expose this.' }] },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '连接成功' }] },
  ],
  usage: { input_tokens: 5, output_tokens: 10 },
};

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

test('sends a non-stored Meta request and extracts only assistant output', async () => {
  let request;
  const result = await callMeta({
    apiKey: 'test-secret', input: 'Synthetic connection check',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return Response.json(completed);
    },
  });
  assert.equal(request.url, 'https://api.meta.ai/v1/responses');
  assert.equal(request.options.headers.Authorization, 'Bearer test-secret');
  assert.deepEqual(JSON.parse(request.options.body), {
    model: 'muse-spark-1.3', input: 'Synthetic connection check', store: false, max_output_tokens: 2048,
  });
  assert.equal(result.text, '连接成功');
  assert.equal(result.model, 'muse-spark-1.3');
  assert.deepEqual(result.usage, completed.usage);
  assert.equal(JSON.stringify(result).includes('Do not expose'), false);
});

test('missing credentials fail before any network request', async () => {
  await assert.rejects(callMeta({ input: 'hello', fetchImpl: () => assert.fail('network called') }), /MODEL_API_KEY is missing/);
});

test('developer instructions stay separate from learner input', async () => {
  await callMeta({ apiKey: 'test-secret', input: 'learner text', instructions: 'trusted coaching rules', reasoningEffort: 'low', maxOutputTokens: 4096,
    fetchImpl: async (_url, options) => {
      const payload = JSON.parse(options.body);
      assert.equal(payload.instructions, 'trusted coaching rules');
      assert.equal(payload.input, 'learner text');
      assert.equal(payload.store, false);
      assert.deepEqual(payload.reasoning, { effort: 'low' });
      assert.equal(payload.max_output_tokens, 4096);
      assert.equal(options.redirect, 'error');
      return Response.json(completed);
    },
  });
});

test('rejects blank input before any network request', async () => {
  await assert.rejects(callMeta({ apiKey: 'key', input: ' ', fetchImpl: () => assert.fail('network called') }), /input must be non-empty/);
});

test('HTTP errors do not echo upstream bodies or credentials', async () => {
  await assert.rejects(callMeta({ apiKey: 'test-secret', input: 'hello',
    fetchImpl: async () => new Response('test-secret private response', { status: 401 }),
  }), error => {
    assert.match(error.message, /401.*key/);
    assert.doesNotMatch(error.message, /test-secret|private response/);
    return true;
  });
});

test('does not mistake incomplete output for a successful connection', async () => {
  await assert.rejects(callMeta({ apiKey: 'key', input: 'hello',
    fetchImpl: async () => Response.json({ ...completed, status: 'incomplete' }),
  }), /not completed/);
});

test('rejects a response with no assistant text', async () => {
  await assert.rejects(callMeta({ apiKey: 'key', input: 'hello',
    fetchImpl: async () => Response.json({ ...completed, output: [] }),
  }), /no assistant text/);
});

test('timeouts fail with a safe error', async () => {
  await assert.rejects(callMeta({ apiKey: 'test-secret', input: 'hello', timeoutMs: 5,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      // Keep this fake request alive like a real network socket.
      const timer = setTimeout(() => reject(new Error('test failed to abort')), 1000);
      signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
    }),
  }), /timed out/);
});

test('native tool calls return an executable decision without exposing reasoning', async () => {
  const tool = { type: 'function', name: 'ask_clarification', parameters: { type: 'object' } };
  const result = await callMeta({ apiKey: 'test-secret', input: 'synthetic', tools: [tool],
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.tools, [tool]);
      assert.equal(body.tool_choice, 'auto');
      assert.equal(body.parallel_tool_calls, false);
      return Response.json({ ...completed, output: [{ type: 'function_call', name: 'ask_clarification', call_id: 'call_test', arguments: '{"question":"Which end?"}' }] });
    },
  });
  assert.deepEqual(result.toolCall, { name: 'ask_clarification', arguments: '{"question":"Which end?"}' });
  assert.equal(result.text, '');
});

test('rejects unrequested or multiple native calls rather than executing any', async () => {
  const call = { type: 'function_call', name: 'ask_clarification', arguments: '{}' };
  for (const output of [[call, call], [{ ...call, name: 'run_code' }], []]) {
    await assert.rejects(callMeta({ apiKey: 'key', input: 'synthetic', tools: [{ name: 'ask_clarification' }],
      fetchImpl: async () => Response.json({ ...completed, output }),
    }), /one allowed learning action/);
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
