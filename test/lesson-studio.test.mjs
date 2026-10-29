import test from 'node:test';
import assert from 'node:assert/strict';

const bi = text => ({en:text,zh:'示例'+text});
export const sampleLesson = () => ({version:1,title:bi('Test lesson'),intro:bi('Explore a claim.'),chapters:[{experiment:'acceleration',framing:bi('Compare two cars.'),explanation:bi('Check the slope and area.')}]});

test('language review flags foreign-script contamination without forbidding legitimate subject matter',async()=>{
 const {lessonLanguageWarnings}=await import('../public/lesson-schema.mjs');
 assert.equal(typeof lessonLanguageWarnings,'function');
 const lesson=sampleLesson();assert.deepEqual(lessonLanguageWarnings(lesson),[]);
 lesson.chapters[0].framing.zh='咖啡却 долго在室温附近徘徊。';
 assert.deepEqual(lessonLanguageWarnings(lesson),['chapters.0.framing.zh']);
 lesson.chapters[0].framing.zh='热量 Q 与温差 ΔT 有关，k 的单位为 1/min。';
 assert.deepEqual(lessonLanguageWarnings(lesson),[]);
});

test('lesson contract accepts bilingual lessons and rejects arbitrary operations, oversized content and missing translations',async()=>{
 const {validateLesson}=await import('../public/lesson-schema.mjs');
 const lesson=sampleLesson();assert.deepEqual(validateLesson(lesson),lesson);
 for(const bad of [{...lesson,script:'run()'},{...lesson,version:999},{...lesson,chapters:[]},{...lesson,title:{en:'Missing Chinese'}},{...lesson,title:bi('a'.repeat(81))},{...lesson,chapters:[{...lesson.chapters[0],experiment:'execute_script'}]}])assert.throws(()=>validateLesson(bad));
 const copy=validateLesson(lesson);copy.title.en='changed';assert.equal(lesson.title.en,'Test lesson');
});
test('lesson adapters use checked math for acceleration, landing, suction and quantum outcomes',async()=>{
 const {lessonExperiment}=await import('../public/lesson-experiments.mjs');
 const acceleration=lessonExperiment('acceleration',0,'en');
 assert.ok(Math.abs(acceleration.metrics[0].value-13.4112)<1e-7);
 assert.ok(Math.abs(acceleration.metrics[1].value-8.9408)<1e-7);
 const landing=lessonExperiment('landing',0,'en');
 assert.ok(Math.abs(landing.metrics[0].value-(2000*9.80665+2*2000*(9.80665*1.5/2)/.15)/1000)<1e-8);
 const suction=lessonExperiment('suction',0,'en');assert.equal(suction.sample(1)[0],24000/1000-2000*9.80665/1000);
 const phase=lessonExperiment('interference',0,'en');assert.ok(phase.sample(1)[1]>99.9999999);
 const zero=lessonExperiment('interference',1,'en');assert.ok(zero.sample(1)[0]>99.9999999);
 for(const id of ['acceleration','roll','landing','suction','qubit','interference','entanglement','search'])for(const language of ['en','zh']){
  const e=lessonExperiment(id,0,language);assert.ok(e.claim&&e.assumptions&&e.result);assert.ok(e.sample(.5).every(Number.isFinite));assert.ok(Number.isFinite(e.transfer.answer));
 }
 assert.throws(()=>lessonExperiment('script',0,'en'));assert.throws(()=>lessonExperiment('roll',999,'en'));
});
test('each transfer requires a changed case rather than copying a displayed final metric',async()=>{
 const {lessonExperiment}=await import('../public/lesson-experiments.mjs');
 for(const id of ['acceleration','roll','landing','suction','qubit','interference','entanglement','search'])for(const variant of [0,1]){
  const e=lessonExperiment(id,variant,'en');assert.ok([...e.metrics.map(m=>m.value),...(e.reference??[])].every(value=>Math.abs(value-e.transfer.answer)>.001),id);
 }
});
test('player requires prediction and completed experiment, checks transfer and resets evidence when variant changes',async()=>{
 const {createLessonPlayer}=await import('../public/lesson-player.mjs');
 const p=createLessonPlayer(sampleLesson());
 assert.equal(p.next(),false);p.predict('agree');assert.equal(p.next(),true);assert.equal(p.state.stage,'experiment');
 assert.equal(p.next(),false);p.scrub(1);assert.equal(p.next(),true);assert.equal(p.state.stage,'explain');
 p.next();assert.equal(p.state.stage,'transfer');assert.equal(p.check(''),null);assert.equal(p.check('wrong'),null);assert.equal(p.check('0'),false);assert.equal(p.next(),false);
 assert.equal(p.check('18'),true);assert.equal(p.next(),true);assert.equal(p.state.stage,'complete');
 p.restart();p.predict('disagree');p.next();p.scrub(1);p.variant(1);assert.equal(p.state.progress,0);assert.equal(p.state.stage,'predict');assert.equal(p.state.prediction,null);
});
