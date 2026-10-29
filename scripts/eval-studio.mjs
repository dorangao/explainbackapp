import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createProviderRouter} from '../src/llm/index.mjs';
import {loadStudioSuite,selectStudioCases,runStudioEvaluation,studioReportMarkdown,compareStudioReports,studioComparisonMarkdown,studioSuites} from '../src/eval/studio.mjs';
import {judgeStudioReport} from '../src/eval/judge.mjs';
import {authorPromptVersion} from '../src/lesson-author.mjs';
// Usage: npm run eval:studio -- [--live] [--suite=studio-v1|studio-image-v1] [--cases=ID,ID]
//        [--models=meta:muse-spark-1.3,meta:muse-wonder-1.0] [--judge=meta:muse-spark-1.3]
// Without --live nothing is sent. Each model runs the same frozen cases sequentially, one
// attempt per case, no retries. --judge adds a separate rubric score from the named model.
const args=process.argv.slice(2),option=name=>args.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const known=['--live','--suite','--cases','--models','--judge','--samples'];
if(args.some(a=>!known.includes(a.split('=')[0]))||new Set(args.map(a=>a.split('=')[0])).size!==args.length)throw new Error('Options: --live, --suite=NAME, --cases=ID,ID, --models=ID,ID, --judge=ID, --samples=N.');
const samples=Number(option('samples')??1);if(!Number.isInteger(samples)||samples<1||samples>5)throw new Error('--samples must be 1–5.');
const suiteName=option('suite')??'studio-v1';if(!studioSuites[suiteName])throw new Error(`Unknown suite. Choose ${Object.keys(studioSuites).join(' or ')}.`);
const {suite,sha256}=loadStudioSuite(suiteName),cases=selectStudioCases(suite,option('cases'));
const modelIds=(option('models')??'meta:muse-spark-1.3').split(',').map(s=>s.trim()).filter(Boolean),judgeId=option('judge');
if(!modelIds.length||modelIds.length>4||new Set(modelIds).size!==modelIds.length||[...modelIds,...(judgeId?[judgeId]:[])].some(id=>!id.startsWith('meta:')))throw new Error('Choose one to four distinct meta:* models (and an optional meta:* judge). Ollama is not used for Studio evaluation.');
console.log(`${suite.version} · ${sha256}\n${cases.map(c=>c.id).join('\n')}\nmodels: ${modelIds.join(', ')}${judgeId?` · judge: ${judgeId}`:''} · samples: ${samples}`);
if(args.includes('--live')){
 const metaModels=[...new Set([...modelIds,...(judgeId?[judgeId]:[])].map(id=>id.slice(5)))];
 const router=createProviderRouter({env:{...process.env,EXPLAINBACK_PROVIDERS:'meta',EXPLAINBACK_DEFAULT_MODEL:modelIds[0],EXPLAINBACK_META_MODELS:metaModels.join(',')}});
 for(const id of [...modelIds,...(judgeId?[judgeId]:[])])if(!router.get(id).configured)throw new Error('Meta is not configured. No calls made.');
 const directory=new URL(`../output/eval/${suiteName}-${new Date().toISOString().replaceAll(':','-')}-${randomUUID().slice(0,8)}/`,import.meta.url);
 await mkdir(directory,{recursive:true,mode:0o700});
 const scorerHash=createHash('sha256').update(readFileSync(new URL('../src/eval/studio.mjs',import.meta.url))).digest('hex');
 const judgeHash=createHash('sha256').update(readFileSync(new URL('../src/eval/judge.mjs',import.meta.url))).digest('hex');
 const reports=[];
 for(const id of modelIds){
  const target=router.get(id),folder=new URL(`${target.model}/`,directory);await mkdir(folder,{recursive:true,mode:0o700});
  const metadata={suiteHash:sha256,scorerHash,judgeHash:judgeId?judgeHash:null,promptVersion:authorPromptVersion,provider:'meta',model:target.model,target:id,judge:judgeId??null,retryCount:0};
  const save=async report=>{await writeFile(new URL('report.json',folder),JSON.stringify(report,null,2)+'\n',{mode:0o600});await writeFile(new URL('report.md',folder),studioReportMarkdown(report),{mode:0o600});};
  console.log(`\n== ${id} ==`);
  const report=await runStudioEvaluation({cases,suite:suiteName,samples,call:args=>router.call(id,args),metadata,onUpdate:async(report,row)=>{await save(report);if(row)console.log(`${row.id}: ${row.automatedPass?'CHECKS PASS':row.failure} · ${row.latencyMs} ms`);}});
  if(judgeId)await judgeStudioReport(report,{call:args=>router.call(judgeId,args),judgeId,onUpdate:async(report,row)=>{await save(report);if(row)console.log(`${row.id}: judge ${row.judge?.total??row.judge?.failure??'skipped'}`);}});
  reports.push(report);
 }
 const comparison=compareStudioReports(reports);
 await writeFile(new URL('comparison.json',directory),JSON.stringify(comparison,null,2)+'\n',{mode:0o600});
 await writeFile(new URL('comparison.md',directory),studioComparisonMarkdown(comparison),{mode:0o600});
 console.log('\n'+studioComparisonMarkdown(comparison));console.log('Local reports:',directory.pathname);
 if(reports.some(r=>!r.complete||r.automatedPassed!==r.planned))process.exitCode=1;
}
