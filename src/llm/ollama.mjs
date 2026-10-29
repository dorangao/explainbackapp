// Server only. No credentials are forwarded to the LAN endpoint.
export function ollamaUrl(value){
 const url=new URL(value);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('OLLAMA_BASE_URL must be an HTTP(S) origin without credentials or a path.');
 return url.origin;
}
export async function callOllama({baseUrl,model,input,instructions,tools,maxOutputTokens=4096,timeoutMs=180000,fetchImpl=globalThis.fetch,onTrace}={}){
 if(typeof input!=='string'||!input.trim()||typeof model!=='string'||!model)throw new Error('Model and nonempty input are required.');
 const endpoint=ollamaUrl(baseUrl),signal=AbortSignal.timeout(timeoutMs);
 const trace=event=>{try{onTrace?.(event);}catch{}};
 const body={model,messages:[...(instructions?[{role:'system',content:instructions}]:[]),{role:'user',content:input}],stream:false,think:false,keep_alive:'5m',
  options:{temperature:0,num_ctx:16384,num_predict:maxOutputTokens},...(tools?{tools:tools.map(t=>({type:'function',function:{name:t.name,description:t.description,parameters:t.parameters}}))}:{})};
 trace({type:'request',body});
 let response,data;
 try{response=await fetchImpl(endpoint+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal,redirect:'error'});}
 catch{trace({type:'error',message:signal.aborted?'timeout':'transport failure'});throw Object.assign(new Error(signal.aborted?'Ollama request timed out.':'Could not reach Ollama.'),{uncertain:true});}
 if(!response.ok){trace({type:'error',status:response.status,message:'Provider returned an HTTP error; raw body omitted.'});throw new Error('Ollama returned HTTP '+response.status+'.');}
 try{data=await response.json();}catch{trace({type:'error',status:response.status,message:'Invalid JSON response.'});throw Object.assign(new Error('Ollama returned invalid JSON.'),{uncertain:true});}
 const usage={input_tokens:data.prompt_eval_count??null,output_tokens:data.eval_count??null};
 const timings={totalMs:(data.total_duration??0)/1e6,loadMs:(data.load_duration??0)/1e6,promptMs:(data.prompt_eval_duration??0)/1e6,decodeMs:(data.eval_duration??0)/1e6};
 const message=data.message??{},calls=Array.isArray(message.tool_calls)?message.tool_calls:[];
 // Allowlist response fields; never retain message.thinking or arbitrary metadata.
 trace({type:'response',status:response.status,body:{model:data.model,done:data.done,done_reason:data.done_reason,usage,timings,message:{role:message.role,content:message.content,tool_calls:calls.map(c=>({function:{name:c?.function?.name,arguments:c?.function?.arguments}}))}}});
 if(data.done!==true||data.done_reason==='length')throw new Error('Ollama response was incomplete; no success was recorded.');
 const result={provider:'ollama',model:data.model??model,usage,timings,text:''};
 if(tools){
  const call=calls[0]?.function;
  if(calls.length!==1||!tools.some(t=>t.name===call?.name)||!call?.arguments||typeof call.arguments!=='object'||Array.isArray(call.arguments))throw new Error('Ollama must return exactly one allowed learning action with object arguments.');
  return {...result,toolCall:{name:call.name,arguments:JSON.stringify(call.arguments)}};
 }
 if(typeof message.content!=='string'||!message.content.trim())throw new Error('Ollama returned no assistant text.');
 return {...result,text:message.content.trim()};
}
