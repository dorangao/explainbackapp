import test from 'node:test';import assert from 'node:assert/strict';
import {reasoningEffortFor} from '../src/reasoning-effort.mjs';
import {learnerTryoutRequest} from '../src/lesson-tester.mjs';
import {lessonAuthorRequest} from '../src/lesson-author.mjs';
import {showRequest} from '../src/lesson-show.mjs';
import {coolingLesson} from '../test-support/generated-lessons.mjs';

test('learner turns think at minimal effort; author turns keep low',()=>{
 assert.equal(reasoningEffortFor('tryout'),'minimal');
 assert.equal(reasoningEffortFor('guide'),'minimal');
 assert.equal(reasoningEffortFor('compose'),'low');
 assert.equal(reasoningEffortFor('show'),'low');
 assert.throws(()=>reasoningEffortFor('illustrate'),/No reasoning effort/);
 // Muse Wonder and Muse Spark reject `none`, so no step may ask for it.
 for(const mode of ['tryout','guide','compose','show'])assert.notEqual(reasoningEffortFor(mode),'none');
});

test('every Studio request builder sends its step effort',()=>{
 const lesson=coolingLesson();
 assert.equal(learnerTryoutRequest({lesson,language:'en'}).reasoningEffort,'minimal');
 assert.equal(lessonAuthorRequest({lesson,chapter:0,variant:0,language:'en',prediction:'agree',controls:{},metric:0},'guide').reasoningEffort,'minimal');
 assert.equal(lessonAuthorRequest({lesson,chapter:0,variant:0,language:'en',prediction:'agree',controls:{},metric:0,explanation:'It cools faster at first.'},'guide').reasoningEffort,'minimal');
 assert.equal(lessonAuthorRequest({topic:'Cooling coffee',creation:'generated'},'compose').reasoningEffort,'low');
 assert.equal(lessonAuthorRequest({topic:'Cooling coffee'},'compose').reasoningEffort,'low');
 assert.equal(showRequest({lesson}).reasoningEffort,'low');
});
