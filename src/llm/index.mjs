import {callMeta,DEFAULT_META_MODEL,DEFAULT_META_MODELS,metaTimeoutMs} from '../meta.mjs';import {callOllama,ollamaUrl} from './ollama.mjs';import {createOllamaCoordinator} from './ollama-coordinator.mjs';
export function createProviderRouter({env=process.env,fetchImpl=globalThis.fetch,lockDir,metaCall=callMeta,ollamaCall=callOllama}={}){
 const split=value=>[...new Set(value.split(',').map(x=>x.trim()).filter(Boolean))];
 const providers=split(env.EXPLAINBACK_PROVIDERS||'meta,ollama');
 if(!providers.length||providers.some(p=>!['meta','ollama'].includes(p)))throw new Error('Invalid provider allowlist.');
 const metaModels=providers.includes('meta')?split(env.EXPLAINBACK_META_MODELS||[env.META_MODEL||DEFAULT_META_MODEL,...DEFAULT_META_MODELS].join(',')):[],ollamaModels=providers.includes('ollama')?split(env.EXPLAINBACK_OLLAMA_MODELS||'muse-glimmer:latest,qwen3.8:27b'):[];
 if([...metaModels,...ollamaModels].some(m=>m.length>160||!/^[-a-zA-Z0-9_.:/]+$/.test(m)))throw new Error('Invalid configured model name.');
 const endpoint=ollamaModels.length&&env.OLLAMA_BASE_URL?ollamaUrl(env.OLLAMA_BASE_URL):null;
 const entries=[...metaModels.map(model=>({id:'meta:'+model,provider:'meta',model,label:'Meta · '+model,configured:Boolean(env.MODEL_API_KEY?.trim()),timeoutMs:metaTimeoutMs(model)})),...ollamaModels.map(model=>({id:'ollama:'+model,provider:'ollama',model,label:'Ollama · '+model,configured:Boolean(endpoint),timeoutMs:180000}))];
 const defaultId=env.EXPLAINBACK_DEFAULT_MODEL||entries[0].id;
 const get=id=>{const target=entries.find(t=>t.id===(id??defaultId));if(!target)throw new Error('Choose an allowed provider/model.');return {...target};};get(defaultId);
 const coordinator=endpoint?createOllamaCoordinator({baseUrl:endpoint,models:ollamaModels,fetchImpl,lockDir}):null;
 async function invoke(id,args,ops){
  const t=get(id);if(!t.configured)throw new Error('Selected provider is not configured.');
  if(t.provider==='meta')return {...await metaCall({...args,model:t.model,apiKey:env.MODEL_API_KEY,timeoutMs:t.timeoutMs,fetchImpl}),provider:'meta'};
  if(args.images)throw Object.assign(new Error('Image input needs a Meta model.'),{code:'IMAGE_UNSUPPORTED'});
  await ops.prepare(t.model,args.onTrace);
  try{return await ollamaCall({...args,baseUrl:endpoint,model:t.model,timeoutMs:t.timeoutMs,fetchImpl});}
  catch(error){if(error.uncertain)await ops.block();throw error;}
 }
 const call=(id,args)=>get(id).provider==='ollama'?(coordinator?coordinator.exclusive(ops=>invoke(id,args,ops)):Promise.reject(new Error('Ollama is not configured.'))):invoke(id,args);
 return {list:()=>entries.map(t=>({...t})),get,defaultId,call,
  async evaluateExclusive(ids,fn){
   ids.forEach(get);const local=ids.some(id=>get(id).provider==='ollama');
   if(local&&!coordinator)throw new Error('Ollama is not configured.');
   const run=async ops=>fn({call:(id,args)=>invoke(id,args,ops),unload:async id=>{if(get(id).provider==='ollama')await ops.unload(get(id).model);}});
   return local?coordinator.exclusive(async ops=>{await ops.unloadAll();return run(ops);}):run();
  },
  recover:()=>{if(!coordinator)throw new Error('Ollama is not configured.');return coordinator.recover();},
 };
}
