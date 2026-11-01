import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLesson,withCurrency,generatedLessonSchema,currencyStatuses} from '../public/lesson-schema.mjs';
import {lessonAuthorRequest,readLessonAuthor} from '../src/lesson-author.mjs';
import {lessonJudgeRequest} from '../src/eval/judge.mjs';
import {scoreStudioCase,loadStudioSuite,runStudioEvaluation,studioReportMarkdown} from '../src/eval/studio.mjs';
import {lessonSummary} from '../src/lessons.mjs';
import {coolingLesson} from '../test-support/generated-lessons.mjs';

const bi=(en,zh)=>({en,zh});
const today=new Date('2026-10-31T20:00:00Z');
const reply=lesson=>({structured:{name:'compose_lesson',value:{status:'ready',message:bi('Ready','就绪'),lesson}}});

test('the contract keeps a stable-or-dated mark with its date and nothing looser',()=>{
 const dated={...coolingLesson(),currency:{status:'dated',asOf:'2026-10-31'}};
 assert.deepEqual(validateLesson(dated).currency,{status:'dated',asOf:'2026-10-31'});
 assert.deepEqual(validateLesson({...coolingLesson(),currency:{status:'stable',asOf:'2026-10-31'}}).currency,{status:'stable',asOf:'2026-10-31'});
 assert.equal('currency' in validateLesson(coolingLesson()),false);
 for(const bad of ['dated',{status:'fresh',asOf:'2026-10-31'},{status:'dated'},{status:'dated',asOf:'yesterday'},{status:'dated',asOf:'2026-10-31',extra:1}])
  assert.throws(()=>validateLesson({...coolingLesson(),currency:bad}),/currency/);
 assert.deepEqual(currencyStatuses,['stable','dated']);
 const schema=withCurrency(generatedLessonSchema);
 assert.deepEqual(schema.properties.currency,{type:'string',enum:['stable','dated']});assert.ok(schema.required.includes('currency'));
 assert.equal('currency' in generatedLessonSchema.properties,false);
});

test('the author is told the date, must choose the mark, and the server stamps the date on it',()=>{
 const request=lessonAuthorRequest({topic:'Mortgage interest',creation:'generated'},'compose',{today});
 assert.match(request.instructions,/Today is 2026-10-31\. Set lesson\.currency to "stable"/);
 assert.ok(request.tools[0].parameters.properties.lesson.anyOf[0].required.includes('currency'));
 const catalog=lessonAuthorRequest({topic:'Car acceleration',creation:'catalog'},'compose',{today});
 assert.doesNotMatch(catalog.instructions,/lesson\.currency/,'catalog lessons rest on fixed experiments');
 const dated=readLessonAuthor(reply({...coolingLesson(),currency:'dated'}),'compose','generated',false,undefined,{today});
 assert.deepEqual(dated.lesson.currency,{status:'dated',asOf:'2026-10-31'});
 const stable=readLessonAuthor(reply({...coolingLesson(),currency:'stable'}),'compose','generated',false,undefined,{today});
 assert.equal(stable.lesson.currency.status,'stable');
 // A mark the contract does not know is dropped rather than failing the lesson; none is fine too.
 assert.equal('currency' in readLessonAuthor(reply({...coolingLesson(),currency:'fresh'}),'compose','generated').lesson,false);
 assert.equal('currency' in readLessonAuthor(reply(coolingLesson()),'compose','generated').lesson,false);
 // With references, sources and the mark travel together.
 const page='https://en.wikipedia.org/wiki/Carbon-14';
 const references={asOf:'2026-10-31',facts:[{statement:bi('Half-life 5700 years.','半衰期 5700 年。'),value:'5700',unit:'years',url:page,title:'Carbon-14'}]};
 const both=readLessonAuthor(reply({...coolingLesson(),sources:[page],currency:'stable'}),'compose','generated',false,references,{today});
 assert.deepEqual(both.lesson.sources,[{url:page,title:'Carbon-14'}]);assert.equal(both.lesson.currency.status,'stable');
});

test('both judges are told the date',()=>{
 const item={topic:'Mortgage interest',language:'en',category:'model'};
 const response={status:'ready',message:bi('Ready','就绪'),lesson:{...coolingLesson(),currency:{status:'dated',asOf:'2026-10-31'}}};
 const plain=lessonJudgeRequest(item,response,{today});
 assert.match(plain.instructions,/Today is 2026-10-31; a lesson marked dated/);assert.equal('webSearch' in plain,false);
 assert.match(plain.input,/"currency":\{"status":"dated","asOf":"2026-10-31"\}/);
 const grounded=lessonJudgeRequest(item,response,{grounded:true,today});
 assert.match(grounded.instructions,/Today is 2026-10-31; a lesson marked dated/);assert.match(grounded.instructions,/Before scoring factualCurrency/);
});

test('reports record the mark beside the checks and list it in the table',async()=>{
 const {suite}=loadStudioSuite('studio-current-v1');
 const item=suite.cases.find(c=>c.id==='carbon-14-en');
 const scored=scoreStudioCase(item,reply({...coolingLesson(),currency:{status:'stable',asOf:'2026-10-31'}}));
 assert.equal(scored.currency,'stable');assert.equal(scored.checks.currency,undefined,'the mark is not a check');
 assert.equal(scoreStudioCase(item,reply(coolingLesson())).currency,null);
 const report=await runStudioEvaluation({cases:[item],suite:'studio-current-v1',call:async()=>reply({...coolingLesson(),currency:{status:'dated',asOf:'2026-10-31'}})});
 const md=studioReportMarkdown(report);
 assert.match(md,/\| Currency \|/);assert.match(md,/\| dated \|/);
 const plain=await runStudioEvaluation({cases:[item],suite:'studio-current-v1',call:async()=>reply(coolingLesson())});
 assert.doesNotMatch(studioReportMarkdown(plain),/\| Currency \|/);
});

test('a saved lesson summary carries the mark for the library',()=>{
 const record={id:'0123456789abcdef',title:bi('t','t'),intro:bi('i','i'),kind:'model',lesson:{...coolingLesson(),currency:{status:'dated',asOf:'2026-10-31'}},model:'m',createdAt:1,updatedAt:2};
 assert.deepEqual(lessonSummary(record).currency,{status:'dated',asOf:'2026-10-31'});
 assert.equal(lessonSummary({...record,lesson:coolingLesson()}).currency,null);
});
