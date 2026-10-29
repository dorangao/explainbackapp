import test from 'node:test';import assert from 'node:assert/strict';
import {learnerTryoutRequest,readLearnerTryout,learnerView} from '../src/lesson-tester.mjs';
import {coolingLesson,processLesson} from '../test-support/generated-lessons.mjs';
import {chapterExperiment} from '../public/generated-demo.mjs';
const reply=(chapters,overall='Clear enough.',rating=4)=>({toolCall:{name:'try_lesson',arguments:JSON.stringify({chapters,overall,rating})}});
const chapter=(transferAnswer,extra={})=>({prediction:'agree',reason:'Hot things cool.',explanation:'The gap to room temperature shrinks, so cooling slows.',transferAnswer,confusions:[],suggestions:['Name the unit of rate.'],...extra});
test('the learner view hides the answer, hint and explanation but keeps the question and observations',()=>{
 const view=learnerView(coolingLesson(),'en');
 assert.equal(view.length,1);assert.equal(view[0].transfer.type,'number');assert.match(view[0].transfer.question,/°C/);
 assert.equal(view[0].transfer.answer,undefined);assert.equal(view[0].transfer.hint,undefined);assert.equal(view[0].explanation,undefined);
 assert.equal(view[0].observed.length,3);assert.ok(view[0].inputs.length>0);
 // Each observation names the axis value and every output with its unit.
 const keys=Object.keys(view[0].observed[2]);assert.ok(keys.length>=2);assert.ok(keys.every(k=>/\(.+\)$/.test(k)),keys.join('|'));
 assert.ok(keys.some(k=>/°C/.test(k)));
 const request=learnerTryoutRequest({lesson:coolingLesson(),language:'zh'});
 assert.match(request.instructions,/Simplified Chinese/);assert.equal(request.tools[0].name,'try_lesson');
 assert.doesNotMatch(request.input,/"answer"/);assert.doesNotMatch(request.input,/"hint"/);
 assert.throws(()=>learnerTryoutRequest({lesson:coolingLesson(),language:'fr'}));
 assert.throws(()=>learnerTryoutRequest({lesson:{version:2},language:'en'}));
});
test('numeric transfer answers are checked within tolerance and choices by index',()=>{
 const lesson=coolingLesson(),t=chapterExperiment(lesson.chapters[0],0,'en').transfer;
 const right=readLearnerTryout(reply([chapter(String(t.answer.toFixed(2)))]),lesson,'en');
 assert.equal(right.chapters[0].transfer.correct,true);assert.equal(right.chapters[0].transfer.unit,t.unit);assert.equal(right.rating,4);
 const wrong=readLearnerTryout(reply([chapter(String(t.answer*3))]),lesson,'en');
 assert.equal(wrong.chapters[0].transfer.correct,false);assert.equal(wrong.chapters[0].transfer.given,String(t.answer*3));
 assert.equal(readLearnerTryout(reply([chapter('not a number')]),lesson,'en').chapters[0].transfer.correct,false);
 const process=processLesson(),answer=process.chapters[0].demo.transfer.answer;
 const choice=readLearnerTryout(reply([chapter(String(answer))]),process,'en');
 assert.equal(choice.chapters[0].transfer.correct,true);assert.equal(choice.chapters[0].transfer.choice,process.chapters[0].demo.transfer.choices[answer].en);
 assert.equal(readLearnerTryout(reply([chapter(String((answer+1)%3))]),process,'en').chapters[0].transfer.correct,false);
});
test('malformed tryout reports are rejected',()=>{
 const lesson=coolingLesson();
 assert.throws(()=>readLearnerTryout(reply([]),lesson,'en'),/Invalid tryout report/);
 assert.throws(()=>readLearnerTryout(reply([chapter('1')],'ok',6),lesson,'en'),/Invalid tryout report/);
 assert.throws(()=>readLearnerTryout(reply([chapter('1',{prediction:'maybe'})]),lesson,'en'),/Invalid tryout chapter/);
 assert.throws(()=>readLearnerTryout(reply([chapter('1',{confusions:['a','b','c','d']})]),lesson,'en'),/Invalid tryout chapter/);
 assert.throws(()=>readLearnerTryout(reply([chapter('1',{explanation:'x'.repeat(601)})]),lesson,'en'),/Invalid tryout chapter/);
 assert.throws(()=>readLearnerTryout({toolCall:{name:'compose_lesson',arguments:'{}'}},lesson,'en'),/Unexpected tryout tool/);
});
