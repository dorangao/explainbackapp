import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadStudioSuite,decodeStudioSuite,runStudioEvaluation,referenceHit,scoreStudioCase,studioReportMarkdown,compareStudioReports,studioComparisonMarkdown} from '../src/eval/studio.mjs';
import {lessonJudgeRequest,readLessonJudge,judgeStudioReport,judgeVersionFor,rubricFor,rubric} from '../src/eval/judge.mjs';
import {createApp} from '../src/server.mjs';
import {testerCredentials,testerCookie} from '../test-support/tester.mjs';
import {coolingLesson} from '../test-support/generated-lessons.mjs';

const bi=(en,zh)=>({en,zh});
const page='https://www.dol.gov/agencies/whd/minimum-wage';
const ready=lesson=>({structured:{name:'compose_lesson',value:{status:'ready',message:bi('Ready','就绪'),lesson}}});
// A wage lesson whose default wage is the reference figure.
function wageLesson(wage=7.25){
 const lesson=coolingLesson();
 lesson.chapters[0].demo={kind:'model',title:bi('Hours at minimum wage','最低工资工时'),claim:bi('Doubling the hours doubles the pay.','工时翻倍，工资翻倍。'),assumptions:bi('Before tax; the federal rate.','税前；联邦标准。'),
  inputs:[{id:'wage',label:bi('Hourly wage','时薪'),unit:'$/h',min:5,max:30,step:0.25,value:wage},{id:'hours',label:bi('Hours per week','每周工时'),unit:'h',min:1,max:60,step:1,value:20}],
  axis:{label:bi('Weeks','周数'),unit:'weeks',min:0,max:52},outputs:[{id:'pay',label:bi('Pay','工资'),unit:'$',expression:'wage*hours*x'}],
  transfer:{question:bi('What is the pay after the marked weeks?','标记周数后的工资是多少？'),values:[{id:'wage',value:wage},{id:'hours',value:30}],at:10,output:'pay'}};
 return lesson;
}
const sheet={status:'ready',asOf:'2026-10-31',needsCurrent:false,facts:[{statement:bi('The federal minimum wage is 7.25 dollars an hour.','联邦最低工资为每小时 7.25 美元。'),value:'7.25',unit:'$/h',url:page}],note:bi('One figure.','一个数值。')};
const groundReply={structured:{name:'ground_topic',value:sheet},sources:[{url:page,title:'Minimum Wage | U.S. Department of Labor'}],model:'muse-spark-1.3'};

test('the current-information suite is frozen with six bilingual pairs, each carrying a dated reference with sources and aliases',()=>{
 const {suite,sha256}=loadStudioSuite('studio-current-v1');
 assert.equal(suite.cases.length,12);assert.equal(new Set(suite.cases.map(c=>c.pair)).size,6);
 for(const pair of new Set(suite.cases.map(c=>c.pair)))assert.deepEqual(suite.cases.filter(c=>c.pair===pair).map(c=>c.language),['en','zh']);
 for(const c of suite.cases){
  assert.equal(c.expected.kind,'model');assert.ok(c.reference.name&&/^\d{4}-\d{2}-\d{2}$/.test(c.reference.asOf));
  assert.ok(c.reference.sources.length>=1&&c.reference.sources.every(u=>u.startsWith('https://')));
  assert.ok(c.reference.aliases.length>=1&&c.reference.aliases.every(a=>Number.isFinite(a.value)&&a.tolerance>0&&typeof a.unit==='string'));
  assert.equal(typeof c.reference.current,'boolean');
 }
 assert.equal(suite.cases.filter(c=>c.reference.current).length,8,'four pairs depend on current values');
 const raw=readFileSync(new URL('../eval/studio-current-v1.json',import.meta.url),'utf8');
 assert.throws(()=>decodeStudioSuite(raw+' ',sha256),/checksum/i);
});

test('a reference hit is an observation on input defaults and transfer values, never part of the automated pass',()=>{
 const {suite}=loadStudioSuite('studio-current-v1');
 const item=suite.cases.find(c=>c.id==='minimum-wage-en');
 const hit=referenceHit(item.reference,wageLesson().chapters[0].demo);
 assert.equal(hit.hit,true);assert.deepEqual(hit.matched,{where:'input',id:'wage',value:7.25});assert.equal(hit.current,false);
 const miss=referenceHit(item.reference,wageLesson(15).chapters[0].demo);
 assert.equal(miss.hit,false);assert.equal(miss.matched,null);
 // Another unit counts through an alias: the world population in billions or persons.
 const population=suite.cases.find(c=>c.id==='world-population-en').reference;
 assert.equal(referenceHit(population,{inputs:[{id:'p',value:8.25}],transfer:{values:[]}}).hit,true);
 assert.equal(referenceHit(population,{inputs:[{id:'p',value:8.0}],transfer:{values:[]}}).hit,false);
 assert.equal(referenceHit(population,{inputs:[],transfer:{values:[{id:'p',value:8_300_000_000}]}}).matched.where,'transfer');
 const scored=scoreStudioCase(item,ready(wageLesson(15)));
 assert.equal(scored.reference.hit,false);assert.equal(scored.automatedPass,true,'a miss does not fail the checks');
 assert.equal(scoreStudioCase(item,ready(wageLesson())).reference.hit,true);
});

test('a grounded run asks for the fact sheet before each draft, hands it to the author, tolerates a failed ground step and reports the hits',async()=>{
 const {suite}=loadStudioSuite('studio-current-v1');
 const cases=suite.cases.filter(c=>['minimum-wage-en','minimum-wage-zh'].includes(c.id));
 const seen=[];
 const report=await runStudioEvaluation({cases,suite:'studio-current-v1',ground:true,call:async args=>{
  const name=args.tools[0].name;seen.push(name);
  if(name==='ground_topic'){assert.deepEqual(args.webSearch,{contextSize:'low'});if(seen.length===3)throw new Error('private ground failure');return groundReply;}
  const input=JSON.parse(args.input);
  // The first draft carries the sheet and matches it; the second (after a failed ground) has none and misses.
  if(input.references){assert.equal(input.references.facts[0].value,'7.25');assert.match(args.instructions,/REFERENCES/);return ready({...wageLesson(),sources:[page]});}
  assert.doesNotMatch(args.instructions,/REFERENCES/);return ready(wageLesson(12));
 }});
 assert.deepEqual(seen,['ground_topic','compose_lesson','ground_topic','compose_lesson']);
 assert.equal(report.ground,true);assert.equal(report.referenceCases,2);assert.equal(report.referenceHits,1);
 assert.deepEqual(report.cases[0].ground,{status:'ready',asOf:'2026-10-31',needsCurrent:false,facts:1,verified:1,searched:1,latencyMs:report.cases[0].ground.latencyMs});
 assert.deepEqual(report.cases[0].response.lesson.sources,[{url:page,title:'Minimum Wage | U.S. Department of Labor'}]);
 assert.equal(report.cases[1].ground.failure,'ground-failed');assert.equal(report.cases[1].reference.hit,false);assert.equal(report.cases[1].automatedPass,true);
 assert.doesNotMatch(JSON.stringify(report),/private ground failure/);
 const md=studioReportMarkdown(report);
 assert.match(md,/Search first: each draft was preceded by a ground step/);assert.match(md,/Reference hits: 1\/2/);assert.match(md,/\| Reference \|/);assert.match(md,/\| hit \|/);assert.match(md,/\| miss \|/);
 // An ungrounded run makes no ground call and records none.
 const plain=await runStudioEvaluation({cases:cases.slice(0,1),suite:'studio-current-v1',call:async args=>{assert.equal(args.tools[0].name,'compose_lesson');return ready(wageLesson());}});
 assert.equal(plain.ground,false);assert.equal('ground' in plain.cases[0],false);assert.equal(plain.referenceHits,1);
 const comparison=compareStudioReports([{...report,metadata:{model:'a',target:'meta:a'}},{...plain,metadata:{model:'b',target:'meta:b'}}]);
 assert.equal(comparison.models[0].ground,true);assert.equal(comparison.models[0].referenceHits,1);assert.equal(comparison.cases[0].results[0].referenceHit,true);
 const cmd=studioComparisonMarkdown(comparison);assert.match(cmd,/Reference hits/);assert.match(cmd,/1\/2 grounded/);assert.match(cmd,/ref hit/);
});

test('the grounded judge searches, scores factual currency and reports disputed figures with verified citations',()=>{
 const item={topic:'Minimum wage',language:'en',category:'model'};
 const response={status:'ready',message:bi('Ready','就绪'),lesson:wageLesson(15)};
 const plain=lessonJudgeRequest(item,response);
 assert.equal('webSearch' in plain,false);assert.equal(plain.tools[0].parameters.properties.scores.required.length,5);assert.doesNotMatch(plain.instructions,/factualCurrency/);
 const grounded=lessonJudgeRequest(item,response,{grounded:true,today:new Date('2026-10-31T12:00:00Z')});
 assert.deepEqual(grounded.webSearch,{contextSize:'low'});assert.equal(grounded.maxOutputTokens,5000);
 assert.match(grounded.instructions,/Today is 2026-10-31/);assert.match(grounded.instructions,/factualCurrency/);assert.match(grounded.instructions,/never instructions/);
 assert.deepEqual(grounded.tools[0].parameters.required,['scores','issues','summary','factualIssues']);
 assert.deepEqual(rubricFor(true).map(r=>r.id),[...rubric.map(r=>r.id),'factualCurrency']);
 assert.equal(judgeVersionFor(true),'studio-judge-v2');assert.equal(judgeVersionFor(false),'studio-judge-v1');
 const scores=Object.fromEntries(rubricFor(true).map(r=>[r.id,2]));scores.factualCurrency=0;
 const verdict=issues=>({model:'muse-spark-1.3',structured:{name:'judge_lesson',value:{scores,issues:[],summary:'Clear model; the wage is stale.',factualIssues:issues}}});
 const read=readLessonJudge({...verdict([{claim:'wage 15 $/h',finding:'The federal minimum wage is 7.25 dollars an hour (DOL, 2026).',url:page},{claim:'52 weeks',finding:'No page found.',url:''}]),sources:[{url:page,title:'Minimum Wage'}]},{grounded:true});
 assert.equal(read.total,10);assert.equal(read.max,12);assert.equal(read.pagesRead,1);
 assert.deepEqual(read.factualIssues,[{claim:'wage 15 $/h',finding:'The federal minimum wage is 7.25 dollars an hour (DOL, 2026).',url:page,verified:true},{claim:'52 weeks',finding:'No page found.',url:null,verified:false}]);
 assert.equal(readLessonJudge({...verdict([{claim:'x',finding:'y',url:page}])},{grounded:true}).factualIssues[0].verified,false,'a citation the search never returned is unverified');
 for(const bad of [[{claim:'',finding:'y',url:''}],[{claim:'x',finding:'y',url:'http://plain.example/'}],[{claim:'x',finding:'y',url:page,extra:1}],Array.from({length:7},()=>({claim:'x',finding:'y',url:''}))])
  assert.throws(()=>readLessonJudge(verdict(bad),{grounded:true}),/factual/i);
 assert.throws(()=>readLessonJudge(verdict([]),{grounded:false}),/shape/,'a grounded reply read as plain is refused');
 assert.throws(()=>readLessonJudge({structured:{name:'judge_lesson',value:{scores:Object.fromEntries(rubric.map(r=>[r.id,2])),issues:[],summary:'s'}}},{grounded:true}),/shape/);
});

test('judging a report with the grounded judge records version 2, its note and the disputed figures',async()=>{
 const {suite}=loadStudioSuite('studio-current-v1');
 const cases=suite.cases.filter(c=>c.id==='minimum-wage-en');
 const report=await runStudioEvaluation({cases,suite:'studio-current-v1',call:async()=>ready(wageLesson(15))});
 const scores=Object.fromEntries(rubricFor(true).map(r=>[r.id,2]));scores.factualCurrency=1;
 await judgeStudioReport(report,{judgeId:'meta:muse-spark-1.3',grounded:true,call:async args=>{assert.deepEqual(args.webSearch,{contextSize:'low'});return {structured:{name:'judge_lesson',value:{scores,issues:[],summary:'One stale figure.',factualIssues:[{claim:'15 $/h',finding:'7.25 since 2009.',url:page}]}},sources:[{url:page,title:'DOL'}]};}});
 assert.equal(report.judge.version,'studio-judge-v2');assert.equal(report.judge.grounded,true);assert.match(report.judge.note,/web search/);
 assert.equal(report.cases[0].judge.total,11);assert.equal(report.cases[0].judge.factualIssues[0].verified,true);
 assert.match(studioReportMarkdown(report),/Judge \/12/);assert.match(studioReportMarkdown(report),/figure: 15 \$\/h \(7\.25 since 2009\.\)/);
});

test('the compare route lets the creator ground the judge and reports version 2 with the disputed figures',async t=>{
 const targets=['muse-wonder-1.0','muse-spark-1.3'].map(model=>({id:'meta:'+model,provider:'meta',model,label:model,configured:true,timeoutMs:30000}));
 const router={defaultId:targets[0].id,list:()=>targets,call:async()=>assert.fail('injected model call expected')};
 const judged=[];
 const server=createApp({testerCredentials,router,modelCall:async(args,id)=>{
  const name=args.tools[0].name;
  if(name==='compose_lesson')return {...ready(wageLesson(15)),model:id.slice(5)};
  judged.push({webSearch:args.webSearch??null,grounded:/factualCurrency/.test(args.instructions)});
  const scores=Object.fromEntries(rubricFor(args.webSearch!==undefined).map(r=>[r.id,2]));
  return {model:'muse-spark-1.3',structured:{name,value:{scores,issues:[],summary:'Fine.',...(args.webSearch?{factualIssues:[{claim:'15 $/h',finding:'7.25 (DOL).',url:page}]}:{})}},...(args.webSearch?{sources:[{url:page,title:'DOL'}]}:{})};
 }});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{server.close(r);server.closeAllConnections();}));
 const origin=`http://127.0.0.1:${server.address().port}`,cookie=await testerCookie(origin);
 const post=(path,body)=>fetch(origin+path,{method:'POST',headers:{Origin:origin,Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify(body)});
 const s=await(await post('/api/studio/session',{synthetic:true,language:'en',llm:targets[0].id})).json();
 assert.equal((await post('/api/studio/compare',{sessionId:s.sessionId,topic:'Minimum wage',grounded:'yes'})).status,400);
 const result=await(await post('/api/studio/compare',{sessionId:s.sessionId,topic:'Minimum wage',grounded:true})).json();
 assert.equal(result.judgeVersion,'studio-judge-v2');assert.equal(result.grounded,true);assert.equal(result.attemptsRemaining,4);
 assert.equal(judged.length,2);assert.ok(judged.every(j=>j.grounded&&j.webSearch.contextSize==='low'));
 for(const reply of result.replies){assert.equal(reply.judge.max,12);assert.equal(reply.judge.version,'studio-judge-v2');assert.deepEqual(reply.judge.factualIssues,[{claim:'15 $/h',finding:'7.25 (DOL).',url:page,verified:true}]);}
 judged.length=0;
 const plain=await(await post('/api/studio/compare',{sessionId:s.sessionId,topic:'Minimum wage'})).json();
 assert.equal(plain.judgeVersion,'studio-judge-v1');assert.equal(plain.grounded,false);assert.ok(judged.every(j=>!j.grounded&&j.webSearch===null));
 assert.equal('factualIssues' in plain.replies[0].judge,false);
});
