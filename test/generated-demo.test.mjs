import test from 'node:test';import assert from 'node:assert/strict';
import {coolingLesson,processLesson} from '../test-support/generated-lessons.mjs';const bi=(en,zh=en)=>({en,zh});
test('arithmetic interpreter respects precedence and rejects execution, unknown names and unbounded domains',async()=>{
 const {compileExpression,evaluateExpression,expressionBounds}=await import('../public/demo-model.mjs');
 const ast=compileExpression('-2^2 + sin(pi/2) + x/2',['x']);assert.equal(evaluateExpression(ast,{x:10}),2);
 assert.deepEqual(expressionBounds(compileExpression('x^2',['x']),{x:[-2,3]}),[0,9]);
 for(const input of ['globalThis.alert(1)','x.constructor','fetch("/")','x=1','unknown+1','sin(x,x)','1e999'])assert.throws(()=>compileExpression(input,['x']));
 for(const input of ['1/x','sqrt(x)','log(x)','exp(100*x)'])assert.throws(()=>expressionBounds(compileExpression(input,['x']),{x:[-1,1]}));
});
test('version 2 creates a new topic model with checked arithmetic, adjustable inputs and no supplied answer',async()=>{
 const {validateLesson}=await import('../public/lesson-schema.mjs');const {chapterExperiment}=await import('../public/generated-demo.mjs');
 const lesson=validateLesson(coolingLesson()),e=chapterExperiment(lesson.chapters[0],0,'en');
 assert.equal(e.generated,true);assert.equal(e.sample(0)[0],80);assert.ok(Math.abs(e.sample(1)[0]-(20+60*Math.exp(-3)))<1e-10);
 const changed=chapterExperiment(lesson.chapters[0],0,'zh',{initial:90,ambient:20,rate:.1});assert.equal(changed.sample(0)[0],90);assert.match(changed.title,/冷却/);
 assert.ok(Math.abs(e.transfer.answer-(20+70*Math.exp(-1)))<1e-10);
 assert.throws(()=>chapterExperiment(lesson.chapters[0],0,'en',{initial:999}));
 const malicious=coolingLesson();malicious.chapters[0].demo.outputs[0].expression='1/(x-12.345)';assert.throws(()=>validateLesson(malicious));
 const cyclic=coolingLesson();cyclic.chapters[0].demo.outputs[0].expression='temp+1';assert.throws(()=>validateLesson(cyclic));
 assert.deepEqual(validateLesson(JSON.parse(JSON.stringify(lesson))),lesson);
});
test('qualitative process demo remains labeled as authored rather than numerical evidence',async()=>{
 const {validateLesson}=await import('../public/lesson-schema.mjs');const {chapterExperiment}=await import('../public/generated-demo.mjs');
 const lesson=validateLesson(processLesson()),e=chapterExperiment(lesson.chapters[0],0,'zh');assert.equal(e.kind,'process');assert.equal(e.processStages.length,3);assert.equal(e.transfer.type,'choice');assert.equal(e.transfer.answer,0);assert.equal(e.metrics.length,0);
 const bad=processLesson();bad.chapters[0].demo.transfer.answer=3;assert.throws(()=>validateLesson(bad));
 const split=processLesson();split.chapters[0].demo.stages=split.chapters[0].demo.stages.flatMap(({title,detail})=>[{title},{detail}]);assert.throws(()=>validateLesson(split));
});
test('tiny generated quantities keep significant digits and do not accept zero as their transfer answer',async()=>{
 const {createLessonPlayer}=await import('../public/lesson-player.mjs');
 const tiny=coolingLesson();tiny.chapters[0].demo.outputs[0].expression='initial * 1e-12 * x';
 const p=createLessonPlayer(tiny),e=p.experiment();assert.match(e.caption(1),/e-9/);assert.match(e.result,/e-9/);
 p.predict('agree');p.next();p.scrub(1);p.next();p.next();assert.equal(p.check('0'),false);assert.equal(p.check('9e-10'),true);
});
test('a dimensionless unit, authored as "1", never appears after a number',async()=>{
 const {validateLesson}=await import('../public/lesson-schema.mjs');const {chapterExperiment}=await import('../public/generated-demo.mjs');const {shownUnit,withUnit}=await import('../public/demo-model.mjs');
 assert.equal(shownUnit('1'),'');assert.equal(shownUnit(' 1 '),'');assert.equal(shownUnit(''),'');assert.equal(shownUnit('GHz'),'GHz');
 assert.equal(withUnit('Cores = 21760','1'),'Cores = 21760');assert.equal(withUnit('Clock = 2','GHz'),'Clock = 2 GHz');
 // A throughput model: cores and operations per cycle are counts, the clock is in GHz.
 const raw=coolingLesson();const demo=raw.chapters[0].demo;
 demo.inputs=[{id:'clock',label:bi('Clock frequency','时钟频率'),unit:'GHz',min:1,max:4,step:.1,value:2},{id:'ops',label:bi('Operations per core per cycle','每核每周期运算数'),unit:'1',min:1,max:4,step:1,value:2}];
 demo.axis={label:bi('Active CUDA cores','活跃 CUDA 核心数'),unit:'1',min:1000,max:30000};
 demo.outputs=[{id:'gops',label:bi('Theoretical throughput','理论吞吐量'),unit:'GOPS',expression:'x*clock*ops'}];
 demo.transfer={question:bi('What is the throughput at the marked core count?','标记核心数处的吞吐量是多少？'),values:[{id:'clock',value:2},{id:'ops',value:3}],at:21760,output:'gops'};
 const e=chapterExperiment(validateLesson(raw).chapters[0],0,'en');
 assert.equal(e.transfer.question,'What is the throughput at the marked core count?\nClock frequency = 2 GHz · Operations per core per cycle = 3\nActive CUDA cores = 21760 → Theoretical throughput');
 assert.equal(e.axis,'Active CUDA cores');assert.ok(!e.caption(0).includes(' 1 '));assert.ok(e.caption(0).endsWith(' GOPS'));assert.ok(!/ 1( ·|$)/.test(e.result));
 assert.equal(e.transfer.answer,21760*2*3);
});
