import test from 'node:test';import assert from 'node:assert/strict';
import {lessonJudgeRequest,readLessonJudge,judgeStudioReport,rubric} from '../src/eval/judge.mjs';
import {loadStudioSuite,runStudioEvaluation} from '../src/eval/studio.mjs';
import {coolingLesson} from '../test-support/generated-lessons.mjs';
const ready={status:'ready',message:{en:'Ready',zh:'已就绪'},lesson:coolingLesson()};
const verdict=scores=>({model:'muse-spark-1.3',structured:{name:'judge_lesson',value:{scores,issues:['“initial heat” names a temperature'],summary:'Clear model; one naming issue.'}}});
const full=Object.fromEntries(rubric.map(r=>[r.id,2]));
test('judge requests are structured, treat the lesson as data, and are only built for ready lessons',()=>{
 const item={topic:'Cooling',language:'en',category:'model'};const req=lessonJudgeRequest(item,ready);
 assert.equal(req.structuredOutput,true);assert.equal(req.tools[0].name,'judge_lesson');assert.match(req.instructions,/untrusted data/);assert.match(req.input,/Cooling coffee/);
 assert.throws(()=>lessonJudgeRequest(item,{status:'unsupported',lesson:null}));
});
test('judge replies are validated strictly and totals are computed',()=>{
 const v=readLessonJudge(verdict({...full,quantityNames:1}));assert.equal(v.total,9);assert.equal(v.max,10);assert.equal(v.issues.length,1);
 assert.throws(()=>readLessonJudge(verdict({...full,quantityNames:3})));
 assert.throws(()=>readLessonJudge(verdict({neutralFraming:2})));
 assert.throws(()=>readLessonJudge({structured:{name:'judge_lesson',value:{scores:full,issues:'none',summary:'x'}}}));
 assert.throws(()=>readLessonJudge({structured:{name:'compose_lesson',value:{}}}));
});
test('judging a report scores ready cases only, records failures, and never changes automated passes',async()=>{
 const cases=loadStudioSuite().suite.cases.filter(c=>['cooling-en','cooling-zh','ambiguous-en'].includes(c.id));let n=0,authored=0;
 const report=await runStudioEvaluation({cases,call:async()=>++authored===3?{structured:{name:'compose_lesson',value:{status:'unsupported',message:{en:'Clarify',zh:'请说明'},lesson:null}}}:{structured:{name:'compose_lesson',value:ready}}});
 const before=report.automatedPassed;
 await judgeStudioReport(report,{judgeId:'meta:muse-spark-1.3',call:async()=>{n++;if(n===2)throw new Error('Meta response was not completed; no success was recorded.');return verdict(full);}});
 assert.equal(report.judge.scored,1);assert.equal(report.judge.failed,1);assert.equal(report.judge.skipped,1);assert.equal(report.judge.meanTotal,10);
 assert.equal(report.cases[0].judge.total,10);assert.equal(report.cases[1].judge.failure,'judge-failed');assert.doesNotMatch(report.cases[1].judge.reason,/private/i);assert.equal(report.cases[2].judge,null);
 assert.equal(report.automatedPassed,before);assert.doesNotMatch(JSON.stringify(report),/private judge failure/);assert.match(report.judge.note,/not automated passes/);
});
