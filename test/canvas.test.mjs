import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLesson} from '../public/lesson-schema.mjs';
import {lessonAuthorRequest} from '../src/lesson-author.mjs';
import {buildSavedLesson,publicLesson} from '../src/lessons.mjs';
import {coolingLesson,processLesson} from '../test-support/generated-lessons.mjs';

const binding=()=>({concept:'coffee cup',input:'initial',box:{x:.1,y:.2,width:.4,height:.5}});
const request=(extra={})=>({lesson:coolingLesson(),chapter:0,variant:0,prediction:'disagree',language:'en',explanation:'I expected constant cooling.',...extra});

test('a confirmed image binding survives validation and saved lesson reading',()=>{
 const lesson=coolingLesson();lesson.chapters[0].canvas=binding();
 const saved=buildSavedLesson({lesson,reviewed:true},{owner:'synthetic-owner'});
 assert.deepEqual(publicLesson(saved).lesson.chapters[0].canvas,binding());
 assert.equal(validateLesson(coolingLesson()).chapters[0].canvas,undefined);
});
test('bindings cannot target missing controls, process chapters or out-of-image regions',()=>{
 for(const invalid of [{...binding(),input:'missing'},{...binding(),box:{x:.9,y:0,width:.2,height:1}},{...binding(),box:{x:NaN,y:0,width:1,height:1}},{...binding(),concept:''}]){
  const lesson=coolingLesson();lesson.chapters[0].canvas=invalid;
  assert.throws(()=>validateLesson(lesson),/canvas/i);
 }
 const lesson=processLesson();lesson.chapters[0].canvas=binding();
 assert.throws(()=>validateLesson(lesson),/canvas/i);
});
test('guide derives drawn values and model comparison on the server',()=>{
 const lesson=coolingLesson();lesson.chapters[0].canvas=binding();
 const result=lessonAuthorRequest(request({lesson,drawing:{points:[{x:0,y:.5},{x:1,y:.5}]}}),'guide');
 const evidence=JSON.parse(result.input).drawnPrediction;
 // Coffee starts at 80 degrees; chart domain is 0..86.4. A halfway-height
 // horizontal prediction is 43.2, not a client-supplied computed answer.
 assert.equal(evidence.unit,'°C');
 assert.equal(evidence.samples[0].predicted,43.2);
 assert.equal(evidence.samples[0].calculated,80);
 assert.ok(Math.abs(evidence.samples[1].calculated-22.987224102071835)<1e-8);
 assert.match(result.instructions,/drawn prediction/i);
});
test('guide rejects malformed or oversized drawings instead of silently ignoring them',()=>{
 for(const drawing of [{points:[]},{points:[{x:0,y:0},{x:1,y:Infinity}]},{points:[{x:-1,y:0},{x:1,y:1}]},{points:Array.from({length:129},()=>({x:0,y:0}))},{points:[{x:0,y:0},{x:1,y:1}],calculated:999}]){
  assert.throws(()=>lessonAuthorRequest(request({drawing}),'guide'),/drawing|canvas/i);
 }
 assert.throws(()=>lessonAuthorRequest(request({lesson:processLesson(),drawing:{points:[{x:0,y:0},{x:1,y:1}]}}),'guide'),/drawing|canvas/i);
});
