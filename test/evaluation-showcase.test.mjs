import test from 'node:test';import assert from 'node:assert/strict';
import {evaluationLessons,evaluationComparisons,evaluationIds,evaluationLesson,evaluationComparison,comparisonIdFromHash,evaluationNote,evaluationModelLabel} from '../public/evaluation-lessons.mjs';
import {galleryLesson,galleryIdFromHash,galleryLessons,gallerySourceNote} from '../public/gallery-lessons.mjs';
import {validateLesson} from '../public/lesson-schema.mjs';
import {createLessonPlayer} from '../public/lesson-player.mjs';
import {loadStudioSuite} from '../src/eval/studio.mjs';
import {selection,buildShowcase,showcaseModule} from '../scripts/eval-showcase.mjs';

test('every showcase lesson validates, names its run and judge, and completes locally in both languages',()=>{
 assert.ok(evaluationLessons.length>=12);assert.equal(new Set(evaluationIds).size,evaluationIds.length);
 const {sha256}=loadStudioSuite('studio-breadth-v1');
 for(const item of evaluationLessons){
  assert.match(item.id,/^eval-[a-z-]+-(wonder|spark)$/);assert.ok(['model','process'].includes(item.kind));
  assert.equal(item.suite,'studio-breadth-v1');assert.equal(item.suiteSha256,sha256);assert.equal(item.runDate,'2026-10-31');
  assert.ok(item.question.en&&item.question.zh);assert.ok(item.checks.includes('status')&&item.checks.includes('renderer'));
  assert.ok(item.judge.total>=0&&item.judge.total<=item.judge.max&&item.judge.max===10);assert.equal(Object.keys(item.judge.scores).length,5);
  assert.ok(Array.isArray(item.judge.issues));assert.match(item.judge.model,/^muse-spark/);
  const lesson=validateLesson(item.lesson);assert.equal(lesson.chapters[0].demo.kind,item.kind);
  for(const language of ['en','zh']){
   const player=createLessonPlayer(item.lesson);
   for(let chapter=0;chapter<lesson.chapters.length;chapter++){
    const e=player.experiment(language);assert.ok(e.title&&e.claim&&e.transfer.question);
    player.predict('disagree');assert.ok(player.next());player.scrub(1);assert.ok(player.next());assert.ok(player.next());
    assert.equal(player.check(String(e.transfer.answer)),true);assert.ok(player.next());
   }
   assert.equal(player.state.stage,'complete');
  }
  const en=evaluationNote(item,'en'),zh=evaluationNote(item,'zh');
  assert.notEqual(en,zh);assert.match(en,new RegExp(`${item.model}.*${item.caseId}.*${item.judge.total}/10.*not reviewed the science`));assert.match(zh,/未审阅/);
 }
 // Both models appear, and no showcase id collides with a reviewed gallery lesson.
 assert.ok(evaluationLessons.some(l=>l.model.startsWith('muse-wonder'))&&evaluationLessons.some(l=>l.model.startsWith('muse-spark')));
 assert.ok(evaluationIds.every(id=>!galleryLessons.some(g=>g.id===id)));
 assert.equal(evaluationModelLabel('muse-wonder-1.0'),'Muse Wonder');assert.equal(evaluationModelLabel('muse-spark-1.3'),'Muse Spark');
});
test('comparisons pair both models\' replies to the same question, and deep links resolve only known cases',()=>{
 assert.ok(evaluationComparisons.length>=2);
 for(const c of evaluationComparisons){
  const [a,b]=c.ids.map(id=>evaluationLesson(id));assert.ok(a&&b);
  assert.equal(a.caseId,c.caseId);assert.equal(b.caseId,c.caseId);assert.notEqual(a.model,b.model);
  assert.match(a.model,/^muse-wonder/);assert.match(b.model,/^muse-spark/);
  assert.equal(comparisonIdFromHash(`#compare:${c.caseId}`),c.caseId);
 }
 assert.equal(comparisonIdFromHash('#compare:projectile-zh'),null);assert.equal(comparisonIdFromHash('#lesson:cooling'),null);assert.equal(comparisonIdFromHash(undefined),null);
 assert.equal(evaluationComparison('nope'),null);
});
test('showcase lessons open through the gallery links with an evaluation provenance note',()=>{
 const item=galleryLesson(evaluationIds[0]);assert.ok(item);assert.equal(item.source,'evaluation');assert.deepEqual(item.lesson,evaluationLessons[0].lesson);
 assert.equal(galleryIdFromHash(`#lesson:${evaluationIds[0]}`),evaluationIds[0]);assert.equal(galleryIdFromHash('#lesson:eval-nope-wonder'),null);
 assert.equal(galleryLesson('cooling').source,'muse');
 assert.match(gallerySourceNote('evaluation','en'),/unedited/);assert.match(gallerySourceNote('evaluation','zh'),/未经编辑/);
});
test('the generator keeps the selection honest: passing, judged replies only, questions from the frozen suite',()=>{
 const {suite}=loadStudioSuite('studio-breadth-v1');
 assert.equal(new Set(selection.map(s=>s.pair)).size,selection.length);
 for(const s of selection)assert.ok(suite.cases.some(c=>c.id===s.caseId&&c.pair===s.pair),s.caseId);
 const row=(id,model,over={})=>({id,caseId:id,pair:id.replace(/-(en|zh)$/,''),language:id.slice(-2),automatedPass:true,latencyMs:1000,usage:{input:1,output:2},checks:{status:true,renderer:true},judge:{model:'muse-spark-1.3',total:10,max:10,scores:{a:2},issues:[],summary:'ok'},response:{status:'ready',lesson:evaluationLessons[0].lesson},model,...over});
 const report=model=>({suite:'studio-breadth-v1',startedAt:'2026-10-31T07:14:09.316Z',metadata:{model,suiteHash:'x',promptVersion:'author-v3'},cases:selection.flatMap(s=>[row(s.caseId,model)])});
 const built=buildShowcase([report('muse-wonder-1.0'),report('muse-spark-1.3')],suite);
 assert.equal(built.lessons.length,selection.length+selection.filter(s=>s.compare).length);
 assert.ok(built.comparisons.every(c=>c.ids[0].endsWith('-wonder')&&c.ids[1].endsWith('-spark')));
 assert.match(showcaseModule(built),/export const evaluationLessons=Object\.freeze\(\[/);
 // A rejected or unjudged reply is refused rather than shown.
 const bad=report('muse-wonder-1.0');bad.cases[0].automatedPass=false;
 assert.throws(()=>buildShowcase([bad,report('muse-spark-1.3')],suite),/did not pass/);
 assert.throws(()=>buildShowcase([report('muse-wonder-1.0')],suite),/No report for muse-spark/);
});
