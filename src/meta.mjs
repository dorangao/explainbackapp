import OpenAI from 'openai';

// Server/CLI module only. Never bundle this module with a browser application.
export const META_ENDPOINT = 'https://api.meta.ai/v1/responses';
export const DEFAULT_META_MODEL = 'muse-spark-1.3';
// Models offered by default. Wonder is larger and slower, so it gets a longer budget.
export const DEFAULT_META_MODELS = ['muse-spark-1.3', 'muse-wonder-1.0'];
export const metaTimeoutMs = model => (model.startsWith('muse-wonder') ? 50_000 : 30_000);
// The usage summary the app reports: input and output tokens plus how many input tokens
// the server served from its prompt cache (a subset of input, billed at the cached rate).
export const usageSummary = usage => usage ? { input: usage.input_tokens ?? null, output: usage.output_tokens ?? null, cached: usage.input_tokens_details?.cached_tokens ?? null } : null;

export async function callMeta({
  apiKey,
  input,
  model = DEFAULT_META_MODEL,
  instructions,
  reasoningEffort,
  maxOutputTokens = 2048,
  tools,
  structuredOutput = false,
  images,
  background = false,
  // Multi-turn: chain this turn onto an earlier stored response so the model keeps its
  // reasoning context. `store` must be true on the earlier turn for the id to resolve.
  previousResponseId,
  store = background,
  // Prompt caching happens on the shared prefix automatically; a stable key per use case
  // routes requests that share a prefix to the backend that already holds it.
  promptCacheKey,
  timeoutMs = 30_000,
  fetchImpl = globalThis.fetch,
  onTrace,
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('MODEL_API_KEY is missing. Set it privately in your shell or .env.local.');
  }
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('input must be non-empty text.');
  }
  if (images !== undefined && (!Array.isArray(images) || !images.length || images.length > 4 || images.some(u => typeof u !== 'string' || !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(u) || u.length > 2_000_000))) {
    throw new Error('images must be one to four base64 data URLs.');
  }
  if(structuredOutput&&(!Array.isArray(tools)||tools.length!==1||!tools[0].parameters))throw new Error('Structured output needs one named schema.');

  const signal = AbortSignal.timeout(timeoutMs);
  const trace=event=>{try{onTrace?.(event);}catch{/* Diagnostics must not affect calls. */}};
  // Multimodal requests use one user message with text plus image parts (Responses API shape).
  const content=images?[{type:'input_text',text:input},...images.map(image_url=>({type:'input_image',image_url}))]:null;
  if(previousResponseId!==undefined&&!/^resp_[A-Za-z0-9_-]{1,200}$/.test(String(previousResponseId)))throw new Error('previousResponseId must be a response id.');
  if(promptCacheKey!==undefined&&!/^[A-Za-z0-9:_.-]{1,120}$/.test(String(promptCacheKey)))throw new Error('promptCacheKey must be a short plain key.');
  const body={model,input:content?[{type:'message',role:'user',content}]:input,store:Boolean(store||background),...(background?{background:true}:{}),max_output_tokens:maxOutputTokens,
    ...(previousResponseId?{previous_response_id:previousResponseId}:{}),...(promptCacheKey?{prompt_cache_key:promptCacheKey}:{}),
    ...(instructions?{instructions}:{}),...(reasoningEffort?{reasoning:{effort:reasoningEffort}}:{}),
    ...(structuredOutput?{text:{format:{type:'json_schema',name:tools[0].name,schema:tools[0].parameters,strict:true}}}:tools?{tools,tool_choice:'auto',parallel_tool_calls:false}:{})};
  if(structuredOutput)body.instructions=(instructions??'')+'\nTransport for this request: return the '+tools[0].name+' argument object directly as JSON matching the response schema. This is a structured response, not a tool invocation.';
  if(background && Buffer.byteLength(JSON.stringify(body))>1_048_576)throw new Error('Image is too large for a background request. Use a smaller image.');
  // Traces never carry image bytes; only the part type and size are recorded.
  trace({type:'request',body:content?{...body,input:[{type:'message',role:'user',content:content.map(part=>part.type==='input_image'?{type:'input_image',image_url:`[image omitted · ${part.image_url.length} chars]`}:part)}]}:body});
  // The SDK is configured for Meta explicitly; do not inherit unrelated OpenAI
  // organisation, project, custom-header, logging or retry settings. Limit the
  // final outbound headers as a second boundary against ambient SDK settings.
  const client = new OpenAI({
    apiKey: apiKey.trim(), baseURL: 'https://api.meta.ai/v1',
    organization: null, project: null, adminAPIKey: null, webhookSecret: null,
    maxRetries: 0, timeout: timeoutMs, logLevel: 'off',
    fetch: (url, options) => {
      if (String(url) !== META_ENDPOINT) throw new Error('Unexpected Meta endpoint.');
      const headers = new Headers(options.headers), outbound = {};
      if (headers.has('authorization')) outbound.Authorization = headers.get('authorization');
      if (headers.has('content-type')) outbound['Content-Type'] = headers.get('content-type');
      if (headers.has('accept')) outbound.Accept = headers.get('accept');
      return fetchImpl(url, {...options, headers: outbound, redirect: 'error'});
    },
  });
  let response, data;
  try {
    ({data, response} = await client.responses.create(body, {signal}).withResponse());
  } catch (error) {
    if (Number.isInteger(error?.status)) {
      trace({type:'error',status:error.status,message:'Provider returned an HTTP error; raw body omitted.'});
      const guidance = {
        401: 'Check your Meta API key.',
        403: 'Check account and model access.',
        404: 'Check META_MODEL against your available models.',
        429: 'Check credits and rate limits before retrying.',
      }[error.status] ?? 'Check the Meta dashboard before retrying.';
      throw Object.assign(new Error(`Meta API returned HTTP ${error.status}. ${guidance}`),{status:error.status});
    }
    if (error instanceof SyntaxError) {
      trace({type:'error',message:'invalid JSON'});
      throw new Error('Meta API returned invalid JSON.');
    }
    const timedOut = signal.aborted || error instanceof OpenAI.APIConnectionTimeoutError;
    trace({type:'error',message:timedOut?'timeout':'transport failure'});
    throw new Error(timedOut ? 'Meta request timed out.' : 'Could not reach Meta Model API. Check your network connection.');
  }
  trace({type:'response',status:response.status,body:{id:data?.id,status:data?.status,model:data?.model,usage:data?.usage,
    output:(Array.isArray(data?.output)?data.output:[]).flatMap(item=>item?.type==='function_call'?[{type:'function_call',name:item.name,arguments:item.arguments}]:item?.type==='message'&&item.role==='assistant'?[{type:'message',role:'assistant',content:(Array.isArray(item.content)?item.content:[]).filter(c=>c?.type==='output_text').map(c=>({type:'output_text',text:c.text}))}]:[])}});
  if(background && ['queued','in_progress'].includes(data?.status) && /^resp_[A-Za-z0-9_-]+$/.test(data?.id??''))return {pendingId:data.id};
  return readMetaResponse(data,{tools,structuredOutput});
}

function readMetaResponse(data,{tools,structuredOutput=false}={}) {
  if (data?.status !== 'completed') throw new Error('Meta response was not completed; no success was recorded.');
  if (tools&&!structuredOutput) {
    const calls = (Array.isArray(data.output) ? data.output : []).filter(item => item?.type === 'function_call');
    if (calls.length !== 1 || !tools.some(tool => tool.name === calls[0].name) || typeof calls[0].arguments !== 'string') {
      throw new Error('Meta must return exactly one allowed learning action.');
    }
    return { id: data.id, model: data.model, text: '', usage: data.usage,
      toolCall: { name: calls[0].name, arguments: calls[0].arguments } };
  }
  const text = (Array.isArray(data.output) ? data.output : [])
    .filter(item => item?.type === 'message' && item.role === 'assistant')
    .flatMap(item => Array.isArray(item.content) ? item.content : [])
    .filter(item => item?.type === 'output_text' && typeof item.text === 'string')
    .map(item => item.text).join('\n').trim();
  if (!text) throw new Error('Meta response contained no assistant text.');
  if(structuredOutput){
    let value;try{value=JSON.parse(text);}catch{throw new Error('Meta returned invalid structured JSON.');}
    return {id:data.id,model:data.model,usage:data.usage,text:'',structured:{name:tools[0].name,value}};
  }
  return { id: data.id, model: data.model, text, usage: data.usage };
}

// A background response is polled only by its owning server session, never by a browser ID.
export async function retrieveMetaBackground({apiKey,id,tools,structuredOutput=false,fetchImpl=globalThis.fetch}={}) {
  if(typeof apiKey!=='string'||!apiKey.trim()||!/^resp_[A-Za-z0-9_-]+$/.test(id??''))throw new Error('Invalid background response.');
  let response,data;
  try {
    response=await fetchImpl(`${META_ENDPOINT}/${id}`,{headers:{Authorization:`Bearer ${apiKey.trim()}`,Accept:'application/json'},signal:AbortSignal.timeout(15_000),redirect:'error'});
    if(!response.ok)throw new Error('provider error');
    data=await response.json();
  } catch {throw new Error('Could not retrieve the background response.');}
  if(['queued','in_progress'].includes(data?.status))return {pending:true};
  if(['failed','cancelled','incomplete'].includes(data?.status))return {failed:true};
  try{return readMetaResponse(data,{tools,structuredOutput});}catch{return {failed:true};}
}

export const META_IMAGE_ENDPOINT = 'https://api.meta.ai/v1/images/generations';
export const META_ASR_ENDPOINT = 'https://api.meta.ai/v1/asr/transcribe';
export const DEFAULT_META_VOICE_MODEL = 'muse-voice-transcribe-1.0';
export const DEFAULT_META_IMAGE_MODEL = 'muse-image-1.0';
// One illustration from Muse Image. Returns a data URL; bytes never enter traces or logs.
export async function generateMetaImage({
  apiKey,
  prompt,
  model = DEFAULT_META_IMAGE_MODEL,
  size = '1536x1024',
  outputFormat = 'webp',
  timeoutMs = 60_000,
  fetchImpl = globalThis.fetch,
  onTrace,
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('MODEL_API_KEY is missing. Set it privately in your shell or .env.local.');
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 1000) throw new Error('prompt must be non-empty text under 1000 characters.');
  if (!['webp', 'png', 'jpeg'].includes(outputFormat)) throw new Error('Unsupported image format.');
  const signal = AbortSignal.timeout(timeoutMs);
  const trace = event => { try { onTrace?.(event); } catch { /* Diagnostics must not affect calls. */ } };
  const body = { model, prompt, n: 1, size, response_format: 'b64_json', output_format: outputFormat };
  trace({ type: 'request', body });
  let response;
  try {
    response = await fetchImpl(META_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
      redirect: 'error',
    });
  } catch {
    trace({ type: 'error', message: signal.aborted ? 'timeout' : 'transport failure' });
    throw new Error(signal.aborted ? 'Meta image request timed out.' : 'Could not reach Meta Model API. Check your network connection.');
  }
  if (!response.ok) {
    trace({ type: 'error', message: `status ${response.status}` });
    throw new Error(`Meta image request failed with status ${response.status}.`);
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('Meta returned invalid image JSON.'); }
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== 'string' || !b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) throw new Error('Meta returned no image.');
  const format = ['webp', 'png', 'jpeg'].includes(data.output_format) ? data.output_format : outputFormat;
  trace({ type: 'response', body: { output_format: format, bytes: Math.floor(b64.length * 3 / 4), usage: data.usage ?? null } });
  return { dataUrl: `data:image/${format};base64,${b64}`, format, model, usage: data.usage ? { input_tokens: data.usage.input_tokens ?? null, output_tokens: data.usage.output_tokens ?? null } : null };
}

// Speech to text for the learner's spoken explanation. The audio is a validated mono
// 16-bit WAV (src/wav.mjs); the transcript comes back as text for the learner to edit.
// Traces carry sizes and the transcript, never audio bytes.
export async function transcribeMetaAudio({
  apiKey,
  wav,
  model = DEFAULT_META_VOICE_MODEL,
  languageBias,
  timeoutMs = 30_000,
  fetchImpl = globalThis.fetch,
  onTrace,
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('MODEL_API_KEY is missing. Set it privately in your shell or .env.local.');
  if (!(wav instanceof Uint8Array) || wav.byteLength < 44 || wav.byteLength > 4_000_000) throw new Error('wav must be a small WAV buffer.');
  if (languageBias !== undefined && (!Array.isArray(languageBias) || !languageBias.every(l => typeof l === 'string' && /^[A-Za-z ]{2,40}$/.test(l)))) throw new Error('languageBias must be language names.');
  const signal = AbortSignal.timeout(timeoutMs);
  const trace = event => { try { onTrace?.(event); } catch { /* Diagnostics must not affect calls. */ } };
  const request = { model, mode: 'PUSH_TO_TALK', audioEncoding: 'WAV', ...(languageBias ? { languageBias } : {}) };
  trace({ type: 'request', body: { ...request, audioBytes: wav.byteLength } });
  const form = new FormData();
  form.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
  form.append('audio', new Blob([wav], { type: 'audio/wav' }), 'speech.wav');
  let response;
  try {
    response = await fetchImpl(META_ASR_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: 'application/json' },
      body: form,
      signal,
      redirect: 'error',
    });
  } catch {
    trace({ type: 'error', message: signal.aborted ? 'timeout' : 'transport failure' });
    throw new Error(signal.aborted ? 'Meta transcription timed out.' : 'Could not reach Meta Model API. Check your network connection.');
  }
  if (!response.ok) {
    trace({ type: 'error', message: `status ${response.status}` });
    throw new Error(`Meta transcription failed with status ${response.status}.`);
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('Meta returned invalid transcription JSON.'); }
  if (typeof data?.transcript !== 'string') throw new Error('Meta returned no transcript.');
  const text = data.transcript.replace(/\s+/g, ' ').trim();
  const audioDurationMs = Number.isFinite(data.audioDurationMs) ? Math.round(data.audioDurationMs) : null;
  trace({ type: 'response', body: { transcript: text, audioDurationMs } });
  return { text, model, audioDurationMs };
}

// SAM 3.1 (Segment Anything) on the Meta Model API: given one short noun phrase and an
// image, it returns a box and a mask for every match. ExplainBack uses the boxes to show
// a learner what the model found in their sketch or photo; masks are not decoded. The
// request is the ordinary Responses call, non-streaming; bytes never enter traces.
export const DEFAULT_META_SEGMENT_MODEL = 'sam-3.1';
const BOX = /<\|box;x1=(\d+);y1=(\d+);x2=(\d+);y2=(\d+);w=(\d+);h=(\d+)(?:;c=([0-9.]+))?\|>/g;
// Parses SAM's token output into pixel boxes; an empty or absent text means no match.
export function parseSegmentation(text) {
  const boxes = []; let width = 0, height = 0;
  for (const m of String(text ?? '').matchAll(BOX)) {
    const [x1, y1, x2, y2, w, h] = m.slice(1, 7).map(Number);
    if (!(w > 0 && h > 0) || x1 > x2 || y1 > y2) continue;
    width = w; height = h;
    boxes.push({ x1, y1, x2, y2, ...(m[7] !== undefined ? { confidence: Math.max(0, Math.min(1, Number(m[7]))) } : {}) });
  }
  return { boxes, width, height };
}
export const validConcept = value => typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N} '-]{0,59}$/u.test(value.trim());
export async function segmentMetaImage({
  apiKey,
  image,
  concept,
  model = DEFAULT_META_SEGMENT_MODEL,
  timeoutMs = 30_000,
  fetchImpl = globalThis.fetch,
  onTrace,
} = {}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) throw new Error('MODEL_API_KEY is missing. Set it privately in your shell or .env.local.');
  if (typeof image !== 'string' || !/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 2_000_000) throw new Error('image must be a base64 data URL.');
  if (!validConcept(concept)) throw new Error('concept must be a short noun phrase.');
  const signal = AbortSignal.timeout(timeoutMs);
  const trace = event => { try { onTrace?.(event); } catch { /* Diagnostics must not affect calls. */ } };
  const body = { model, input: [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: concept.trim() }, { type: 'input_image', image_url: image }] }], metadata: { include_confidence: 'true', mask_encoding: 'one_bit' } };
  trace({ type: 'request', body: { ...body, input: [{ type: 'message', role: 'user', content: [body.input[0].content[0], { type: 'input_image', image_url: `[image omitted · ${image.length} chars]` }] }] } });
  let response;
  try {
    response = await fetchImpl(META_ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${apiKey.trim()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal, redirect: 'error' });
  } catch {
    trace({ type: 'error', message: signal.aborted ? 'timeout' : 'transport failure' });
    throw new Error(signal.aborted ? 'Meta segmentation request timed out.' : 'Could not reach Meta Model API. Check your network connection.');
  }
  if (!response.ok) { trace({ type: 'error', message: `status ${response.status}` }); throw new Error(`Meta segmentation request failed with status ${response.status}.`); }
  let data; try { data = await response.json(); } catch { throw new Error('Meta returned invalid segmentation JSON.'); }
  const text = typeof data?.output_text === 'string' ? data.output_text
    : (data?.output ?? []).flatMap(item => item?.content ?? []).filter(part => part?.type === 'output_text' && typeof part.text === 'string').map(part => part.text).join('\n');
  const result = parseSegmentation(text);
  trace({ type: 'response', body: { matches: result.boxes.length, width: result.width, height: result.height, usage: data.usage ?? null } });
  return { ...result, model: data.model ?? model, usage: data.usage ? { input_tokens: data.usage.input_tokens ?? null, output_tokens: data.usage.output_tokens ?? null } : null };
}
