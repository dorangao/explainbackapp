import test from 'node:test';
import assert from 'node:assert/strict';
import {lessonAuthorRequest,readLessonAuthor} from '../src/lesson-author.mjs';
import {learnerTryoutRequest,readLearnerTryout} from '../src/lesson-tester.mjs';
import {groundRequest,readGround} from '../src/lesson-ground.mjs';
import {validateDemo} from '../public/demo-model.mjs';
import {demoSchema} from '../public/demo-model.mjs';
import {chapterExperiment} from '../public/generated-demo.mjs';
import {coolingLesson,processLesson} from '../test-support/generated-lessons.mjs';

test('author response schemas tell the decoder the same text limits the reader enforces',()=>{
 for(const creation of ['catalog','generated']){
  const schema=lessonAuthorRequest({topic:'Oscillation',creation},'compose').tools[0].parameters.properties;
  const lesson=schema.lesson.anyOf[0].properties,chapter=lesson.chapters.items.properties;
  for(const [field,limit] of [[schema.message,300],[lesson.title,80],[lesson.intro,200],[chapter.framing,180],[chapter.explanation,260]]){
   for(const language of ['en','zh']){
    assert.equal(field.properties[language].minLength,1);
    assert.equal(field.properties[language].maxLength,limit);
   }
  }
 }
 const draft=coolingLesson();draft.intro.en='a'.repeat(201);
 assert.throws(()=>readLessonAuthor({structured:{name:'compose_lesson',value:{status:'ready',message:{en:'Ready',zh:'就绪'},lesson:draft}}},'compose','generated'),/intro.*200/);
});

test('numeric and process demo schemas carry their existing text and collection bounds',()=>{
 const [model,process]=demoSchema.anyOf.map(s=>s.properties);
 for(const [field,limit] of [[model.title,80],[model.claim,180],[model.assumptions,700],[model.inputs.items.properties.label,60],[model.axis.properties.label,60],[model.outputs.items.properties.label,60],[model.transfer.properties.question,200],[process.stages.items.properties.title,80],[process.stages.items.properties.detail,240],[process.transfer.properties.choices.items,120],[process.transfer.properties.rationale,240]]){
  for(const language of ['en','zh'])assert.equal(field.properties[language].maxLength,limit);
 }
 assert.equal(model.inputs.maxItems,4);assert.equal(model.outputs.maxItems,3);
 assert.equal(process.stages.minItems,3);assert.equal(process.stages.maxItems,6);
 assert.equal(process.transfer.properties.choices.minItems,3);assert.equal(process.transfer.properties.choices.maxItems,3);
 assert.equal(model.outputs.items.properties.expression.maxLength,180);
});

test('tryout response schema bounds fields to the reader limits and fixes the chapter count',()=>{
 const one=learnerTryoutRequest({lesson:coolingLesson(),language:'en'}).tools[0].parameters.properties;
 const two=learnerTryoutRequest({lesson:{...coolingLesson(),chapters:[coolingLesson().chapters[0],processLesson().chapters[0]]},language:'en'}).tools[0].parameters.properties;
 assert.equal(two.chapters.minItems,2);assert.equal(two.chapters.maxItems,2);
 // Building a later request leaves the earlier schema untouched.
 assert.equal(one.chapters.minItems,1);assert.equal(one.chapters.maxItems,1);
 const chapter=one.chapters.items.properties;
 for(const [field,limit] of [[chapter.reason,300],[chapter.explanation,600],[chapter.confusions.items,200],[chapter.suggestions.items,200],[one.overall,400]]){
  assert.equal(field.minLength,1);assert.equal(field.maxLength,limit);
 }
 assert.equal(chapter.confusions.maxItems,3);assert.equal(chapter.suggestions.maxItems,3);
 assert.equal(chapter.transferAnswer.minLength,1);assert.equal(chapter.transferAnswer.maxLength,undefined);
 // The reader still enforces the same limits on decoded replies.
 const lesson=coolingLesson(),ok={prediction:'agree',reason:'Fine.',explanation:'Fine.',transferAnswer:'1',confusions:[],suggestions:[]};
 const report=(chapters,overall='Clear enough.')=>({structured:{name:'try_lesson',value:{chapters,overall,rating:4}}});
 assert.throws(()=>readLearnerTryout(report([ok],'   '),lesson,'en'),/Invalid tryout report/);
 assert.throws(()=>readLearnerTryout(report([{...ok,confusions:['x'.repeat(201)]}]),lesson,'en'),/Invalid tryout chapter/);
 assert.throws(()=>readLearnerTryout(report([ok,ok]),lesson,'en'),/Invalid tryout report/);
});

test('guide response schemas bound explanation and follow-up to the reader limits',()=>{
 const body={lesson:coolingLesson(),chapter:0,variant:0,language:'en',prediction:'agree',controls:{},metric:0};
 const plain=lessonAuthorRequest(body,'guide').tools[0].parameters.properties;
 const assessed=lessonAuthorRequest({...body,explanation:'It cools faster at first.'},'guide').tools[0].parameters.properties;
 for(const field of [plain.explanation,assessed.explanation]){assert.equal(field.minLength,1);assert.equal(field.maxLength,1000);}
 assert.equal(assessed.followUp.minLength,1);assert.equal(assessed.followUp.maxLength,300);
 const reply=value=>({structured:{name:'guide_lesson',value}});
 assert.throws(()=>readLessonAuthor(reply({verdict:'supported',explanation:'x'.repeat(1001),followUp:'Why?',nextAction:'replay'}),'guide','catalog',true),/Invalid guide action/);
 assert.throws(()=>readLessonAuthor(reply({verdict:'supported',explanation:'Close.',followUp:'x'.repeat(301),nextAction:'replay'}),'guide','catalog',true),/Invalid assessment/);
});

const fact=()=>({statement:{en:'A dimensionless ratio.',zh:'无量纲比值。'},value:'1',unit:'1',url:'https://example.org/reference'});
const sheet=f=>({structured:{name:'ground_topic',value:{status:'ready',asOf:'2026-11-01',needsCurrent:false,facts:[f],note:{en:'A reference figure.',zh:'参考数值。'}}}});
test('grounding response schema bounds fields before decoding, without weakening validation',()=>{
 const schema=groundRequest({topic:'Ratios'}).tools[0].parameters.properties;
 const fields=schema.facts.items.properties;
 for(const [field,limit] of [[fields.statement.properties.en,200],[fields.statement.properties.zh,200],[fields.value,40],[fields.unit,24],[fields.url,300],[schema.note.properties.en,300]]){
  assert.equal(field.minLength,1);assert.equal(field.maxLength,limit);
 }
 assert.equal(schema.facts.maxItems,6);
 assert.equal(fields.url.pattern,'^https://');
 assert.equal(readGround(sheet(fact())).facts[0].value,'1');
});

test('grounding rejections name the offending field without echoing untrusted content',()=>{
 const cases=[
  [{...fact(),statement:{en:'x'.repeat(201),zh:'数值。'}},/fact 1 statement.*200/i],
  [{...fact(),value:'x'.repeat(41)},/fact 1 value.*40/i],
  [{...fact(),unit:''},/fact 1 unit.*24/i],
  [{...fact(),url:'https://user:private-value@example.org/'},/fact 1 url.*https/i],
 ];
 for(const [value,reason] of cases)assert.throws(()=>readGround(sheet(value)),error=>{
  assert.match(error.message,reason);assert.doesNotMatch(error.message,/private-value|x{20}/);return true;
 });
});

// Synthetic damped oscillator; the denominator cannot vanish when damping and
// natural frequency are positive, even when the frequency axis includes zero.
function oscillator(){
 const demo=coolingLesson().chapters[0].demo;
 demo.inputs=[
  {id:'freq',label:{en:'Natural frequency',zh:'固有频率'},unit:'Hz',min:.5,max:3,step:.1,value:1.5},
  {id:'damping',label:{en:'Damping ratio',zh:'阻尼比'},unit:'1',min:.05,max:1,step:.05,value:.1},
 ];
 demo.axis={label:{en:'Driving frequency',zh:'驱动频率'},unit:'Hz',min:0,max:4};
 demo.outputs=[{id:'amplitude',label:{en:'Relative amplitude',zh:'相对振幅'},unit:'1',expression:'1/sqrt((1-(x/freq)^2)^2+(2*damping*x/freq)^2)'}];
 demo.transfer={question:{en:'Find the relative amplitude.',zh:'求相对振幅。'},values:[{id:'freq',value:1.5},{id:'damping',value:.2}],at:1.5,output:'amplitude'};
 return demo;
}
test('range validation proves a damped resonance spanning zero without changing the formula or ranges',()=>{
 const demo=oscillator(),validated=validateDemo(demo);
 assert.deepEqual(validated,demo);
 const chapter={...coolingLesson().chapters[0],demo:validated};
 const experiment=chapterExperiment(chapter,0,'en');
 assert.equal(experiment.sample(0)[0],1);
 assert.ok(Math.abs(experiment.sample(1.5/4)[0]-5)<1e-10);
 assert.ok(experiment.sample(1)[0]<1);
 assert.ok(Math.abs(experiment.transfer.answer-2.5)<1e-10);
});
test('refined range validation still rejects actual singularities and invalid domains between sample points',()=>{
 const undamped=oscillator();undamped.inputs[1].min=0;
 assert.throws(()=>validateDemo(undamped),/division by zero/);
 for(const expression of ['1/(x-1.23456789)','sqrt(x-0.001)','log(x)','1/sqrt((x-1.23456789)^2)']){
  const demo=oscillator();demo.outputs[0].expression=expression;
  assert.throws(()=>validateDemo(demo));
 }
});
