import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {IMAGE_DATA_URL} from '../lesson-author.mjs';
import {lessonAuthorRequest,readLessonAuthor} from '../lesson-author.mjs';
import {chapterExperiment} from '../../public/generated-demo.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const near=(a,b)=>Number.isFinite(a)&&Math.abs(a-b)<=Math.max(1e-8,Math.abs(b)*1e-6);
export const studioScorerVersion='studio-score-v2';
// Post-baseline supplement: vary each previously untested cooling control.
// Keep studio-v1 fixtures and original reports unchanged.
const coolingSensitivity=[
 {controls:{initial:80,ambient:25,rate:.1},at:10,value:25+55*Math.exp(-1)},
 {controls:{initial:90,ambient:20,rate:.1},at:10,value:20+70*Math.exp(-1)}
];

// Frozen suites: studio-v1 (12 text cases) and studio-image-v1 (sketch input, image bytes hashed too).
export const studioSuites=Object.freeze({'studio-v1':{count:12},'studio-image-v1':{count:2}});
export function decodeStudioSuite(contents,expectedHash,{readImage}={}){
 if(hash(contents)!==expectedHash)throw new Error('Frozen Studio suite checksum mismatch.');
 const suite=JSON.parse(contents),spec=studioSuites[suite.version];
 if(!spec||suite.cases?.length!==spec.count||new Set(suite.cases.map(c=>c.id)).size!==spec.count)throw new Error('Invalid frozen suite.');
 for(const item of suite.cases){
  if(item.image===undefined)continue;
  if(!readImage)throw new Error('This suite needs image files.');
  const bytes=readImage(item.image);
  if(hash(bytes)!==item.imageSha256)throw new Error(`Frozen image checksum mismatch for ${item.id}.`);
  const dataUrl=`data:${item.imageType};base64,${bytes.toString('base64')}`;
  if(!IMAGE_DATA_URL.test(dataUrl))throw new Error('Unsupported image fixture.');
  item.imageDataUrl=dataUrl;
 }
 return {suite,sha256:expectedHash};
}
export function loadStudioSuite(name='studio-v1'){
 if(!studioSuites[name])throw new Error('Unknown Studio suite.');
 const raw=readFileSync(new URL(`../../eval/${name}.json`,import.meta.url),'utf8');
 const digest=readFileSync(new URL(`../../eval/${name}.sha256`,import.meta.url),'utf8').trim().split(/\s+/)[0];
 return decodeStudioSuite(raw,digest,{readImage:path=>{if(!/^images\/[a-z0-9-]+\.(png|jpg|jpeg|webp)$/.test(path))throw new Error('Image fixtures live under eval/images.');return readFileSync(new URL(`../../eval/${path}`,import.meta.url));}});
}
export function selectStudioCases(suite,filter){
 if(filter===undefined)return suite.cases;
 const ids=filter.split(',');
 if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!suite.cases.some(c=>c.id===id)))throw new Error('Choose distinct frozen case IDs.');
 return ids.map(id=>suite.cases.find(c=>c.id===id));
}
export function scoreStudioCase(item,result){
 const score={scorerVersion:studioScorerVersion,contractValid:false,automatedPass:false,checks:{},probes:[],supplementalProbes:[],manualReview:'required',reviewCriteria:item.expected.review};
 let response;
 // The rejection reason is our own validator's message, never provider text.
 try{response=readLessonAuthor(result,'compose','generated');}catch(error){return {...score,failure:'contract-rejected',reason:String(error?.message??'').slice(0,160)};}
 score.contractValid=true;score.actualStatus=response.status;score.response=response;
 const expected=item.expected;
 score.checks.status=response.status===expected.status;
 if(response.status==='ready'&&expected.status==='ready'){
  if(expected.maxChapters)score.checks.chapters=response.lesson.chapters.length<=expected.maxChapters;else score.checks.oneChapter=response.lesson.chapters.length===1;
  const chapter=response.lesson.chapters[0],demo=chapter.demo;
  score.checks.renderer=demo?.kind===expected.kind;
  if(expected.kind==='model'&&demo?.kind==='model'&&expected.inputIds){
   score.checks.inputs=[...demo.inputs.map(p=>p.id)].sort().join('|')===[...expected.inputIds].sort().join('|');
   score.checks.axis=near(demo.axis.min,expected.axis[0])&&near(demo.axis.max,expected.axis[1]);
   const metric=demo.outputs.findIndex(o=>o.id===expected.output);score.checks.output=metric>=0;
   for(const probe of expected.probes??[]){
    let actual=null;try{const e=chapterExperiment(chapter,0,item.language,probe.controls,metric);actual=e.sample((probe.at-demo.axis.min)/(demo.axis.max-demo.axis.min))[0];}catch{/* Missing or out-of-range controls fail this probe. */}
    score.probes.push({...probe,actual,pass:near(actual,probe.value)});
   }
   score.checks.probes=score.probes.every(p=>p.pass);
   if(item.pair==='cooling'){
    for(const probe of coolingSensitivity){
     let actual=null;try{const e=chapterExperiment(chapter,0,item.language,probe.controls,metric);actual=e.sample((probe.at-demo.axis.min)/(demo.axis.max-demo.axis.min))[0];}catch{/* Unsupported controls fail the supplement. */}
     score.supplementalProbes.push({...probe,actual,pass:near(actual,probe.value)});
    }
    score.checks.parameterSensitivity=score.supplementalProbes.every(p=>p.pass);
   }
   // Transfer reference is independent of the authored expression.
   if(['cooling','pendulum'].includes(item.pair))try{
    const e=chapterExperiment(chapter,0,item.language),values=Object.fromEntries(demo.transfer.values.map(v=>[v.id,v.value]));
    const answer=item.pair==='cooling'?values.ambient+(values.initial-values.ambient)*Math.exp(-values.rate*demo.transfer.at):2*Math.PI*Math.sqrt(demo.transfer.at/values.gravity);
    score.checks.transfer=demo.transfer.output===expected.output&&near(e.transfer.answer,answer);
   }catch{score.checks.transfer=false;}
  }
  // Image cases check loosely: the sketch must become a model with at least one unit-labelled output.
  if(expected.kind==='model'&&demo?.kind==='model'&&!expected.inputIds){
   score.checks.outputUnit=demo.outputs.some(o=>o.unit.trim()&&o.unit!=='1');
   if(expected.outputUnit)score.checks.expectedUnit=demo.outputs.some(o=>expected.outputUnit.includes(o.unit));
  }
 }
 score.automatedPass=Object.values(score.checks).every(Boolean);
 if(!score.automatedPass)score.failure='expectation-failed';
 return score;
}

// `samples` repeats every case N times (rows are suffixed #n) so one-off variance is visible.
export async function runStudioEvaluation({cases,call,onUpdate=async()=>{},metadata={},suite='studio-v1',samples=1}){
 if(!Number.isInteger(samples)||samples<1||samples>5)throw new Error('Choose 1–5 samples per case.');
 const report={suite,scorerVersion:studioScorerVersion,samples,startedAt:new Date().toISOString(),complete:false,planned:cases.length*samples,attempted:0,contractValid:0,automatedPassed:0,metadata,cases:[],limitations:'One sample per frozen synthetic case. No retries, repairs or model judge. Automated checks do not establish scientific validity, bilingual fluency or learning effectiveness. Manual content review is separate.'};
 await onUpdate(report);
 for(let sample=1;sample<=samples;sample++)for(const item of cases){
  const request=lessonAuthorRequest({topic:item.topic,creation:'generated',...(item.imageDataUrl?{image:item.imageDataUrl}:{})},'compose');
  const row={id:samples>1?`${item.id}#${sample}`:item.id,caseId:item.id,sample,pair:item.pair,language:item.language,category:item.category,topic:item.topic,...(item.image?{image:item.image,imageSha256:item.imageSha256}:{}),promptHash:hash(JSON.stringify({...request,images:request.images?.map(u=>hash(u))})),requestSent:false,httpStatus:null,contractValid:false,automatedPass:false,manualReview:'required',reviewCriteria:item.expected.review};
  const started=performance.now();report.attempted++;
  try{
   const result=await call({...request,onTrace:event=>{
    if(event.type==='request')row.requestSent=true;
    if(Number.isInteger(event.status))row.httpStatus=event.status;
   }});
   Object.assign(row,scoreStudioCase(item,result));
   row.model=result.model??null;
   row.usage={input:result.usage?.input_tokens??null,output:result.usage?.output_tokens??null};
  }catch{row.failure='provider-or-transport';}
  row.latencyMs=Math.round(performance.now()-started);report.cases.push(row);
  report.contractValid+=Number(row.contractValid);report.automatedPassed+=Number(row.automatedPass);
  await onUpdate(report,row);
 }
 report.complete=true;report.finishedAt=new Date().toISOString();await onUpdate(report);
 return report;
}
export function studioReportMarkdown(report){
 const judged=Boolean(report.judge);
 const lines=[`# ${report.suite} · generated lesson smoke evaluation${report.metadata?.model?` · ${report.metadata.model}`:''}`,'',report.limitations,'',`Complete: ${report.complete}. Attempted: ${report.attempted}/${report.planned}. Valid contracts: ${report.contractValid}/${report.attempted}. Automated checks passed: ${report.automatedPassed}/${report.planned}.`,'','Manual science/language review: required; not included in the automated score.',''];
 if(judged)lines.push(`Rubric judge: ${report.judge.model} (${report.judge.version}); scored ${report.judge.scored}, failed ${report.judge.failed}, skipped ${report.judge.skipped}; mean ${report.judge.meanTotal??'—'}/10. ${report.judge.note}`,'');
 lines.push(`| Case | Contract valid | Automated checks | Failure | Latency | Tokens in/out |${judged?' Judge /10 | Judge issues |':''}`,`|---|---|---|---|---|---|${judged?'---|---|':''}`);
 for(const c of report.cases)lines.push(`| ${c.id} | ${c.contractValid} | ${c.automatedPass} | ${c.failure??'—'} | ${c.latencyMs} ms | ${c.usage?.input??'—'}/${c.usage?.output??'—'} |${judged?` ${c.judge?.total??(c.judge?.failure??'—')} | ${(c.judge?.issues??[]).map(i=>i.replace(/\|/g,'/')).join('; ')||'—'} |`:''}`);
 return lines.join('\n')+'\n';
}
// Side-by-side view of the same frozen cases run against several models.
export function compareStudioReports(reports){
 const models=reports.map(r=>{const latencies=r.cases.map(c=>c.latencyMs).filter(Number.isFinite),sum=(k)=>r.cases.reduce((n,c)=>n+(c.usage?.[k]??0),0);
  return {id:r.metadata?.target??r.metadata?.model??'?',model:r.metadata?.model??'?',planned:r.planned,attempted:r.attempted,contractValid:r.contractValid,automatedPassed:r.automatedPassed,meanLatencyMs:latencies.length?Math.round(latencies.reduce((a,b)=>a+b,0)/latencies.length):null,tokens:{input:sum('input'),output:sum('output')},judgeMean:r.judge?.meanTotal??null,judgeModel:r.judge?.model??null};});
 const ids=[...new Set(reports.flatMap(r=>r.cases.map(c=>c.id)))];
 const cases=ids.map(id=>({id,results:reports.map(r=>{const c=r.cases.find(x=>x.id===id);return c?{model:r.metadata?.model??'?',contractValid:c.contractValid,automatedPass:c.automatedPass,failure:c.failure??null,latencyMs:c.latencyMs,status:c.actualStatus??null,judge:c.judge?.total??null}:null;})}));
 return {suite:reports[0]?.suite??null,comparedAt:new Date().toISOString(),models,cases,note:'Same frozen cases, one attempt per case per model, run sequentially. Differences in automated passes and rubric scores are observations from one run, not a ranking of the models.'};
}
export function studioComparisonMarkdown(comparison){
 const lines=[`# ${comparison.suite} · model comparison`,'',comparison.note,'','| Model | Attempted | Contracts | Automated | Mean latency | Tokens in/out | Judge mean /10 |','|---|---|---|---|---|---|---|'];
 for(const m of comparison.models)lines.push(`| ${m.model} | ${m.attempted}/${m.planned} | ${m.contractValid} | ${m.automatedPassed} | ${m.meanLatencyMs??'—'} ms | ${m.tokens.input}/${m.tokens.output} | ${m.judgeMean??'—'}${m.judgeModel?` (${m.judgeModel})`:''} |`);
 lines.push('',`| Case | ${comparison.models.map(m=>m.model).join(' | ')} |`,`|---|${comparison.models.map(()=>'---').join('|')}|`);
 for(const c of comparison.cases)lines.push(`| ${c.id} | ${c.results.map(r=>r?`${r.automatedPass?'pass':r.failure??'fail'} · ${r.status??'—'} · ${r.latencyMs} ms${r.judge!==null?` · judge ${r.judge}`:''}`:'—').join(' | ')} |`);
 return lines.join('\n')+'\n';
}
