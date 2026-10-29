import test from 'node:test';
import assert from 'node:assert/strict';
import {areaFromHash,studioWalkthrough} from '../public/studio-showcase.mjs';
test('Studio is the entry while explicit physics and quantum routes remain available',()=>{
 assert.equal(areaFromHash(''),'studio');assert.equal(areaFromHash('#studio'),'studio');
 assert.equal(areaFromHash('#physics'),'physics');assert.equal(areaFromHash('#quantum'),'quantum');
 assert.equal(areaFromHash('#unknown'),'studio');
});
test('walkthrough has three concise bilingual steps and renderer-specific editable revisions',()=>{
 for(const language of ['en','zh']){
  const model=studioWalkthrough(language,'model'),process=studioWalkthrough(language,'process');
  assert.equal(model.steps.length,3);assert.ok(model.topic.length<600);assert.ok(model.revision.length<600);
  assert.notEqual(model.revision,process.revision);assert.ok(model.steps.every(s=>s.detail.length<160));
 }
 assert.match(studioWalkthrough('zh','model').revision,/输出/);
 assert.match(studioWalkthrough('en','process').revision,/conditional/);
});
