import {readFile,unlink,writeFile,mkdir,link,stat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';import {ollamaUrl} from './ollama.mjs';
const failure=(code,message)=>Object.assign(new Error(message),{code});
export function createOllamaCoordinator({baseUrl,models,lockDir=tmpdir(),fetchImpl=globalThis.fetch,pollMs=200,unloadTimeoutMs=15000}){
 const endpoint=ollamaUrl(baseUrl),id=createHash('sha256').update(endpoint).digest('hex').slice(0,20),lock=join(lockDir,'explainback-ollama-'+id+'.lock'),uncertain=lock+'.uncertain';
 const managed=new Set(models);
 async function api(path,body){
  let response;try{response=await fetchImpl(endpoint+path,{method:body?'POST':'GET',...(body?{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}}:{}),signal:AbortSignal.timeout(unloadTimeoutMs),redirect:'error'});}
  catch{throw failure('OLLAMA_CONTROL','Ollama model state could not be verified. No generation started.');}
  if(!response.ok)throw failure('OLLAMA_CONTROL','Ollama model control returned HTTP '+response.status+'.');
  try{return await response.json();}catch{throw failure('OLLAMA_CONTROL','Ollama model state was invalid.');}
 }
 async function loaded(){
  const data=await api('/api/ps');if(!Array.isArray(data.models)||data.models.some(m=>typeof m.name!=='string'))throw failure('OLLAMA_CONTROL','Ollama running-model list was invalid.');
  const names=data.models.map(m=>m.name);if(names.some(n=>!managed.has(n)))throw failure('OLLAMA_OTHER_MODEL','An unmanaged model is loaded on Ollama. Stop it before using ExplainBack.');
  return names;
 }
 async function unload(model,onTrace){
  if(!managed.has(model))throw failure('OLLAMA_MODEL','Unknown Ollama model.');
  onTrace?.({type:'lifecycle',action:'unload',model});
  await api('/api/generate',{model,keep_alive:0});
  const deadline=Date.now()+unloadTimeoutMs;
  while((await loaded()).includes(model)){if(Date.now()>=deadline)throw failure('OLLAMA_CONTROL','Previous model did not unload; switching is blocked.');await delay(pollMs);}
  onTrace?.({type:'lifecycle',action:'unloaded',model});
 }
 async function block(){await writeFile(uncertain,JSON.stringify({at:new Date().toISOString(),reason:"generation transport or response uncertain"}),{mode:0o600});}
 async function checkBlocked(){try{await readFile(uncertain);}catch(error){if(error.code==='ENOENT')return;throw error;}throw failure('OLLAMA_UNCERTAIN','A previous Ollama call ended uncertainly. Run npm run llm:recover before more local requests.');}
 const operations={
  block,
  async prepare(model,onTrace){await checkBlocked();if(!managed.has(model))throw failure('OLLAMA_MODEL','Unknown Ollama model.');for(const name of await loaded())if(name!==model)await unload(name,onTrace);const names=await loaded();if(names.some(n=>n!==model))throw failure('OLLAMA_CONTROL','Previous model is still loaded.');},
  async unloadAll(){for(const name of await loaded())await unload(name);},
  unload,
 };
 // Publish complete metadata atomically: a crash cannot leave an empty lock.
 async function publish(path,owner){
  const candidate=path+'.'+owner.token+'.tmp';
  try{await writeFile(candidate,JSON.stringify(owner),{flag:'wx',mode:0o600});await link(candidate,path);}
  catch(error){if(error.code==='EEXIST')throw failure('OLLAMA_BUSY','Ollama is reserved by another ExplainBack request, evaluation or recovery.');throw error;}
  finally{await unlink(candidate).catch(error=>{if(error.code!=='ENOENT')throw error;});}
 }
 async function removeOwned(path,token){
  try{const owner=JSON.parse(await readFile(path,'utf8'));if(owner.token===token)await unlink(path);}
  catch(error){if(error.code!=='ENOENT')throw error;}
 }
 const guard=lock+'.recovery';
 async function checkGuard(){try{await stat(guard);}catch(error){if(error.code==='ENOENT')return;throw error;}throw failure('OLLAMA_BUSY','Ollama recovery is reserved. If recovery crashed, verify its process has exited before removing its .recovery guard; never remove a live guard.');}
 async function exclusive(fn,{recover=false}={}){
  await mkdir(lockDir,{recursive:true});
  const token=randomUUID();if(!recover)await checkGuard();
  await publish(lock,{token,pid:process.pid,createdAt:new Date().toISOString()});
  try{
   // Close the race where recovery starts between the guard check and publication.
   if(!recover)await checkGuard();
   if(!recover)await checkBlocked();
   return await fn(operations);
  }catch(error){if(error.uncertain)await block();throw error;}
  finally{await removeOwned(lock,token);}
 }
 async function recover(){
  await mkdir(lockDir,{recursive:true});const token=randomUUID();
  // Serialize all stale-owner decisions. Never automatically steal this guard.
  await publish(guard,{token,pid:process.pid,createdAt:new Date().toISOString()});
  try{
   try{
    const raw=await readFile(lock,'utf8');let owner;
    try{owner=JSON.parse(raw);if(!Number.isInteger(owner.pid)||owner.pid<=0||typeof owner.token!=='string')owner=null;}catch{owner=null;}
    if(owner){
     let alive=true;try{process.kill(owner.pid,0);}catch(error){if(error.code==='ESRCH')alive=false;else throw error;}
     if(alive)throw failure('OLLAMA_BUSY','An ExplainBack process still owns Ollama; recovery will not stop it.');
    }else if(Date.now()-(await stat(lock)).mtimeMs<600000){
     throw failure('OLLAMA_BUSY','Incomplete legacy lock metadata is recent; wait ten minutes with no active request before explicit recovery.');
    }
    await unlink(lock);
   }catch(error){if(error.code!=='ENOENT')throw error;}
   return await exclusive(async ops=>{
    // Main lock now protects control work; keep the recovery-only guard brief.
    await removeOwned(guard,token);
    await ops.unloadAll();await unlink(uncertain).catch(error=>{if(error.code!=='ENOENT')throw error;});
   },{recover:true});
  }finally{await removeOwned(guard,token);}
 }
 return {exclusive,recover};
}
