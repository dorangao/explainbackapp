import {selectCases} from '../src/eval/select-cases.mjs';
import {suiteVersion} from '../src/eval/cases.mjs';
import {mkdir,writeFile} from 'node:fs/promises';import {dirname,resolve} from 'node:path';
import {createProviderRouter} from '../src/llm/index.mjs';import {ollamaUrl} from '../src/llm/ollama.mjs';import {runEvaluation,markdownReport} from '../src/eval/run.mjs';
const router=createProviderRouter(),args=process.argv.slice(2);
if(args.includes('--list')){console.log(router.list().map(t=>`${t.id}\t${t.configured?'configured':'not configured'}`).join('\n'));process.exit(0);}
if(args.some(a=>!a.startsWith('--models=')&&!a.startsWith('--out=')&&!a.startsWith('--cases=')))throw new Error('Options: --list, --models=all or comma-separated target IDs, --out=output/eval/name.json, --cases=comma-separated-case-IDs');
const caseFilter=args.find(a=>a.startsWith('--cases='))?.slice(8),cases=selectCases(caseFilter);
const requested=args.find(a=>a.startsWith('--models='))?.slice(9),ids=requested==='all'?router.list().filter(t=>t.configured).map(t=>t.id):requested?.split(',')??router.list().filter(t=>t.provider==='ollama'&&t.configured).map(t=>t.id);
if(!ids.length||ids.length>4||new Set(ids).size!==ids.length)throw new Error('Select one to four distinct configured models.');
const targets=ids.map(id=>router.get(id));if(targets.some(t=>!t.configured))throw new Error('A selected model is not configured.');
const path=resolve(args.find(a=>a.startsWith('--out='))?.slice(6)??`output/eval/${new Date().toISOString().replaceAll(':','-')}.json`),md=path.replace(/\.json$/i,'')+'.md';
const metadata={ollamaSettings:{think:false,temperature:0,num_ctx:16384,num_predict:4096},metaSettings:{reasoningEffort:'low',maxOutputTokens:4096},coldStart:'Managed local models unloaded before matrix and after each target. First request includes model load.'};
if(targets.some(t=>t.provider==='ollama')){
 const endpoint=ollamaUrl(process.env.OLLAMA_BASE_URL);
 for(const route of ['version','tags']){
  try{const r=await fetch(endpoint+'/api/'+route,{signal:AbortSignal.timeout(10000),redirect:'error'});if(!r.ok)throw new Error();const data=await r.json();
   if(route==='version')metadata.ollamaVersion=data.version;
   else metadata.localModels=data.models.filter(m=>targets.some(t=>t.provider==='ollama'&&t.model===m.name)).map(m=>({name:m.name,digest:m.digest,size:m.size,details:m.details}));
  }catch{throw new Error('Cannot read Ollama version/model metadata. No evaluation started.');}
 }
}
await mkdir(dirname(path),{recursive:true});
console.log(`Running ${targets.length} model(s), ${cases.length} cases each, sequentially. No retries. Output: ${path}`);
try{
 const report=await router.evaluateExclusive(ids,ops=>runEvaluation({targets,cases,suite:caseFilter?suiteVersion+'/focus':suiteVersion,...ops,metadata,onUpdate:async(report,item)=>{
  await writeFile(path,JSON.stringify(report,null,2)+'\n',{mode:0o600});await writeFile(md,markdownReport(report),{mode:0o600});
  if(item)console.log(`${report.models.at(-1).id} ${item.id}: ${item.pass?'PASS':'FAIL'} (${item.latencyMs} ms${item.error?', '+item.error:''})`);
 }}));
 console.log(markdownReport(report));if(!report.complete||report.models.some(m=>m.passed<report.casesPerModel))process.exitCode=1;
}catch(error){console.error(['OLLAMA_BUSY','OLLAMA_UNCERTAIN','OLLAMA_OTHER_MODEL','OLLAMA_CONTROL'].includes(error.code)?error.message:'Evaluation stopped; inspect the partial report if present.');process.exitCode=1;}
